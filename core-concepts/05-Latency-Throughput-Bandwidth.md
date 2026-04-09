# ⏱️ Latency vs Throughput vs Bandwidth — Deep Dive

## The Three Performance Musketeers

These three concepts describe different dimensions of system performance. Confusing them is one of the most common mistakes in system design interviews.

---

## Latency

### What It Is
**Latency is the time delay between initiating an action and seeing its result.** It's how long ONE request takes from start to finish.

- Measured in: milliseconds (ms), microseconds (μs), or nanoseconds (ns)
- The question: "How long does the user wait?"

### Types of Latency

**Network latency:** Time for a packet to travel from A to B.
```
Same data center:      0.5 ms
Cross-country (US):    ~40 ms
US to Europe:          ~80 ms
US to Asia:            ~150-200 ms
Satellite (GEO):       ~600 ms
```

**Disk latency:** Time to read/write data from storage.
```
L1 cache reference:           0.5 ns
L2 cache reference:           7 ns
Main memory (RAM) reference:  100 ns
SSD random read:              100 μs (100,000 ns)
HDD random read:              10 ms (10,000,000 ns)
```

**Application latency:** Time your code takes to process a request (computation, serialization, business logic).

**Total request latency** is the sum:
```
Total = Network (to server) + Server processing + Database query + Network (response back)
      = 20ms + 5ms + 15ms + 20ms = 60ms
```

### Latency Percentiles (Critical for Interviews!)

Average latency is misleading. Use percentiles:

```
p50  (median):     50% of requests are faster than this
p90:               90% of requests are faster
p95:               95% of requests are faster
p99:               99% of requests are faster (the "tail" latency)
p99.9:             99.9% of requests are faster
```

**Example:**
```
p50 = 50ms     → Half your users wait <50ms (typical experience)
p90 = 100ms    → 90% wait <100ms (good)
p99 = 500ms    → 1% wait >500ms (bad for those users)
p99.9 = 2000ms → 0.1% wait >2s (very bad, but rare)
```

**Why tail latency matters:**
- Your heaviest, most valuable customers often hit p99 (they have more data, more complex queries)
- At scale, even p99.9 affects thousands of users per day
- Amazon found that every 100ms of latency costs 1% in sales
- Google found that an extra 0.5s in search page load drops traffic by 20%

**Jeff Dean's rule at Google:** "If a system calls 100 backend services, and each has p99 = 1s, then 63% of user requests will experience >1s latency from at least one backend."
```
P(at least one slow) = 1 - (0.99)^100 = 63.4%
```

This is why tail latency management is crucial in microservices architectures.

### How to Reduce Latency

| Technique | How It Helps | Example |
|-----------|-------------|---------|
| **Caching** | Avoid slow operations by storing results | Redis cache: 1ms vs DB query: 50ms |
| **CDN** | Serve content from nearby edge locations | CDN: 10ms vs origin server: 200ms |
| **Connection pooling** | Reuse connections, avoid handshake overhead | PgBouncer for PostgreSQL |
| **Async processing** | Don't make user wait for non-critical work | Queue email sending, return immediately |
| **Data locality** | Keep data near the computation | Read from local replica, not cross-region |
| **Compression** | Reduce data size = faster transfer | gzip API responses, Protocol Buffers |
| **Prefetching** | Load data before it's needed | Load next page of results while user reads current page |
| **Batching** | Group multiple operations into one | Batch 100 DB inserts into one transaction |
| **Index optimization** | Faster database lookups | Add index: 50ms → 1ms query |
| **HTTP/2 multiplexing** | Multiple requests over one connection | Eliminate head-of-line blocking |

---

## Throughput

### What It Is
**Throughput is the number of operations a system can handle per unit of time.** It's the system's capacity.

- Measured in: requests per second (RPS/QPS), transactions per second (TPS), messages per second, bytes per second
- The question: "How many users can we serve simultaneously?"

### Throughput at Different Levels

**Network throughput:** How much data flows through the network.
```
Ethernet:          1 Gbps
Data center:       10-100 Gbps
Backbone:          100+ Gbps
```

**Application throughput:** How many requests the application processes.
```
Single thread:          ~1,000-10,000 RPS (depends on work per request)
Multi-threaded server:  ~10,000-100,000 RPS
Nginx (static):         ~500,000 RPS
Redis (in-memory):      ~100,000-1,000,000 RPS
```

**Database throughput:**
```
PostgreSQL (single node):     ~10,000-50,000 QPS (depends on query complexity)
MySQL (single node):          ~10,000-50,000 QPS
MongoDB (single node):        ~20,000-100,000 QPS
Cassandra (per node):         ~10,000-50,000 writes/sec
Redis:                        ~100,000+ operations/sec
```

### How to Increase Throughput

| Technique | How It Helps |
|-----------|-------------|
| **Horizontal scaling** | More servers = more total capacity |
| **Async / non-blocking I/O** | Handle thousands of concurrent connections per thread (event loop: Node.js, Nginx) |
| **Batching** | Process multiple items in one operation (batch inserts, batch API calls) |
| **Parallel processing** | Use multiple CPU cores simultaneously |
| **Caching** | Serve repeated requests from memory, freeing DB for new queries |
| **Database read replicas** | Spread read traffic across multiple DB instances |
| **Sharding** | Spread write traffic across multiple DB instances |
| **Message queues** | Buffer traffic spikes; workers process at steady rate |
| **Compression** | Send less data per request = more requests in same bandwidth |
| **Connection multiplexing** | Share connections (HTTP/2, gRPC multiplexing) |

---

## Bandwidth

### What It Is
**Bandwidth is the maximum amount of data that can be transferred per unit of time.** It's the theoretical capacity of the pipe.

- Measured in: bits per second (bps), megabits per second (Mbps), gigabits per second (Gbps)
- The question: "How wide is the pipe?"

**Bandwidth ≠ Throughput:**
- Bandwidth is the theoretical maximum (speed limit on a highway)
- Throughput is the actual achieved rate (actual traffic flow on the highway)
- Throughput ≤ Bandwidth (you can never exceed the pipe's capacity)
- The gap is caused by: protocol overhead, congestion, packet loss, latency

### Common Bandwidth Values
```
3G mobile:           ~1-5 Mbps
4G LTE:              ~10-50 Mbps
5G:                  ~100-1000 Mbps
Home WiFi:           ~50-500 Mbps
Ethernet (office):   1 Gbps
Data center link:    10-100 Gbps
AWS inter-AZ:        ~25 Gbps
AWS inter-region:    ~5 Gbps (encrypted, over public internet)
```

### Bandwidth in System Design

**When bandwidth matters:**
- Video streaming: 4K video needs ~25 Mbps per stream. 1 million concurrent streams = 25 Tbps!
- File storage: Uploading/downloading large files
- Data replication: Syncing data between data centers
- Backup: Transferring TB of data to backup storage

**When bandwidth is NOT the bottleneck:**
- Text-based APIs (small payloads, typically KB)
- Most CRUD applications
- Metadata services

---

## The Highway Analogy (Tie It All Together)

```
BANDWIDTH = Number of lanes on the highway
             6-lane highway = high bandwidth
             1-lane road = low bandwidth

THROUGHPUT = Actual number of cars passing per hour
             6-lane highway with traffic jams = low throughput despite high bandwidth
             1-lane road with perfect flow = decent throughput despite low bandwidth

LATENCY = Time for ONE car to travel from City A to City B
             Short highway = low latency
             Long highway = high latency (even if it's 6 lanes)
```

**The crucial insight:** These are INDEPENDENT dimensions.

| Scenario | Bandwidth | Latency | Throughput |
|----------|-----------|---------|------------|
| Satellite internet | High | Very High | Moderate |
| Fiber optic (local) | High | Very Low | High |
| Carrier pigeon with USB drive | Very High* | Very High | Low |
| Single fast CPU core | N/A | Very Low | Low |
| GPU cluster | N/A | Moderate | Very High |

*A pigeon carrying a 1TB SD card across a city has enormous "bandwidth" (data transferred per trip), but terrible latency (takes 30 minutes).

**Famous quote from Andrew Tanenbaum:** "Never underestimate the bandwidth of a station wagon full of tapes hurtling down the highway." — AWS Snowmobile (a literal truck) can transfer 100 PB of data. Sometimes physical transport beats the network.

---

## Back-of-the-Envelope Numbers You MUST Know

### Latency Numbers Every Developer Should Know
```
L1 cache reference:                     0.5 ns
Branch mispredict:                      5 ns
L2 cache reference:                     7 ns
Mutex lock/unlock:                      25 ns
Main memory reference:                  100 ns
Compress 1K bytes with Zippy:           3,000 ns     (3 μs)
Send 1 KB over 1 Gbps network:         10,000 ns    (10 μs)
Read 4 KB randomly from SSD:           150,000 ns   (150 μs)
Read 1 MB sequentially from memory:    250,000 ns   (250 μs)
Round trip within same datacenter:     500,000 ns   (500 μs)
Read 1 MB sequentially from SSD:     1,000,000 ns   (1 ms)
HDD seek:                           10,000,000 ns   (10 ms)
Read 1 MB sequentially from HDD:    20,000,000 ns   (20 ms)
Send packet CA→Netherlands→CA:     150,000,000 ns   (150 ms)
```

**Key takeaways from these numbers:**
1. Memory is 100x faster than SSD, SSD is 100x faster than HDD
2. Network within a data center (~0.5ms) is much faster than cross-continent (~150ms)
3. Sequential reads are MUCH faster than random reads (for both SSD and HDD)
4. This is why caching (memory) is so effective — it's orders of magnitude faster than disk

### Quick Estimation Helpers
```
1 day = 86,400 seconds ≈ ~100,000 seconds (round up for easy math)
1 million seconds ≈ 11.6 days
1 billion seconds ≈ 31.7 years

QPS from daily volume:
  1 million/day = ~12 QPS
  100 million/day = ~1,200 QPS
  1 billion/day = ~12,000 QPS

Typical peak = 2-5x average

Storage quick math:
  1 KB × 1 billion = 1 TB
  100 bytes × 1 billion = 100 GB
```

---

## 🎤 Interview Questions & Expected Answers

### Q1: "What's the difference between latency, throughput, and bandwidth?"

**Expected answer:**
> "These are three different dimensions of performance:
>
> **Latency** is the time for a single operation — how long one request takes from start to finish. Measured in milliseconds. Think of it as 'how long does one user wait?'
>
> **Throughput** is the number of operations per unit time — how many requests the system handles per second. Think of it as 'how many users can we serve simultaneously?'
>
> **Bandwidth** is the maximum data transfer capacity of the channel — the theoretical upper limit. Think of it as 'how wide is the pipe?'
>
> Using a highway analogy: bandwidth is the number of lanes, throughput is the actual cars passing per hour, and latency is how long one car takes to travel from A to B. You can have a wide highway (high bandwidth) with traffic jams (low throughput) or a narrow but empty road (low bandwidth) where one car gets through quickly (low latency).
>
> They're independent: you can have high bandwidth but high latency (satellite internet), or low latency but low throughput (a single fast CPU core)."

---

### Q2: "Why do we care about p99 latency instead of average latency?"

**Expected answer:**
> "Average latency is misleading because it hides the worst cases. If 99% of requests take 50ms but 1% take 5 seconds, the average is ~100ms — which looks fine but doesn't reflect the terrible experience for those 1% of users.
>
> We care about p99 because:
>
> 1. **Your most valuable customers often hit the tail.** Power users with more data, more complex queries, larger accounts — they're the ones hitting p99.
>
> 2. **At scale, 1% is a lot of people.** If you have 1 million requests per day, p99 means 10,000 requests are slower than that threshold. That's 10,000 frustrated users.
>
> 3. **In microservices, tail latencies compound.** If a request touches 10 services and each has p99 = 200ms, the probability that at least one service is slow is 1 - 0.99^10 = 9.6%. For 100 services, it's 63%. So at the system level, the tail of the slowest component dominates.
>
> I typically look at p50 (typical experience), p95 (good experience for most), p99 (worst experience we should tolerate), and p99.9 for critical systems."

---

### Q3: "Your system's throughput is maxing out. How would you diagnose and fix it?"

**Expected answer:**
> "I'd follow a systematic approach:
>
> **Diagnose:**
> 1. Identify which component is the bottleneck — CPU, memory, disk I/O, network, database, or external service.
> 2. Check metrics: Are app servers at 100% CPU? Is the database connection pool exhausted? Is there a slow query hogging resources?
> 3. Check if it's a single hotspot (one server or one DB shard getting disproportionate traffic).
>
> **Fix based on bottleneck:**
> - **CPU-bound:** Optimize code, add more app servers (horizontal scale), use more efficient algorithms.
> - **Memory-bound:** Increase memory, optimize data structures, fix memory leaks.
> - **Database-bound (reads):** Add caching layer (Redis), add read replicas, optimize queries with indexes.
> - **Database-bound (writes):** Batch writes, use async writes via message queue, shard the database.
> - **Network-bound:** Compress payloads, use binary protocols (Protobuf vs JSON), enable HTTP/2, add CDN.
> - **External service bottleneck:** Add circuit breaker, cache responses, use async processing.
>
> **General throughput improvements:**
> - Use non-blocking I/O (async frameworks)
> - Batch operations (bulk inserts, batch API calls)
> - Message queue for traffic smoothing (absorb spikes)
> - Auto-scaling to add capacity during peaks"

---

### Q4: "How would you estimate the bandwidth requirements for a video streaming service like Netflix?"

**Expected answer:**
> "Let me work through the numbers:
>
> **Assumptions:**
> - 200 million subscribers, 30% watching at peak = 60 million concurrent streams
> - Average quality: mix of 1080p (~5 Mbps) and 4K (~25 Mbps), weighted average ~8 Mbps
>
> **Calculation:**
> - Total bandwidth = 60M streams × 8 Mbps = 480 Tbps (terabits per second)
>
> **But wait — CDN changes everything:**
> - Netflix uses Open Connect (their own CDN), with appliances placed inside ISPs
> - Popular content is cached on these edge appliances
> - Only cache misses need to travel to Netflix's origin
> - With ~95% cache hit ratio, origin needs only: 480 × 0.05 = 24 Tbps from origin
> - And that's distributed across thousands of edge locations
>
> **Storage bandwidth:**
> - Netflix's catalog is ~15,000 titles × multiple resolutions × multiple codecs
> - Each title might be stored as 20+ variants
> - But only a small fraction is popular at any time (80/20 rule)
>
> This is why CDNs are absolutely essential for video streaming — without them, the bandwidth requirements would be physically impossible to meet from a centralized origin."

---

### Q5: "You're designing a system. The stakeholder wants latency under 100ms AND throughput of 1 million requests per second. Are these in conflict?"

**Expected answer:**
> "They can be in tension but aren't necessarily conflicting. The key is that techniques to improve one can sometimes hurt the other:
>
> **Where they conflict:**
> - **Batching** increases throughput (process many items at once) but increases latency for individual items (must wait for the batch to fill).
> - **Queuing** smooths throughput (handles bursty traffic) but adds latency (time spent in queue).
> - **Strong consistency** ensures correctness at the cost of both higher latency (coordination) and lower throughput (serialization).
>
> **Where they're aligned:**
> - **Caching** improves both: faster responses (less latency) and less load on backends (more throughput).
> - **Horizontal scaling** improves throughput without affecting per-request latency.
> - **Efficient serialization (Protobuf)** reduces both latency and bandwidth usage, improving throughput.
>
> **For the specific ask (100ms p99, 1M RPS):**
> - I'd use horizontal scaling with many app servers (each handles 10K-50K RPS)
> - Aggressive caching to keep p99 latency low
> - Async processing for anything that doesn't need to be in the critical path
> - Careful monitoring of both metrics to catch tradeoff situations early
>
> The key insight is: optimize latency per request, then scale out for throughput."

---

## 🧠 Mental Model

```
Think of a fast-food restaurant:

LATENCY    = How long ONE customer waits from ordering to receiving food
             (drive-through time: order to pickup window)

THROUGHPUT = How many customers served per hour
             (cars through the drive-through per hour)

BANDWIDTH  = How many drive-through lanes you have
             (maximum theoretical capacity)

To reduce LATENCY:
  → Pre-make popular items (caching!)
  → Better kitchen equipment (faster hardware)
  → Shorter menu (reduce complexity)

To increase THROUGHPUT:
  → Add more drive-through lanes (horizontal scaling)
  → Batch orders efficiently (batching)
  → Split prep across stations (parallelism)

To increase BANDWIDTH:
  → Build a bigger restaurant (more infrastructure)
  → Add more lanes (more network links)
  → Wider windows (bigger pipes)

Note: A fast-food restaurant can have LOW latency (each order takes 2 min)
but LOW throughput (only one cashier). Or HIGH throughput (20 cashiers)
but HIGH latency (each order takes 20 min due to complexity).
They are INDEPENDENT dimensions that must be optimized separately.
```
