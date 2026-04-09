# 🔄 Failover — Deep Dive

## What is Failover?

Failover is the process of automatically (or manually) switching to a redundant or standby system when the primary system fails or becomes unavailable. It's the mechanism that makes high availability real.

**Simple analogy:** You're driving and your GPS loses satellite signal. Failover is your phone automatically switching to cell tower triangulation to keep navigating. You may lose some accuracy, but you don't lose navigation entirely.

---

## Why Failover Matters

Without failover:
```
Primary server dies → System is DOWN → Wait for human to fix it → MTTR: hours
```

With failover:
```
Primary server dies → Standby detects failure → Standby takes over → MTTR: seconds
```

The difference can be between a 3-second blip and a 3-hour outage. For a system processing $10M/hour in transactions, that's the difference between a non-event and a $30M problem.

---

## Failover Strategies

### 1. Active-Passive (Cold/Warm Standby)

```
Normal operation:
  ALL traffic → [Active Server (Primary)]
                [Passive Server (Standby)] ← idle, receiving replicated data

After failure:
  ALL traffic → [Passive Server (now Active)]
                [Active Server] ← dead
```

**How it works:**
1. Primary server handles ALL traffic
2. Standby continuously receives replicated data from primary
3. A monitoring system sends heartbeats to the primary
4. If heartbeats fail (primary is dead), the standby is promoted to primary
5. DNS or virtual IP is updated to point to the new primary

**Variants:**

**Cold standby:** Standby is OFF. On failure, it must boot up, load data, then start serving. Slowest failover (minutes).

**Warm standby:** Standby is ON and has recent data, but isn't actively processing requests. On failure, it starts accepting traffic. Moderate failover time (seconds to minutes).

**Hot standby:** Standby is ON, has real-time replicated data, and is ready to serve immediately. Fastest failover (seconds).

**Pros:**
- Simple architecture
- Full capacity available for failover (standby has no other load)
- Easier to reason about (one writer at a time)

**Cons:**
- Wasted resources (standby is idle during normal operation)
- Some data loss possible (depending on replication lag)
- Failover isn't instant (detection time + promotion time)

**Real-world example:** AWS RDS Multi-AZ. Your primary database has a synchronous standby in another AZ. If the primary fails, AWS automatically promotes the standby. Typical failover: 60-120 seconds. During this time, your application may see connection errors.

---

### 2. Active-Active (Hot-Hot)

```
Normal operation:
  50% traffic → [Server A (Active)]
  50% traffic → [Server B (Active)]
  (Both are fully operational, sharing the load)

After Server A fails:
  100% traffic → [Server B (Active)] ← absorbs A's traffic
  [Server A] ← dead
```

**How it works:**
1. Multiple servers all actively serve traffic
2. Load balancer distributes requests among them
3. If one server fails, the load balancer stops sending traffic to it
4. Remaining servers absorb the extra load

**Pros:**
- No wasted resources (all servers are working)
- Faster failover (no promotion needed, just redirect traffic)
- Better resource utilization during normal operation
- Can scale horizontally

**Cons:**
- More complex (data consistency between active nodes)
- Need to handle concurrent writes to the same data
- Each server must have spare capacity to absorb failover traffic (can't run at 100% utilization)
- Conflict resolution needed if data is modified on multiple nodes

**Capacity planning for active-active:**
```
If you have 3 active servers and need to survive 1 failure:
  Each server should run at most 66% capacity (2/3)
  So that 2 servers at 100% can handle the full load

If you have 5 active servers and need to survive 2 failures:
  Each server should run at most 60% capacity (3/5)
```

**Real-world example:** Google Search runs active-active across multiple data centers worldwide. Every data center can serve any search query. If one data center goes down, traffic is redistributed to others. Users don't notice.

---

### 3. Active-Active Multi-Region

```
Users in US → [US-East Data Center (Active)] ←── replication ──→ [EU-West Data Center (Active)] ← Users in EU
```

This is the gold standard for global services. Both regions serve their local users AND can absorb the other region's traffic during a regional failure.

**Challenges:**
- **Cross-region replication latency:** US to EU is ~80-100ms. Synchronous replication would add this to every write. Usually async replication.
- **Data consistency:** With async replication, a write in US-East may not be visible in EU-West for a few hundred milliseconds.
- **Conflict resolution:** If both regions write to the same record, which wins? (LWW, vector clocks, CRDTs)
- **Data sovereignty:** Some data may need to stay in specific regions (GDPR)

**Real-world example:** Netflix streams from multiple AWS regions. If one region fails, DNS routes viewers to another region. Their Zuul gateway, Eureka service discovery, and EVCache are all designed for multi-region operation.

---

## Failover Detection

Before you can failover, you need to DETECT the failure. This is harder than it sounds.

### Heartbeat-Based Detection
```
Primary sends heartbeat every 2 seconds → Monitor checks for heartbeats → 
If 3 consecutive heartbeats missed (6 seconds) → Declare primary dead → Initiate failover
```

**Tradeoff:**
- Short interval (1s) + low threshold (2 misses) → Fast detection (2s) but more false positives
- Long interval (5s) + high threshold (5 misses) → Slow detection (25s) but fewer false positives

**False positive danger:** If the network is briefly congested (not a real failure), you might trigger an unnecessary failover. This is especially dangerous for databases (promoting a replica when the primary is actually fine → split brain).

### Health Check Types
| Type | What It Checks | Depth |
|------|---------------|-------|
| **TCP connect** | Can we open a TCP connection? | Shallow — just checks if the process is running |
| **HTTP GET /health** | Does the app respond to a health endpoint? | Medium — checks if the app is responsive |
| **Deep health check** | Can the app query the DB, cache, dependencies? | Deep — checks if the app can actually serve requests |
| **Synthetic transaction** | Run a real user flow (login, search, checkout) | Deepest — checks end-to-end functionality |

**Best practice:** Use layered health checks:
- TCP check every 5s (is the process alive?)
- HTTP health check every 10s (is the app responding?)
- Deep check every 30s (are all dependencies healthy?)

---

## Failover Challenges

### 1. Split Brain

**The most dangerous failover failure mode.**

```
Scenario:
  [Primary] ←── network partition ──→ [Standby + Monitor]
  
  Monitor can't reach primary → assumes it's dead → promotes standby
  But primary is actually alive! It just can't reach the monitor.
  
  Now BOTH think they're the primary → both accept writes
  → Data diverges → CORRUPTION
```

**Solutions:**

**Quorum / Fencing:**
- Require a majority vote to elect a primary
- With 3 nodes, you need 2 to agree. Only one side of a partition can have a majority.
- Use STONITH (Shoot The Other Node In The Head) to forcibly shut down the old primary

**Fencing tokens:**
- Every time a new primary is elected, it gets an incrementing fencing token
- All requests to shared resources (like storage) include the fencing token
- Storage rejects requests with old tokens
- Even if the old primary "comes back," its old token is rejected

**Lease-based leadership:**
- Primary holds a time-limited lease (e.g., 10 seconds)
- Must renew before expiry to stay primary
- If it can't renew (partitioned), it MUST step down
- Standby waits for the lease to expire before promoting itself

### 2. Data Loss During Failover

```
Primary receives write at t=100
Primary replicates to standby... replication lag = 500ms
Primary crashes at t=100.2s (before replication completes)
Standby is promoted → missing the write at t=100

Result: Data loss of 200ms worth of writes
```

**Mitigation:**
- **Synchronous replication:** Write isn't acknowledged until standby confirms. Zero data loss, but higher latency.
- **Semi-synchronous:** At least one replica confirms synchronously. Others replicate async.
- **RPO acceptance:** Define acceptable data loss (RPO). If RPO = 1 second, async replication with <1s lag is fine.

### 3. Failover Cascading (Thundering Herd)

```
Primary dies → all connections drop → all clients reconnect simultaneously to standby
→ Standby is overwhelmed by the connection storm → Standby also crashes
→ Now BOTH servers are down!
```

**Solutions:**
- **Connection throttling:** Rate-limit new connections during failover
- **Backoff in clients:** Clients retry with exponential backoff + jitter
- **Connection pooling:** Pool managers handle reconnection gracefully
- **Pre-warm standby:** Ensure standby has warmed caches and is ready for full load

### 4. DNS Propagation Delay

If failover involves changing DNS records (new IP for the service):
```
DNS TTL = 300 seconds (5 minutes)
Failover at t=0 → new DNS record published
Some clients have cached old DNS → still hitting the dead server for up to 5 minutes
```

**Solutions:**
- **Low TTL:** Set DNS TTL to 30-60 seconds for critical services
- **Virtual IP (VIP):** Use a floating IP that moves between servers. No DNS change needed.
- **Elastic IP (cloud):** Reassign an Elastic IP from the failed instance to the standby.
- **Load balancer:** Failover happens behind the LB. Clients always talk to the LB's IP (which doesn't change).

---

## Failover Testing

**Never wait for a real failure to test your failover!**

### Chaos Engineering
- **Kill instances:** Does the system failover correctly?
- **Simulate network partition:** Does the system avoid split-brain?
- **Inject latency:** Does the system detect slow (but not dead) nodes?
- **Fill disk / exhaust memory:** Does the system handle resource exhaustion?

### Game Days
- Schedule a planned "disaster" during business hours
- The team practices responding to a simulated failure
- Measure: How quickly was it detected? How quickly was it resolved?
- Identify gaps in runbooks, monitoring, and automation

### Failover Drills
- Regularly trigger failovers to ensure the mechanism works
- AWS recommends testing RDS failover monthly
- Discover issues like: replication lag higher than expected, DNS TTL too long, application not handling connection drops gracefully

---

## Real-World Failover Architectures

### AWS RDS Multi-AZ
- Synchronous standby in different AZ
- Automatic failover on primary failure
- DNS endpoint stays the same (AWS updates the CNAME)
- Failover time: 60-120 seconds
- No data loss (synchronous replication)

### Redis Sentinel
- Sentinel processes monitor Redis master and replicas
- If master fails, Sentinels vote to elect a new master
- Automatic promotion of a replica to master
- Clients discover the new master through Sentinel
- Failover time: ~30 seconds (configurable)

### Kubernetes Pod Failover
- Liveness probes check if a pod is healthy
- If unhealthy, Kubernetes kills and restarts it
- If the node dies, pods are rescheduled on other nodes
- Services (virtual IP) automatically route to healthy pods
- Failover time: Seconds (pod restart) to minutes (node failure)

### PostgreSQL with Patroni
- Patroni manages PostgreSQL high availability
- Uses etcd/ZooKeeper/Consul for leader election
- Automatic failover with data safety checks
- Prevents split-brain using distributed consensus
- Configurable maximum lag for promotion

---

## 🎤 Interview Questions & Expected Answers

### Q1: "What's the difference between active-passive and active-active failover?"

**Expected answer:**
> "In **active-passive**, one server handles all traffic (active) while another sits idle as a backup (passive). When the active fails, the passive is promoted. It's simpler but wastes resources — the passive server does nothing during normal operation.
>
> In **active-active**, all servers handle traffic simultaneously. When one fails, the remaining servers absorb its load. It's more efficient (no idle resources) but more complex — you need to handle concurrent writes, data consistency, and conflict resolution.
>
> I'd choose active-passive for databases (simpler consistency model, one writer at a time). I'd choose active-active for stateless application servers (easy — just add more behind a load balancer) and for multi-region deployments where each region serves its local users.
>
> An important nuance for active-active: each server must have spare capacity. If you have 3 servers and need to survive 1 failure, run each at ~66% capacity so 2 servers can handle 100% of the load."

---

### Q2: "What is split-brain and how do you prevent it?"

**Expected answer:**
> "Split-brain is when a network partition causes two nodes to both believe they are the primary. Both accept writes independently, leading to data divergence that's extremely difficult to reconcile.
>
> Prevention strategies:
>
> 1. **Quorum-based election:** Require a majority (>50%) of nodes to agree on a leader. In a 3-node cluster, 2 must agree. Only one side of a partition can have the majority, so only one primary is possible.
>
> 2. **Fencing (STONITH):** When promoting a new primary, actively shut down the old one. If you can't reach it to shut it down, cut its access to shared storage.
>
> 3. **Fencing tokens:** Each new leader gets a monotonically increasing token. Shared resources (storage) reject operations with old tokens.
>
> 4. **Lease-based leadership:** The primary holds a time-limited lease. It must renew before expiry. If partitioned, it can't renew, so it must stop accepting writes. The standby waits for the lease to expire before taking over.
>
> 5. **Odd number of nodes:** Always use 3, 5, or 7 nodes — never 2. With 2 nodes and a partition, neither has a majority."

---

### Q3: "Your database just failed over to the standby. What could go wrong?"

**Expected answer:**
> "Several things:
>
> 1. **Data loss:** If replication was asynchronous, the standby might be missing recent writes. The gap depends on replication lag at the moment of failure. For a system with 200ms lag, you could lose up to 200ms of transactions.
>
> 2. **Connection storm:** All clients that were connected to the old primary try to reconnect simultaneously. This can overwhelm the new primary. Mitigation: client-side backoff with jitter, connection pooling.
>
> 3. **Cold cache:** The standby's buffer pool (in-memory cache of database pages) may not be warm. The first queries after failover hit disk more often, causing higher latency. Mitigation: keep the standby warm by running read traffic through it.
>
> 4. **DNS propagation:** If the failover changes the DNS record, clients with cached old DNS entries may still try to reach the dead server. Mitigation: use low TTL or virtual IPs.
>
> 5. **Split-brain:** If the old primary recovers while the new one is active, you could have two primaries. Mitigation: fencing, quorum-based election.
>
> 6. **Replication chain disruption:** If there were read replicas replicating from the old primary, they need to be reconfigured to replicate from the new primary.
>
> To prepare for these: test failover regularly, have runbooks, use synchronous replication for critical data, and implement proper health checks and circuit breakers in the application."

---

### Q4: "How would you design a zero-downtime failover for a critical payment service?"

**Expected answer:**
> "For a payment service, I need to ensure zero data loss and minimal disruption:
>
> **Database layer:**
> - PostgreSQL with synchronous replication (no data loss on failover)
> - Patroni for automatic failover with etcd for leader election
> - Fencing to prevent split-brain
> - Expected failover time: <30 seconds
>
> **Application layer:**
> - Multiple stateless app servers behind a load balancer
> - If one crashes, the LB routes to others instantly (zero downtime)
> - Connection pool with automatic retry to handle brief DB disconnection during failover
>
> **Client resilience:**
> - Idempotency keys on all payment requests (safe retries)
> - Client retries with exponential backoff (handles the ~30s DB failover window)
> - Circuit breaker that returns 'please try again later' rather than timing out
>
> **Transaction safety:**
> - All payments use database transactions (ACID)
> - Idempotency keys stored in DB — duplicates are caught even after failover
> - Reconciliation job compares our records with payment processor daily
>
> **Testing:**
> - Monthly failover drills
> - Chaos engineering in staging (kill primary, verify automatic recovery)
> - Measure: failover time, data loss, transaction success rate during failover"

---

## 🧠 Mental Model

```
Think of failover like a relay race:

🏃 Runner 1 (Primary) is running with the baton (handling requests)
🏃 Runner 2 (Standby) is running alongside, ready to take the baton

If Runner 1 trips and falls:
  
  ACTIVE-PASSIVE: Runner 2 grabs the baton from where Runner 1 dropped it
                  Brief delay while they pick it up, but the race continues.
  
  ACTIVE-ACTIVE:  Both runners were carrying their own batons (sharing the load)
                  Runner 2 just keeps running. No baton handoff needed.
                  But they need to make sure they're running the same race (data consistency).

The key metrics:
  - Detection time: How quickly do we notice Runner 1 fell? (heartbeat interval)
  - Recovery time: How quickly does Runner 2 take over? (failover mechanism)
  - Data loss: Did Runner 1 drop any batons during the fall? (replication lag)
  - False positive: Did we make Runner 2 take over when Runner 1 just stumbled? (split brain risk)
```
