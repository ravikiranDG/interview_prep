# ⚡ Caching Strategies & Patterns — Deep Dive

## Why Caching Is the #1 Performance Optimization

```
Database read:     5-50 ms
Redis cache read:  0.1-1 ms
CDN edge read:     1-10 ms (from nearby PoP)
Browser cache:     0 ms (no network at all!)
```

A well-designed cache can reduce database load by 90-99% and cut response times by 10-100x.

**The 80/20 rule:** 80% of requests access 20% of data. Cache that 20% and you've handled 80% of traffic from memory.

---

## Caching Strategies — When Data Flows Between App, Cache, and DB

### 1. Cache-Aside (Lazy Loading) — The Most Common

**The application manages the cache. Cache is a side-channel, not in the data path.**

```
READ:
  App → Check cache → HIT? Return cached data
                    → MISS? → Read from DB → Write to cache → Return data

WRITE:
  App → Write to DB → Invalidate cache entry (delete from cache)
```

**Pros:**
- Only requested data is cached (no wasted memory)
- Application has full control over caching logic
- Cache failure doesn't prevent reads (just falls through to DB)

**Cons:**
- First request is always a cache miss (cold start)
- Stale data possible between DB write and cache invalidation
- Application code is more complex (cache logic everywhere)

**When to use:** General purpose. This is the DEFAULT strategy for most applications.

**Example — User profile:**
```python
def get_user(user_id):
    # 1. Check cache
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)  # Cache HIT
    
    # 2. Cache MISS — read from DB
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)
    
    # 3. Populate cache (with TTL)
    redis.setex(f"user:{user_id}", 3600, json.dumps(user))  # Cache for 1 hour
    
    return user

def update_user(user_id, data):
    # 1. Write to DB
    db.execute("UPDATE users SET ... WHERE id = %s", user_id)
    
    # 2. Invalidate cache
    redis.delete(f"user:{user_id}")
    # Next read will miss cache and reload from DB
```

---

### 2. Read-Through

**The cache itself is responsible for loading data from the DB on a miss.**

```
READ:
  App → Read from cache → HIT? Return data
                        → MISS? Cache reads from DB → stores it → returns to App

WRITE:
  Same as Cache-Aside (App writes to DB, invalidates cache)
```

**Difference from Cache-Aside:** The data-loading logic is in the cache library, not the application. The app always talks to the cache — it never directly queries the DB for cached entities.

**Pros:** Simpler application code (no cache miss handling).
**Cons:** Cache library needs to know about your DB queries.

---

### 3. Write-Through

**Every write goes through the cache to the database.**

```
WRITE:
  App → Write to cache → Cache writes to DB synchronously → Return success to App

READ:
  App → Read from cache → always HIT (because all writes went through cache)
```

**Pros:**
- Cache is always consistent with DB (no stale reads!)
- Combined with read-through = simple, consistent

**Cons:**
- Higher write latency (must write to both cache AND DB before returning)
- Writes for data that's never read waste cache space

**When to use:** When consistency between cache and DB is critical and you can tolerate higher write latency.

---

### 4. Write-Behind (Write-Back)

**Write to cache immediately. Cache writes to DB asynchronously later.**

```
WRITE:
  App → Write to cache → Return success immediately (very fast!)
  Cache → asynchronously batches writes to DB (background)

READ:
  App → Read from cache → HIT (data is in cache)
```

**Pros:**
- Very fast writes (just memory write)
- Reduces DB load (batches multiple writes)

**Cons:**
- **Risk of data loss!** If cache crashes before flushing to DB, data is lost.
- More complex (background write process, failure handling)
- Data in cache may diverge from DB temporarily

**When to use:** Write-heavy workloads where some data loss is acceptable (analytics, counters, non-critical metrics).

---

### 5. Write-Around

**Write directly to DB, bypassing the cache.**

```
WRITE:
  App → Write to DB directly (cache is not updated)
  App → Optionally invalidate the cache entry

READ:
  App → Check cache → MISS → Read from DB → Populate cache
```

**Pros:** Cache isn't filled with data that may never be re-read.
**Cons:** First read after a write is always a cache miss.
**When to use:** Data that's written once and rarely read immediately afterward (log entries, audit records).

---

## Cache Eviction Policies — When Cache Is Full

### LRU (Least Recently Used) — The Default Choice
Evict the entry that hasn't been accessed for the longest time.

**Implementation:** Doubly-linked list + HashMap. O(1) for all operations.
```
Access order: A, B, C, D, E (capacity = 4)
Cache: [B, C, D, E]  (A was evicted — least recently used)
Access C: [B, D, E, C]  (C moves to front)
Add F:    [D, E, C, F]  (B evicted)
```

**Weakness — Scan pollution:** A one-time scan of many items pushes out genuinely popular items.
**Solution:** LRU-K (only promote to LRU after K accesses) or ARC (Adaptive Replacement Cache).

### LFU (Least Frequently Used)
Evict the least-accessed entry over all time.
**Strength:** Keeps popular items. **Weakness:** Recently added items start with low frequency and get evicted prematurely.

### TTL (Time To Live)
Each entry expires after a set time. Used in combination with LRU/LFU.
```
redis.setex("user:42", 3600, data)  # Expires in 1 hour
```
**Strength:** Guarantees freshness. **Weakness:** Good TTL is hard to determine.

---

## Cache Invalidation — The Hardest Problem

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

### Strategies

| Strategy | How | Tradeoff |
|----------|-----|----------|
| **TTL-based** | Cache entry expires after N seconds | Simple but may serve stale data for up to TTL duration |
| **Event-based** | On DB write, publish event → subscriber invalidates cache | Near real-time but requires event infrastructure |
| **Active invalidation** | On write, explicitly delete the cache key | Simple, but what if the delete fails? (stale data) |
| **Version-based** | Cache key includes version: `user:42:v5`. On update, increment version to v6. Old key is never read again. | Clean but requires version tracking |

### The Thundering Herd Problem

```
A popular cache key expires.
1000 requests arrive simultaneously.
All 1000 miss the cache.
All 1000 hit the database.
Database is overwhelmed.
```

**Solutions:**
1. **Lock/Mutex:** First request acquires a lock, loads from DB, populates cache. Other requests wait.
2. **Early expiration:** Refresh cache BEFORE it expires (probabilistic early expiration).
3. **Stale-while-revalidate:** Serve stale data while refreshing in background.
4. **Request coalescing:** Group identical concurrent requests into one DB query.

---

## 🎤 Interview Questions & Expected Answers

### Q1: "You're designing a high-traffic product page. How would you implement caching?"

**Expected answer:**
> "I'd use a multi-layered caching strategy:
>
> **Layer 1 — CDN (Cloudflare/CloudFront):**
> Cache static assets (images, CSS, JS) and even the product page HTML with short TTL (60 seconds). This handles the majority of traffic without hitting our servers.
>
> **Layer 2 — Application cache (Redis):**
> Cache product data with cache-aside pattern. Key: `product:{id}`, TTL: 5 minutes.
> - On read: check Redis first, fall through to DB on miss.
> - On price/stock update: invalidate the cache key.
>
> **Layer 3 — Local in-process cache:**
> For extremely hot products (trending items), cache in application memory (e.g., Guava cache, Node.js LRU). TTL: 30 seconds. Avoids even the Redis network round trip.
>
> **Handling stock count:**
> Stock changes frequently. I'd use a separate cache key for stock with a very short TTL (10 seconds) or use write-through caching for stock updates.
>
> **Cache invalidation:**
> - TTL as a safety net (data is never stale for more than X seconds)
> - Active invalidation on updates (delete cache key when product is updated)
> - For stock: real-time invalidation via pub/sub (product service publishes stock changes → cache invalidation subscriber)
>
> **Thundering herd protection:**
> For popular products, use a lock/singleflight pattern — only one request loads from DB on a cache miss, others wait for the result."

### Q2: "When would you NOT use caching?"

**Expected answer:**
> "Caching isn't always appropriate:
>
> 1. **Data that changes every request.** If every request needs a fresh result (real-time stock trading prices with millisecond precision), caching adds complexity without benefit.
>
> 2. **Write-heavy workloads.** If data changes more often than it's read, the cache would be constantly invalidated. The cache hit ratio would be near zero, and you'd be paying the cost of cache writes for no benefit.
>
> 3. **Large, rarely-accessed data.** Caching a 100MB file that's accessed once a day wastes memory. Only cache hot data.
>
> 4. **When consistency is critical.** If stale data causes real problems (showing an item as in-stock when it's sold out), caching requires very careful invalidation. Sometimes it's simpler to just read from the DB.
>
> 5. **When the database is fast enough.** If your database serves responses in <1ms and you have low traffic, adding a cache layer adds complexity with marginal benefit.
>
> The key question: Is the data read frequently, changes infrequently, and can tolerate brief staleness? If yes → cache it. If no to any → reconsider."

### Q3: "Explain the difference between cache-aside and write-through. When would you use each?"

**Expected answer:**
> "**Cache-aside:** The application manages the cache. On read miss, the app queries the DB and populates the cache. On write, the app writes to the DB and invalidates (deletes) the cache entry. The cache is 'beside' the main data path.
>
> **Write-through:** Every write goes to the cache first, and the cache synchronously writes to the DB. Reads always hit the cache (because all writes went through it). The cache is 'in' the data path.
>
> **When to use cache-aside:**
> - Most applications (it's the default)
> - When you want to only cache data that's actually requested (lazy loading)
> - When you can tolerate brief stale reads between write and cache invalidation
>
> **When to use write-through:**
> - When consistency between cache and DB is critical
> - When combined with read-through for a simple, fully-consistent cache layer
> - When you're OK with higher write latency (double write: cache + DB)
>
> **Hybrid approach:** Many systems use cache-aside for reads and invalidation-on-write for consistency. Some critical hot paths might use write-through for specific data."
