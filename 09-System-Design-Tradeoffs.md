# ⚖️ System Design Tradeoffs

System design is fundamentally about making tradeoffs. There's no perfect system — only the right tradeoffs for your requirements. Interviewers love asking "why X over Y?" — this section prepares you for that.

---

## 1. Top 15 Tradeoffs to Know

Here's a quick reference of the most important tradeoffs, with deeper dives below:

| # | Tradeoff | Key Question |
|---|----------|-------------|
| 1 | Vertical vs Horizontal Scaling | Scale the machine or add more machines? |
| 2 | SQL vs NoSQL | Structured relationships or flexible scale? |
| 3 | Strong vs Eventual Consistency | Correct now or available now? |
| 4 | Read vs Write Optimization | Optimize for reads or writes? |
| 5 | Latency vs Throughput | Fast individual requests or high total volume? |
| 6 | Consistency vs Availability (CAP) | Correct data or always responsive? |
| 7 | Push vs Pull | Server pushes updates or client polls? |
| 8 | Synchronous vs Asynchronous | Wait for result or fire and forget? |
| 9 | Batch vs Stream Processing | Process in bulk or in real-time? |
| 10 | Stateful vs Stateless | Remember state or be ephemeral? |
| 11 | REST vs RPC | Resource-oriented or action-oriented? |
| 12 | Long Polling vs WebSockets | Compatible everywhere or truly real-time? |
| 13 | Caching: Read-Through vs Write-Through | Cache on read or cache on write? |
| 14 | Concurrency vs Parallelism | Manage multiple tasks or run simultaneously? |
| 15 | Monolith vs Microservices | Simple and coupled or complex and independent? |

---

## 2. Vertical vs Horizontal Scaling

### Vertical Scaling (Scale Up)
- Add more CPU, RAM, SSD to a single machine
- **Pros:** Simple, no code changes, no distributed system complexity
- **Cons:** Hardware limits (you can't buy a 1TB RAM server forever), single point of failure, expensive at high end
- **When:** Small-to-medium workloads, databases (before sharding), quick fixes

### Horizontal Scaling (Scale Out)
- Add more machines to the pool
- **Pros:** Virtually unlimited scale, better fault tolerance, cost-effective (commodity hardware)
- **Cons:** Distributed system complexity (consistency, networking, deployment), need stateless design, data partitioning challenges
- **When:** Large-scale systems, web servers, microservices

**The reality:** Most systems use BOTH. Scale up your individual machines to a reasonable size, then scale out by adding more of them.

```
Start:     1 server (vertical scale to max practical size)
Then:      N servers behind a load balancer (horizontal scale)
Database:  Vertical first → Read replicas → Sharding (horizontal)
```

---

## 3. Concurrency vs Parallelism

**Concurrency:** Dealing with multiple tasks at once (structure)
- Tasks are in progress simultaneously but may not execute at the same instant
- Example: One CPU switching between tasks rapidly (time-slicing)
- Analogy: One chef juggling multiple dishes

**Parallelism:** Doing multiple tasks at once (execution)
- Tasks literally execute simultaneously on multiple cores/machines
- Example: 4 CPUs each running a different task
- Analogy: Four chefs each cooking a different dish

```
Concurrency:  Task A ██░░██░░██    (interleaved on 1 core)
              Task B ░░██░░██░░

Parallelism:  Core 1: ████████████  (Task A)
              Core 2: ████████████  (Task B)
```

**For system design:**
- **Concurrency** matters for: handling many simultaneous connections (async I/O, event loops — Node.js, Nginx)
- **Parallelism** matters for: CPU-heavy tasks (data processing, image processing, ML training)
- **Use both:** Handle many concurrent requests (I/O-bound) and process them in parallel (CPU-bound)

---

## 4. Long Polling vs WebSockets

### Long Polling
```
Client: "Any new messages?" → Server holds request → (waits...) → New message arrives → Server responds
Client: "Any new messages?" → (repeat immediately)
```
- Client sends a request, server holds it until data is available (or timeout)
- When response comes, client immediately sends a new request
- **Pros:** Works everywhere (standard HTTP), simple to implement, firewall-friendly
- **Cons:** Overhead of repeated HTTP connections, headers resent every time, server holds many connections

### WebSockets
```
Client ↔ Server (persistent bidirectional connection)
Server: "Hey, new message!" (anytime, no polling needed)
```
- Persistent TCP connection, both sides can send data anytime
- **Pros:** True real-time, low latency, low overhead (no repeated headers), bidirectional
- **Cons:** More complex (connection management, reconnection logic), may not work through some proxies/firewalls, stateful (harder to scale)

**When to choose:**
| Scenario | Best Choice |
|----------|------------|
| Chat application | WebSockets |
| Live dashboard | WebSockets or SSE |
| Email notifications | Long Polling |
| Social media feed updates | Long Polling or SSE |
| Online gaming | WebSockets |
| Collaborative editing | WebSockets |

**Server-Sent Events (SSE):** A middle ground — server pushes to client over HTTP (unidirectional). Simpler than WebSockets, auto-reconnect, works with HTTP/2. Great for live feeds, notifications.

---

## 5. Batch vs Stream Processing

### Batch Processing
- Process large volumes of data at once, on a schedule
- Input: A bounded dataset (yesterday's logs, last hour's transactions)
- Output: Computed results stored somewhere
- Latency: Minutes to hours
- Examples: MapReduce, Apache Spark, daily ETL jobs

```
Collect data all day → Run batch job at midnight → Results ready by morning
```

### Stream Processing
- Process data as it arrives, continuously
- Input: An unbounded stream of events
- Output: Real-time results, immediate actions
- Latency: Milliseconds to seconds
- Examples: Apache Kafka Streams, Apache Flink, AWS Kinesis

```
Event arrives → Process immediately → Result available in real-time
```

### Comparison
| Aspect | Batch | Stream |
|--------|-------|--------|
| Data | Bounded (finite) | Unbounded (infinite) |
| Latency | High (minutes-hours) | Low (ms-seconds) |
| Throughput | Very high | Moderate-high |
| Complexity | Lower | Higher |
| Cost | Often cheaper (shared resources) | Higher (always running) |
| Use case | Reports, ML training, ETL | Alerts, fraud detection, live dashboards |

### Lambda Architecture (combine both)
```
                    ┌──→ [Batch Layer] → Comprehensive but slow results
Raw Events ────────┤
                    └──→ [Speed Layer] → Approximate but real-time results
                                  ↓
                         [Serving Layer] → Merge both for queries
```
- Batch for accuracy, stream for speed
- Complex to maintain (two codepaths for same logic)

### Kappa Architecture (stream only)
- Everything is a stream
- Batch = replaying the stream from the beginning
- Simpler than Lambda (one codebase)
- Example: Kafka as the source of truth, replay topics for reprocessing

---

## 6. Stateful vs Stateless Design

### Stateless
- Server doesn't store any client-specific state between requests
- Each request contains ALL information needed to process it
- **Pros:** Easy to scale horizontally (any server can handle any request), simple failover, easy to cache
- **Cons:** Larger request payloads (carry state every time), need external state store

### Stateful
- Server maintains client state between requests (sessions, connections)
- **Pros:** Smaller requests (state is already there), some operations are naturally stateful (WebSocket connections, database connections)
- **Cons:** Sticky sessions needed (client must always reach same server), harder to scale, failover loses state

**The modern approach:**
```
Stateless application servers (horizontally scaled)
     + External state stores (Redis for sessions, DB for data)
     = Best of both worlds
```

**Design rule:** Make compute stateless, make storage stateful. Put state where it belongs (database, cache, object store) — not in your application servers.

---

## 7. Strong vs Eventual Consistency

### Strong Consistency
- After a write, ALL subsequent reads see that write
- The system behaves as if there's only one copy of data
- **Pros:** Simple to reason about, no stale data
- **Cons:** Higher latency (must wait for replication), lower availability during partitions
- **When:** Banking transactions, inventory counts, booking systems

### Eventual Consistency
- After a write, reads MAY return stale data temporarily
- Given enough time with no new writes, ALL replicas converge to the same value
- **Pros:** Lower latency, higher availability, better performance
- **Cons:** Stale reads, harder to reason about, need conflict resolution
- **When:** Social media feeds, DNS, shopping cart, product reviews

**The consistency spectrum:**
```
Strong ←──────────────────────────────→ Eventual

Linearizable → Sequential → Causal → Read-your-writes → Monotonic reads → Eventual
(strongest)                                                              (weakest)
```

**Read-your-writes consistency:** A practical middle ground. After YOU write something, YOU always see your own write. Other users may see stale data temporarily. Example: After posting a comment, you see your comment immediately; others see it after a short delay.

---

## 8. Read-Through vs Write-Through Cache

(Covered in detail in 05-Caching-Fundamentals.md — summary here)

| Strategy | How it works | Tradeoff |
|----------|-------------|----------|
| **Read-Through** | Cache loads from DB on miss | Cold start penalty, lazy loading |
| **Write-Through** | Cache writes to DB synchronously | Always consistent, slower writes |
| **Write-Behind** | Cache writes to DB asynchronously | Fast writes, risk of data loss |
| **Cache-Aside** | App manages cache manually | Most flexible, more app code |

**When to choose:**
- Read-heavy, write-rarely → Cache-Aside or Read-Through
- Need consistency → Write-Through
- Write-heavy, can tolerate some data loss → Write-Behind

---

## 9. Push vs Pull Architecture

### Push
- Server sends data to clients when events occur
- **Pros:** Real-time, no wasted polling requests
- **Cons:** Server must track all clients, thundering herd if pushing to millions
- **Examples:** Push notifications, WebSockets, webhooks

### Pull
- Clients periodically request data from server
- **Pros:** Simple, client controls rate, works behind firewalls
- **Cons:** Not real-time, wasted requests (empty polls), delay = poll interval
- **Examples:** RSS feeds, email clients checking for mail, API polling

### Hybrid (Fan-out on write + Fan-out on read)
- **Fan-out on write (push):** When a user posts, push to ALL followers' feeds immediately
  - Fast reads (feed is precomputed)
  - Slow writes (must update millions of feeds for celebrities)
  - Waste if followers don't check their feed
- **Fan-out on read (pull):** When a user opens their feed, fetch recent posts from all people they follow
  - Fast writes (just store the post)
  - Slow reads (must aggregate from many sources)

**Twitter/Instagram approach:** Hybrid
- Regular users: fan-out on write (push to followers' feeds)
- Celebrities (millions of followers): fan-out on read (too expensive to push)

---

## 10. REST vs RPC

### REST (Representational State Transfer)
- Resource-oriented: URLs represent resources
- Standard HTTP methods: GET, POST, PUT, DELETE
- Stateless, cacheable
- **Best for:** CRUD operations, public APIs, web services

```
GET /users/123            → Get user 123
POST /orders              → Create an order
PUT /users/123            → Update user 123
DELETE /orders/456        → Delete order 456
```

### RPC (Remote Procedure Call)
- Action-oriented: call functions on a remote server
- Often uses binary protocols (Protocol Buffers) for efficiency
- Can be stateful or stateless
- **Best for:** Internal microservice communication, performance-critical systems

```
getUserById(123)          → Get user 123
createOrder(orderData)    → Create an order
processPayment(payData)   → Process a payment
```

**gRPC (Google's RPC framework):**
- Uses Protocol Buffers (binary, smaller, faster than JSON)
- HTTP/2 based (multiplexing, streaming)
- Bi-directional streaming
- Code generation for multiple languages
- **Ideal for** microservice-to-microservice communication

| Aspect | REST | gRPC |
|--------|------|------|
| Format | JSON (text) | Protobuf (binary) |
| Protocol | HTTP/1.1 or 2 | HTTP/2 |
| Performance | Moderate | High |
| Browser support | Native | Needs grpc-web proxy |
| Streaming | Limited | Bidirectional |
| Schema | OpenAPI (optional) | Required (.proto files) |
| Best for | Public APIs, web | Internal services, mobile |

---

## 11. Synchronous vs Asynchronous Communication

### Synchronous
```
Service A → Request → Service B → Processing → Response → Service A continues
(Service A is BLOCKED waiting)
```
- **Pros:** Simple, immediate response, easy error handling
- **Cons:** Tight coupling, cascading failures, blocked threads

### Asynchronous
```
Service A → Message → [Queue] → Service B processes eventually
(Service A continues immediately)
```
- **Pros:** Loose coupling, better resilience, handles load spikes, no blocked threads
- **Cons:** Complexity (message ordering, idempotency), eventual consistency, harder debugging

**When to choose:**
| Scenario | Sync or Async? |
|----------|---------------|
| User needs immediate response | Sync |
| Sending emails/notifications | Async |
| Processing payments | Sync (user waits) + Async (settlement) |
| Data analytics pipeline | Async |
| Real-time search | Sync |
| Order processing | Async (after initial acknowledgment) |

---

## 12. Latency vs Throughput

(Also covered in Core Concepts — tradeoff-specific view here)

You often can't maximize both:
- **Optimizing latency:** Use caching, reduce hops, choose fast algorithms, colocate services
- **Optimizing throughput:** Use batching, parallel processing, async I/O, horizontal scaling

**The tradeoff:**
- Batching requests increases throughput but adds latency (must wait for batch to fill)
- Processing requests one-by-one minimizes latency but limits throughput
- Finding the sweet spot depends on your SLA

**Example:** Database writes
- Write each row individually: Low latency per write, low throughput overall
- Batch 1000 rows and write together: Higher latency per individual row, much higher throughput

**Key insight for interviews:** Always clarify which metric matters more for your use case. A payment system cares about latency (user is waiting). A log ingestion system cares about throughput (millions of events/second).
