# 🌍 Distributed Caching, Eviction & CDN — Deep Dive

## Distributed Caching

### Why Not Local Caching?

```
Local cache (per-server):
  [Server 1: cache{A,B}] [Server 2: cache{A,C}] [Server 3: cache{B,C}]
  Problems:
    - Same data cached 3 times (wasted memory)
    - Update A on Server 1 → Servers 2,3 still have stale A
    - Low hit ratio (each server caches independently)

Distributed cache (shared):
  [Servers 1,2,3] → [Redis Cluster: all data in one place]
  Benefits:
    - One copy of each entry (efficient memory use)
    - All servers see the same data
    - Much higher hit ratio
```

### Redis — The King of Distributed Caching

**What Redis offers beyond simple key-value:**

| Data Structure | Use Case | Example |
|---------------|----------|---------|
| **Strings** | Simple caching, counters | `SET user:42 "{json...}"`, `INCR page_views` |
| **Hashes** | Object fields | `HSET user:42 name "Alice" age 30` |
| **Lists** | Queues, recent items | `LPUSH recent_orders order_123` |
| **Sets** | Unique collections, tags | `SADD user:42:interests "sports" "music"` |
| **Sorted Sets** | Leaderboards, rankings | `ZADD leaderboard 1500 "player_1"` |
| **Streams** | Event log, messaging | `XADD events * type "order" id "123"` |
| **HyperLogLog** | Cardinality estimation | `PFADD unique_visitors "user_42"` |
| **Geo** | Location-based queries | `GEOADD restaurants -122.42 37.77 "Sushi Place"` |

### Redis Cluster Architecture

```
[Redis Cluster]
  Slot 0-5460    → [Master 1] ←→ [Replica 1a]
  Slot 5461-10922 → [Master 2] ←→ [Replica 2a]
  Slot 10923-16383 → [Master 3] ←→ [Replica 3a]
```

- 16,384 hash slots distributed across masters
- Each key is assigned to a slot: `CRC16(key) % 16384`
- If Master 2 fails → Replica 2a is promoted automatically
- Add a new master → some slots are migrated from existing masters

### Redis vs Memcached

| Feature | Redis | Memcached |
|---------|-------|-----------|
| Data structures | Rich (lists, sets, hashes, etc.) | Strings only |
| Persistence | RDB snapshots + AOF log | None |
| Replication | Built-in master-replica | Client-side sharding |
| Clustering | Redis Cluster | Client-side sharding |
| Pub/Sub | Yes | No |
| Scripting | Lua scripting | No |
| Memory efficiency | Lower (overhead per key) | Higher |
| Threading | Mostly single-threaded (I/O threads in 6.0+) | Multi-threaded |
| **Best for** | Rich data operations, persistence needed | Simple caching, max throughput |

---

## Cache Consistency Patterns in Distributed Systems

### Problem: Cache + DB Consistency

```
Thread A: Update DB (price=$20) → Delete cache → done
Thread B: Read cache (miss) → Read DB → gets $20 → Write cache ($20)

Race condition:
Thread A: Update DB (price=$20)
Thread B: Read cache (miss) → Read DB (gets OLD price=$10, before A's write propagated)
Thread A: Delete cache
Thread B: Write cache ($10)  ← STALE data in cache!
```

### Solution: Delayed Double Delete

```
1. Delete cache
2. Update DB
3. Wait short delay (e.g., 500ms — enough for concurrent reads to complete)
4. Delete cache again
```

### Solution: Cache-aside with Short TTL

Even if stale data sneaks in, it expires quickly. For most use cases, a 5-60 second TTL is acceptable.

### Solution: CDC-based Invalidation

```
App → Write to DB
[Debezium CDC] → Reads DB change log → Publishes event
[Cache Invalidation Service] → Receives event → Deletes cache key
```

No race conditions because invalidation is driven by the DB's change log (source of truth).

---

## CDN (Content Delivery Network) — Deep Dive

### How CDN Works

```
Without CDN:
  User in Tokyo → request travels to US-East origin → 200ms RTT → slow!

With CDN:
  User in Tokyo → hits Tokyo edge server → 10ms RTT → fast!
                   (if cached. If not, edge fetches from origin, caches, then serves)
```

### CDN Architecture

```
                    [Origin Server (your backend)]
                              ↑ (cache miss only)
                    [Origin Shield (intermediate cache)]
                    ↑         ↑          ↑
            [Tokyo PoP]  [London PoP]  [NYC PoP]
              ↑             ↑             ↑
          Tokyo users   London users   NYC users
```

**Origin Shield:** An intermediate cache layer between edge PoPs and the origin. Multiple PoPs route cache misses through the shield instead of hitting the origin directly. Reduces origin load dramatically.

### What to Cache on CDN

| Content Type | Cache Strategy | TTL |
|-------------|---------------|-----|
| Static assets (CSS, JS, images) | Cache aggressively | Hours-Days |
| HTML pages | Varies (static = long, dynamic = short/none) | Minutes-Hours |
| API responses | Selective (public, non-personalized) | Seconds-Minutes |
| Video/Audio chunks | Cache aggressively | Hours-Days |
| Personalized content | Don't cache on CDN | N/A |
| POST/PUT/DELETE requests | Never cache | N/A |

### Cache Invalidation on CDN

| Method | Description | Speed |
|--------|-------------|-------|
| **TTL expiry** | Set `Cache-Control: max-age=3600` | Automatic after TTL |
| **Purge API** | Call CDN API to invalidate specific URL | Seconds (manual trigger) |
| **Versioned URLs** | `style.v2.css` or `style.css?v=abc123` | Instant (new URL = cold cache) |
| **Stale-while-revalidate** | Serve stale, refresh in background | Near-instant for users |

**Best practice:** Use versioned URLs for assets (webpack content hash) and short TTL + purge for dynamic content.

### Push vs Pull CDN

| | Push CDN | Pull CDN |
|---|---------|----------|
| **How** | You upload content proactively | CDN fetches from origin on first request |
| **Cache misses** | None (pre-populated) | First request is slow (origin fetch) |
| **Freshness** | You control when to update | Controlled by TTL/headers |
| **Best for** | Known content, critical assets | Large catalogs, unpredictable popularity |

---

## 🎤 Interview Questions & Expected Answers

### Q1: "How would you design a distributed cache for a system handling 1 million requests per second?"

**Expected answer:**
> "At 1M RPS, I need a highly performant, horizontally scalable cache:
>
> **Technology:** Redis Cluster (or equivalent like Memcached with consistent hashing).
>
> **Architecture:**
> ```
> [App Servers (stateless)] → [Redis Cluster]
>                              Shard 1: Slots 0-5460
>                              Shard 2: Slots 5461-10922
>                              Shard 3: Slots 10923-16383
>                              (+ replica for each shard)
> ```
>
> **Sizing:** Each Redis node handles ~100K-200K ops/sec. For 1M RPS, I need ~6-10 master nodes (with headroom for peaks). Each master has a replica for failover.
>
> **Key design decisions:**
> - **Partitioning:** Redis Cluster uses hash slots (CRC16). Even distribution across nodes.
> - **Replication:** Each master has at least one replica. Automatic failover if master dies.
> - **Hot keys:** Monitor with Redis MONITOR or keyspace notifications. For hot keys (celebrity profile), use local L1 cache on app servers (30s TTL) to reduce Redis load.
> - **Serialization:** Use efficient formats (MessagePack, Protobuf) instead of JSON to reduce memory and network overhead.
> - **Connection pooling:** Each app server maintains a pool of Redis connections to avoid connection setup overhead.
>
> **Multi-layer caching:**
> - L1: Local in-process cache (100ms TTL, very hot data only)
> - L2: Redis Cluster (minutes-hours TTL)
> - L3: Database
>
> **Monitoring:** Cache hit ratio (target >95%), latency p99, eviction rate, memory usage per node."

### Q2: "How does a CDN work and when would you use one?"

**Expected answer:**
> "A CDN is a geographically distributed network of servers (called Points of Presence or PoPs) that caches content close to end users.
>
> **How it works:**
> 1. User in Tokyo requests `cdn.example.com/image.jpg`
> 2. DNS (often Anycast) routes them to the nearest PoP (Tokyo)
> 3. Tokyo PoP checks its cache — if HIT, serves immediately (~10ms)
> 4. If MISS, Tokyo PoP fetches from the origin server (or origin shield), caches it, then serves
> 5. Subsequent requests from Tokyo users are served from the cache
>
> **When to use a CDN:**
> - **Static assets:** Images, CSS, JS, fonts, videos — always cache on CDN
> - **Global user base:** Users in different continents benefit from local edge servers
> - **High traffic:** CDN absorbs most traffic, reducing origin server load by 90%+
> - **DDoS protection:** CDN infrastructure can absorb large volumetric attacks
> - **Video streaming:** CDN is essential for streaming (Netflix, YouTube). Pre-cache popular content at edges.
>
> **When NOT to use CDN:**
> - Personalized API responses (can't cache effectively)
> - Internal-only services (users are on the same network as servers)
> - Very small scale (overhead of CDN setup isn't worth it)
>
> **CDN is low-hanging fruit — always include it in system design interviews when the system serves static content or has global users.**"

### Q3: "What is cache stampede (thundering herd) and how do you prevent it?"

**Expected answer:**
> "Cache stampede happens when a popular cache key expires, and hundreds or thousands of requests simultaneously hit the database to reload it. This can overwhelm the database.
>
> **Prevention strategies:**
>
> 1. **Mutex/Lock:** When a cache miss occurs, the first request acquires a distributed lock (Redis `SET key NX PX 5000`). It loads from the DB and populates the cache. Other requests wait for the lock to release, then read from the now-populated cache.
>
> 2. **Probabilistic early expiration:** Before the actual TTL expires, each request has a small probability of refreshing the cache. Formula: `should_refresh = random() < (time_since_last_refresh / TTL)`. This means the cache is refreshed before expiration, avoiding the mass miss.
>
> 3. **Stale-while-revalidate:** Serve the stale (expired) data to users while refreshing from the DB in the background. Users see slightly stale data for a few seconds, but there's no thundering herd.
>
> 4. **Request coalescing (singleflight):** Group multiple identical concurrent requests into one. Only one actually queries the database, and the result is shared with all waiting requests.
>
> 5. **Never let the cache actually expire for critical keys:** Have a background job that refreshes the cache BEFORE TTL expires. The cache key always has data.
>
> I'd use request coalescing (singleflight) as the primary approach — it's simple, effective, and requires minimal changes. Libraries like Go's `singleflight` or custom implementations in other languages handle this cleanly."
