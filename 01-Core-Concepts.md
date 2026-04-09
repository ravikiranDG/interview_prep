# ⚙️ Core Concepts

These are the foundational ideas that every system design answer builds upon. If you understand these deeply, you can reason about almost any design problem.

---

## 1. Scalability

**What it is:** The ability of a system to handle increased load (users, data, traffic) without degrading performance.

**Two types:**
- **Vertical Scaling (Scale Up):** Add more power (CPU, RAM, disk) to a single machine.
  - Pros: Simple, no code changes needed.
  - Cons: There's a hardware ceiling. Single point of failure.
- **Horizontal Scaling (Scale Out):** Add more machines to your pool.
  - Pros: Virtually unlimited scaling. Better fault tolerance.
  - Cons: More complex (need load balancing, data consistency, stateless design).

**Key insight for interviews:** Most real-world systems scale horizontally. When you design something, assume you'll need multiple instances of every component.

**Scalability dimensions:**
- **Read scalability:** Add read replicas, caching layers, CDNs
- **Write scalability:** Database sharding, partitioning, async writes
- **Compute scalability:** Horizontal pod autoscaling, serverless functions

**Quick math you should know:**
- 1 server ≈ 10K-100K concurrent connections (depending on workload)
- 1 day = 86,400 seconds ≈ ~100K seconds (use this for rate estimates)
- 1 million requests/day ≈ ~12 requests/second

---

## 2. Availability

**What it is:** The percentage of time a system is operational and accessible. Usually expressed as "nines":

| Availability | Downtime/Year | Downtime/Month |
|-------------|---------------|----------------|
| 99% (two nines) | 3.65 days | 7.3 hours |
| 99.9% (three nines) | 8.76 hours | 43.8 minutes |
| 99.99% (four nines) | 52.6 minutes | 4.38 minutes |
| 99.999% (five nines) | 5.26 minutes | 26.3 seconds |

**How to achieve high availability:**
1. **Redundancy** — No single point of failure. Run multiple instances of everything.
2. **Load Balancing** — Distribute traffic across healthy instances.
3. **Health Checks** — Continuously monitor and automatically remove unhealthy nodes.
4. **Failover** — Automatic switching to standby systems when primary fails.
5. **Geographic Distribution** — Deploy across multiple data centers/regions.

**Interview tip:** When asked "How would you make this highly available?", think:
- Replicate stateless services behind a load balancer
- Replicate databases with primary-replica setup
- Use multi-region deployment for disaster recovery
- Implement graceful degradation (serve partial data rather than nothing)

---

## 3. Reliability

**What it is:** The probability that a system will perform its intended function correctly over a given period. A system is reliable if it continues to work correctly even when things go wrong.

**Reliability vs Availability:**
- A system can be **available but not reliable** (it's up, but returns wrong data)
- A system can be **reliable but not available** (it gives correct results when it's up, but it's often down)
- You want **BOTH**

**How to build reliable systems:**
- **Data redundancy:** Replicate data across multiple nodes/regions
- **Idempotent operations:** Same request produces same result (safe retries)
- **Checksums & validation:** Detect data corruption
- **Testing:** Chaos engineering (intentionally break things to find weaknesses)
- **Monitoring & alerting:** Detect problems before users do

---

## 4. Single Point of Failure (SPOF)

**What it is:** Any component whose failure brings down the entire system.

**Common SPOFs and fixes:**

| SPOF | Fix |
|------|-----|
| Single database server | Primary-replica replication, multi-master |
| Single load balancer | Redundant LBs with floating IP (e.g., keepalived) |
| Single DNS server | Multiple DNS providers |
| Single data center | Multi-region deployment |
| Single application server | Multiple instances behind LB |
| Single network link | Multiple network paths |

**Interview mindset:** Every time you draw a box in your architecture diagram, ask yourself: "What happens if this box dies?" If the answer is "the system goes down," you've found a SPOF and need to add redundancy.

---

## 5. Latency vs Throughput vs Bandwidth

These three are related but distinct:

**Latency:** The time it takes for a single request to travel from sender to receiver and back.
- Measured in milliseconds (ms)
- Think of it as: "How long does ONE person wait?"
- Example: A database query takes 5ms

**Throughput:** The number of requests/operations a system can handle per unit of time.
- Measured in requests/second (RPS), queries/second (QPS), bytes/second
- Think of it as: "How many people can we serve per second?"
- Example: A server handles 10,000 RPS

**Bandwidth:** The maximum amount of data that can be transferred per unit of time.
- Measured in bits/second (Mbps, Gbps)
- Think of it as: "How wide is the pipe?"
- Example: A 1 Gbps network link

**The highway analogy:**
- **Bandwidth** = number of lanes on the highway
- **Throughput** = actual number of cars passing per hour (can be less than capacity due to traffic)
- **Latency** = time it takes one car to travel from A to B

**Key insight:** You can have high bandwidth but high latency (satellite internet). You can have low latency but low throughput (a single fast CPU core). Good system design optimizes the metric that matters most for your use case.

---

## 6. Consistent Hashing

**The problem:** You have N cache servers. You use `hash(key) % N` to decide which server stores a key. What happens when you add or remove a server? N changes, so almost ALL keys get remapped → cache stampede, massive data migration.

**The solution — Consistent Hashing:**

Imagine a ring (hash space from 0 to 2^32 - 1):
1. Hash each server to a position on the ring
2. Hash each key to a position on the ring
3. A key is stored on the first server found clockwise from its position

```
        Server A
       /        \
  Key1 •         • Key2
      |    RING   |
  Key3 •         • Server B
       \        /
        Server C
```

**When a server is added:** Only the keys between the new server and its counter-clockwise neighbor need to move. Everything else stays put.

**When a server is removed:** Only that server's keys move to the next server clockwise.

**Virtual nodes:** To ensure even distribution, each physical server gets multiple "virtual" positions on the ring. A server with more capacity can get more virtual nodes.

**Where it's used:**
- Amazon DynamoDB
- Apache Cassandra
- Memcached / Redis clusters
- CDN routing
- Load balancing (e.g., consistent hashing in Nginx)

**Interview tip:** Always mention consistent hashing when discussing distributed caches, database sharding, or any scenario where data is partitioned across multiple nodes.

---

## 7. CAP Theorem

**Statement:** In a distributed system, you can only guarantee TWO of these three:
- **Consistency (C):** Every read receives the most recent write (all nodes see the same data at the same time)
- **Availability (A):** Every request receives a response (even if it's not the latest data)
- **Partition Tolerance (P):** The system continues to operate despite network partitions (communication breakdowns between nodes)

**The reality:** Network partitions WILL happen in distributed systems. So P is not optional. Your real choice is:
- **CP (Consistency + Partition Tolerance):** When a partition occurs, the system blocks/errors rather than return stale data. Example: HBase, MongoDB (default), Redis Cluster
- **AP (Availability + Partition Tolerance):** When a partition occurs, the system returns whatever data it has, even if stale. Example: Cassandra, DynamoDB, CouchDB

**When to choose what:**
- **Choose CP** when correctness is critical: Banking, inventory systems, booking systems
- **Choose AP** when availability is critical: Social media feeds, search, DNS

**PACELC extension (more realistic):**
If there's a **P**artition, choose **A** or **C**; **E**lse (normal operation), choose **L**atency or **C**onsistency.
- DynamoDB: PA/EL (available during partition, low latency normally)
- MongoDB: PC/EC (consistent always)

---

## 8. Failover

**What it is:** The process of automatically switching to a redundant system when the primary system fails.

**Types of failover:**

**Active-Passive (Cold/Warm Standby):**
- Primary handles all traffic
- Standby sits idle (or receives replicated data)
- When primary fails, standby takes over
- Pros: Simple. Standby has full capacity for failover.
- Cons: Wasted resources (standby is idle). Some data loss possible (replication lag).

**Active-Active (Hot Standby):**
- Multiple nodes handle traffic simultaneously
- When one fails, others absorb its load
- Pros: No wasted resources. Faster failover.
- Cons: More complex. Need data consistency across active nodes.

**Failover challenges:**
- **Split-brain:** Both nodes think they're the primary → data corruption. Solution: Use a quorum/fencing mechanism.
- **Data loss:** If failover happens before replication completes, recent writes may be lost.
- **Failover detection time:** How quickly do you detect the failure? (Heartbeat intervals)

---

## 9. Fault Tolerance

**What it is:** The ability of a system to continue operating (possibly at a reduced level) when one or more components fail.

**Fault tolerance vs High Availability:**
- **HA** is about minimizing downtime (the system is up X% of time)
- **Fault tolerance** is about continuing operation DESPITE failures (no downtime at all)

**Techniques:**
1. **Replication:** Multiple copies of data/services
2. **Redundancy:** Backup components ready to take over
3. **Graceful degradation:** System continues with reduced functionality
   - Example: Netflix shows cached recommendations instead of real-time ones
4. **Retry with backoff:** Transient failures are retried with exponential backoff + jitter
5. **Bulkheading:** Isolate components so one failure doesn't cascade
   - Example: Separate thread pools for different service calls
6. **Circuit breaking:** Stop calling a failing service to let it recover (covered more in Distributed Systems section)

**Chaos Engineering:** Intentionally inject failures to test fault tolerance.
- Netflix's Chaos Monkey randomly kills production instances
- Helps discover weaknesses before they cause real outages

**Interview tip:** When designing any system, always discuss what happens when things fail. Interviewers are impressed when you proactively address failure scenarios without being asked.
