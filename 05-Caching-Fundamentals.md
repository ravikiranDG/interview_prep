# ⚡ Caching Fundamentals

Caching is one of the most impactful performance optimizations in system design. It's the first thing to consider when you need to reduce latency or database load.

---

## 1. Caching 101

**What is caching?** Storing frequently accessed data in a faster storage layer (typically in-memory) so future requests can be served more quickly.

**Why caching works — Locality of Reference:**
- **Temporal locality:** Recently accessed data is likely to be accessed again soon
- **Spatial locality:** Data near recently accessed data is likely to be accessed soon
- **Pareto principle (80/20 rule):** 80% of requests access 20% of data

**Cache hit vs miss:**
```
Cache Hit:  Client → Cache → Data found! → Return (fast, ~1ms)
Cache Miss: Client → Cache → Not found → Database → Return (slow, ~50ms) → Store in cache
```

**Cache hit ratio:** The percentage of requests served from cache. Even 90% hit ratio means the database only handles 10% of traffic.

**Where caching happens (multi-level):**
```
Browser Cache → CDN → API Gateway Cache → Application Cache → Database Cache → OS Page Cache
(client-side)   (edge)                    (Redis/Memcached)   (query cache)   (disk/memory)
```

**What to cache:**
- ✅ Frequently read, rarely changed data (user profiles, configuration)
- ✅ Expensive computations (leaderboards, aggregations)
- ✅ Database query results
- ✅ HTML fragments, API responses
- ✅ Session data
- ❌ Highly dynamic data that changes every request
- ❌ Large data that's rarely accessed (wastes cache space)

---

## 2. Caching Strategies

These strategies define how data flows between your application, cache, and database.

### Cache-Aside (Lazy Loading)
```
Read:
  1. App checks cache
  2. Cache miss → App reads from DB
  3. App writes result to cache
  4. Return to client

Write:
  1. App writes to DB
  2. App invalidates (deletes) the cache entry
```

- **Most common strategy**
- App has full control over caching logic
- Only requested data is cached (no wasted space)
- Cache miss penalty: extra round trip to DB + cache write
- Risk: stale data between DB write and cache invalidation

### Read-Through
```
Read:
  1. App asks cache for data
  2. Cache miss → Cache itself reads from DB
  3. Cache stores the data
  4. Returns to app
```

- Cache is responsible for loading data from DB (not the app)
- Simpler application code
- Cache acts as the primary data interface
- Downside: first request for any data is always slow (cold start)

### Write-Through
```
Write:
  1. App writes to cache
  2. Cache synchronously writes to DB
  3. Return success to app
```

- Data in cache is always consistent with DB
- No stale reads
- Higher write latency (must write to both cache + DB before returning)
- Combined with read-through: simple, consistent

### Write-Behind (Write-Back)
```
Write:
  1. App writes to cache
  2. Cache acknowledges immediately
  3. Cache asynchronously writes to DB (batched, delayed)
```

- Very fast writes (just memory)
- Reduces DB load (batch writes)
- **Risk: Data loss** if cache crashes before writing to DB
- Good for write-heavy workloads where some data loss is acceptable

### Write-Around
```
Write:
  1. App writes directly to DB (bypasses cache)
  2. Cache entry (if exists) is invalidated

Read:
  1. Cache miss → Read from DB, populate cache
```

- Prevents cache from being filled with data that won't be re-read
- Good when written data is rarely read immediately after writing
- Higher read latency on first access after write

**Strategy comparison:**

| Strategy | Read Performance | Write Performance | Consistency | Data Loss Risk |
|----------|-----------------|-------------------|-------------|----------------|
| Cache-Aside | Good (after warmup) | N/A (writes go to DB) | Eventual | Low |
| Read-Through | Good (after warmup) | N/A | Eventual | Low |
| Write-Through | Excellent | Slower | Strong | Low |
| Write-Behind | Excellent | Very fast | Eventual | **High** |
| Write-Around | Good (after warmup) | Fast | Eventual | Low |

---

## 3. Cache Eviction Policies

When the cache is full and you need to add a new entry, which existing entry do you remove?

### LRU (Least Recently Used)
- Evict the entry that hasn't been accessed for the longest time
- **Most popular** eviction policy
- Implementation: Doubly-linked list + HashMap = O(1) for all operations
- Good for: Most workloads with temporal locality

### LFU (Least Frequently Used)
- Evict the entry that has been accessed the fewest times
- Better than LRU when some items are consistently popular
- Problem: New items start with low frequency and may be evicted too quickly
- Variation: LFU with aging (decay old frequency counts)

### FIFO (First In, First Out)
- Evict the oldest entry
- Simple but doesn't consider access patterns
- Rarely used in practice for application caches

### Random Replacement
- Evict a random entry
- Surprisingly effective! Often within 10-20% of optimal
- No overhead of tracking access patterns

### TTL-based (Time To Live)
- Each entry has an expiration time
- Expired entries are evicted (lazily or actively)
- Often combined with other policies (LRU + TTL)
- Good for: Data with known freshness requirements

### Comparison
| Policy | Pros | Cons | Use Case |
|--------|------|------|----------|
| LRU | Simple, effective | Scan pollution* | General purpose |
| LFU | Handles popular items well | Stale popular items | CDN, content caching |
| FIFO | Simplest | Ignores access patterns | Simple queues |
| Random | No tracking overhead | Unpredictable | High-throughput systems |
| TTL | Automatic freshness | Must know good TTL values | API caching, sessions |

*Scan pollution: A one-time scan of many items pushes out genuinely popular items from LRU cache.

---

## 4. Distributed Caching

**What it is:** A caching layer spread across multiple machines, providing shared cache for multiple application instances.

**Why not local caching?**
- Each app instance has its own cache → low hit ratio (same data cached N times)
- Cache inconsistency across instances
- Limited by single machine's memory

**Distributed cache architecture:**
```
App Server 1 ─┐
App Server 2 ─┤→ [Cache Cluster: Node A | Node B | Node C]
App Server 3 ─┘
```

**How data is distributed across cache nodes:**
- **Consistent hashing:** `hash(key) → cache node` (minimizes redistribution when nodes change)
- **Client-side sharding:** Application decides which node to query
- **Proxy-based sharding:** A proxy routes to the right node (e.g., Twemproxy)

**Popular distributed caches:**

### Redis
- In-memory data store with rich data structures (strings, hashes, lists, sets, sorted sets)
- Supports persistence (RDB snapshots, AOF log)
- Built-in replication, Redis Cluster for sharding
- Pub/sub, Lua scripting, transactions
- Use cases: Caching, session storage, leaderboards, rate limiting, pub/sub

### Memcached
- Pure in-memory key-value cache
- Simpler than Redis (string values only)
- Multi-threaded (better single-node throughput than Redis in some cases)
- No persistence, no replication (by design — it's just a cache)
- Use cases: Simple caching, session storage

**Redis vs Memcached:**
| Feature | Redis | Memcached |
|---------|-------|-----------|
| Data structures | Rich (lists, sets, hashes, etc.) | Strings only |
| Persistence | Yes (optional) | No |
| Replication | Yes | No (client-side) |
| Clustering | Redis Cluster | Client-side sharding |
| Pub/Sub | Yes | No |
| Lua scripting | Yes | No |
| Memory efficiency | Lower (overhead per key) | Higher |
| Threading | Single-threaded* (I/O threads in 6.0+) | Multi-threaded |

**Cache consistency challenges:**
- **Thundering herd:** Many requests hit a cache miss simultaneously → all hit the DB
  - Solution: Lock the cache key; only one request queries DB, others wait
- **Cache invalidation:** "There are only two hard things in CS: cache invalidation and naming things."
  - Strategy: TTL as a safety net + active invalidation on writes
- **Cache warming:** New or restarted cache is cold → high miss rate
  - Solution: Pre-populate cache from DB before routing traffic

---

## 5. Content Delivery Network (CDN)

**What it is:** A geographically distributed network of servers that caches and serves content from locations close to users.

**How a CDN works:**
```
User in Tokyo → [CDN Edge Server in Tokyo] → cache HIT → serves content (~10ms)
                                            → cache MISS → [Origin Server in US] → serves + caches (~200ms, but only first time)
```

**What CDNs serve:**
- Static content: Images, CSS, JS, videos, fonts
- Dynamic content: API responses (with short TTLs), personalized pages (edge computing)
- Streaming: Video chunks (Netflix, YouTube)
- Downloads: Software, game patches

**CDN types:**
- **Push CDN:** You upload content to CDN proactively. Content is there before anyone requests it.
  - Good for: Content you control and know will be needed (site assets)
  - Cons: Must manage uploads, storage costs
- **Pull CDN:** CDN fetches from origin on first request, then caches it.
  - Good for: Large content catalogs, content with varying popularity
  - Cons: First request is slow (cache miss)

**CDN benefits:**
1. **Lower latency:** Content served from nearby edge servers
2. **Reduced origin load:** Most requests never reach your servers
3. **DDoS protection:** CDN absorbs attack traffic at the edge
4. **High availability:** If one edge fails, traffic routes to another
5. **Bandwidth savings:** Cached content reduces origin bandwidth

**CDN cache invalidation:**
- **TTL-based:** Set appropriate Cache-Control headers
- **Purge API:** Force invalidate specific URLs
- **Versioned URLs:** `style.v2.css` or `style.css?v=2` — new version = new URL = automatic cache miss

**Popular CDNs:** Cloudflare, AWS CloudFront, Akamai, Fastly, Google Cloud CDN

**Interview tip:** Always include a CDN in your design if your system serves static content or has a global user base. It's low-hanging fruit for latency reduction.
