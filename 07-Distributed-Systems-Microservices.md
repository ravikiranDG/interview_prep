# 🧩 Distributed Systems & Microservices

These concepts come up whenever you're designing systems that span multiple machines. Understanding them sets apart junior from senior engineers.

---

## 1. Heartbeats

**What it is:** Periodic signals sent between nodes in a distributed system to indicate they're alive and functioning.

**How it works:**
```
Node A ──♥──♥──♥──♥──✗──✗──✗──→ Monitor: "Node A missed 3 heartbeats, marking as dead"
         1s  1s  1s  1s  (no heartbeat for 3 intervals)
```

**Key parameters:**
- **Heartbeat interval:** How often a heartbeat is sent (e.g., every 1-5 seconds)
- **Timeout threshold:** How many missed heartbeats before declaring a node dead (e.g., 3 misses = 3-15 seconds)

**Tradeoff:**
- Short interval + low threshold → fast failure detection BUT more false positives (network hiccup ≠ node failure)
- Long interval + high threshold → fewer false positives BUT slow failure detection

**Patterns:**
1. **Centralized monitoring:** All nodes send heartbeats to a central monitor
   - Simple but monitor is a SPOF
2. **Peer-to-peer heartbeats:** Nodes heartbeat each other
   - No SPOF but O(n²) messages
3. **Gossip-based:** Nodes gossip about who they've heard from (see Gossip Protocol below)
   - Scalable, no SPOF

**Used by:** Kubernetes (kubelet → API server), ZooKeeper, Consul, Cassandra, load balancers (health checks)

---

## 2. Service Discovery

**What it is:** The mechanism by which services find the network locations (IP + port) of other services they need to communicate with.

**The problem:** In a dynamic environment (containers, auto-scaling), services come and go. You can't hardcode IP addresses.

### Client-Side Discovery
```
Service A → [Service Registry] → "Service B is at 10.0.1.5:8080, 10.0.1.6:8080"
Service A → (picks one, calls directly) → Service B
```
- Client queries the registry and does its own load balancing
- Pros: No extra hop, client can use smart routing
- Cons: Client needs discovery logic, each language needs an implementation
- Examples: Netflix Eureka + Ribbon

### Server-Side Discovery
```
Service A → [Load Balancer] → [Service Registry] → routes to Service B
```
- Client just calls the load balancer; it handles discovery
- Pros: Simpler client, language-agnostic
- Cons: Extra network hop, load balancer is a potential bottleneck
- Examples: AWS ALB, Kubernetes Services, Nginx

### Service Mesh
```
Service A → [Sidecar Proxy A] → [Sidecar Proxy B] → Service B
```
- Each service has a sidecar proxy that handles discovery, load balancing, retries, TLS
- Service mesh control plane manages configuration
- Pros: Zero application code changes, consistent behavior
- Cons: Complexity, resource overhead
- Examples: Istio + Envoy, Linkerd

**Service registries:** Consul, etcd, ZooKeeper, Eureka
- Services register on startup, deregister on shutdown
- Registry health-checks services periodically
- Provides key-value store for configuration

---

## 3. Consensus Algorithms

**What it is:** Algorithms that allow distributed nodes to agree on a single value or decision, even if some nodes fail.

**The problem:** In a distributed system, nodes can crash or messages can be delayed/lost. How do you ensure all working nodes agree on:
- Who is the leader?
- What is the current state?
- Did this transaction commit?

### Paxos
- The original consensus algorithm (Leslie Lamport, 1989)
- Guarantees safety (never agrees on wrong value) even with failures
- Notoriously difficult to understand and implement
- Used by: Google's Chubby, original Spanner

### Raft
- "Understandable consensus" — designed to be easier than Paxos
- Same guarantees as Paxos
- Three roles: **Leader**, **Follower**, **Candidate**

```
Normal operation:
  Client → [Leader] → replicates to [Follower 1, Follower 2] → majority ACK → committed

Leader election:
  Leader fails → Followers timeout → become Candidates → request votes → majority wins → new Leader
```

**Raft key concepts:**
1. **Leader election:** Only one leader at a time, elected by majority vote
2. **Log replication:** Leader appends entries to its log, replicates to followers
3. **Safety:** A committed entry is never lost (even if leader crashes)
4. **Majority quorum:** Need (n/2 + 1) nodes to agree → tolerates (n-1)/2 failures

- Used by: etcd, CockroachDB, TiKV, Consul

### Zab (ZooKeeper Atomic Broadcast)
- Used by Apache ZooKeeper
- Similar to Raft but optimized for ZooKeeper's use case
- Ensures total order of all state changes

**Why consensus matters in interviews:**
- How does your distributed database elect a leader after a failure?
- How does your configuration service ensure all nodes see the same config?
- How does your distributed lock work?

---

## 4. Distributed Locking

**What it is:** A mechanism to ensure that only one process/node can access a shared resource at a time, across multiple machines.

**Why distributed locking is hard:**
- Network partitions: Node A has the lock, but Node B can't reach A — does B assume the lock is free?
- Clock skew: Lock TTL based on time? Different machines have different clocks.
- Process pauses: GC pause, swap → process holds lock but isn't making progress

**Approaches:**

### Database-based Lock
```sql
INSERT INTO locks (resource_id, owner, expires_at)
VALUES ('order-123', 'worker-1', NOW() + INTERVAL '30 seconds');
-- If INSERT fails (duplicate key), lock is held by someone else
```
- Simple but DB becomes a bottleneck
- Need TTL to handle crashed lock holders

### Redis-based Lock (Redlock)
```
SET resource_key owner_id NX PX 30000
-- NX: only if not exists
-- PX: auto-expire in 30 seconds
```
- Fast, widely used
- **Redlock** (Martin Kleppmann controversy): Acquire lock on majority of Redis instances
- Concern: Not perfectly safe due to clock drift and async replication

### ZooKeeper-based Lock
- Create an ephemeral sequential znode: `/locks/resource-lock-000001`
- If your znode has the lowest sequence number → you have the lock
- Watch the znode just before yours → notified when it's deleted → you get the lock
- Ephemeral nodes auto-delete if session dies → no stuck locks
- Strongest guarantees but more operational complexity

### etcd-based Lock
- Similar to ZooKeeper approach using leases
- lease = TTL-based lock
- If holder crashes, lease expires, lock is released

**Fencing tokens — solving the safety problem:**
```
Process A acquires lock with fencing token #33
Process A pauses (GC)
Lock expires, Process B acquires with fencing token #34
Process A wakes up, thinks it has the lock
Process A sends request with token #33
Resource rejects #33 because it already saw #34 (monotonically increasing)
```
- Fencing tokens ensure safety even when locks are imperfect

**Interview tip:** When designing systems with shared resources (inventory deduction, seat booking), discuss distributed locking and mention fencing tokens for safety.

---

## 5. Gossip Protocol

**What it is:** A peer-to-peer communication protocol where nodes periodically exchange state information with random peers, spreading information like a rumor.

**How it works:**
```
Round 1: Node A tells Node B: "Node C is alive, Node D has data version 5"
Round 2: Node B tells Node E: "Node A says Node C is alive, Node D has data version 5"
Round 3: Node E tells Node F: ...
→ After O(log N) rounds, ALL nodes have the information
```

**Properties:**
- **Scalable:** Each node only talks to a few peers, not all nodes
- **Fault tolerant:** No single point of failure
- **Eventually consistent:** Information propagates in O(log N) rounds
- **Simple:** Easy to implement
- **Probabilistic:** Not guaranteed to reach all nodes instantly, but probability approaches 1

**Types of gossip:**
1. **Anti-entropy:** Nodes compare their full state → resolve differences (heavy but thorough)
2. **Rumor mongering:** Nodes spread new updates to random peers (light, fast)

**Used by:**
- **Cassandra:** Cluster membership, failure detection, schema changes
- **DynamoDB:** Ring membership
- **Consul/Serf:** Cluster membership, health checking
- **Redis Cluster:** Node discovery and failover

---

## 6. Circuit Breaker

**What it is:** A design pattern that prevents cascading failures by stopping requests to a failing service, giving it time to recover.

**The problem:**
```
Service A → Service B (failing, 5s timeout per request)
Service A has 100 threads, all waiting on Service B
→ Service A runs out of threads → Service A also fails
→ Cascading failure through the entire system
```

**How it works (like an electrical circuit breaker):**

```
         ┌──────────────────────────────┐
         │                              │
    ┌────▼────┐   failures   ┌─────────┴───┐   timeout   ┌───────────┐
    │  CLOSED  │ ──────────→ │    OPEN      │ ──────────→ │ HALF-OPEN │
    │(normal)  │  > threshold│(reject all)  │             │(test one) │
    └──────────┘             └──────────────┘             └─────┬─────┘
         ▲                                                     │
         │                    success                          │
         └─────────────────────────────────────────────────────┘
                              failure → back to OPEN
```

**States:**
1. **CLOSED (normal):** Requests flow through. Track failures.
2. **OPEN (tripped):** All requests immediately fail/return fallback. No requests to downstream service.
3. **HALF-OPEN (testing):** After a timeout, allow ONE test request through.
   - If it succeeds → CLOSED (recovered!)
   - If it fails → OPEN (still broken)

**Fallback strategies when circuit is OPEN:**
- Return cached data
- Return a default value
- Return a degraded response
- Queue the request for later retry

**Libraries:** Netflix Hystrix (deprecated), Resilience4j (Java), Polly (.NET), Sentinel

**Interview tip:** Mention circuit breakers when designing microservices architectures. It shows you think about failure cascading and graceful degradation.

---

## 7. Disaster Recovery

**What it is:** Planning and infrastructure to recover from catastrophic events (data center outages, natural disasters, security breaches).

**Key metrics:**
- **RPO (Recovery Point Objective):** Maximum acceptable data loss. "How much data can we afford to lose?" → Determines backup frequency
- **RTO (Recovery Time Objective):** Maximum acceptable downtime. "How quickly must we recover?" → Determines recovery infrastructure

```
          Data Loss              Downtime
  ←──────────|─────────────────────|──────────→
            RPO                   RTO
  (last backup)               (system back up)
```

**DR strategies (increasing cost and speed):**

| Strategy | RPO | RTO | Cost |
|----------|-----|-----|------|
| **Backup & Restore** | Hours | Hours-Days | $ |
| **Pilot Light** | Minutes | Minutes-Hours | $$ |
| **Warm Standby** | Seconds-Minutes | Minutes | $$$ |
| **Active-Active (Multi-Region)** | Near-zero | Seconds | $$$$ |

**Backup & Restore:** Regular backups to another region. Restore from backups when disaster strikes.

**Pilot Light:** Core infrastructure running in DR region (database replicas), but compute is off. Spin up compute when needed.

**Warm Standby:** Scaled-down copy of production running in DR region. Scale up when needed.

**Active-Active:** Full production in multiple regions. Traffic is served from both. If one region fails, the other absorbs all traffic.

---

## 8. Distributed Tracing

**What it is:** Tracking a request as it flows through multiple services in a distributed system, recording timing and metadata at each step.

**The problem:** In a microservices architecture, a single user request might touch 10+ services. When something is slow or fails, how do you find which service is the bottleneck?

**How it works:**
```
User Request (Trace ID: abc-123)
  → API Gateway (Span 1: 2ms)
    → Auth Service (Span 2: 5ms)
    → Order Service (Span 3: 150ms) ← BOTTLENECK!
      → Payment Service (Span 4: 120ms) ← ROOT CAUSE
      → Inventory Service (Span 5: 10ms)
    → Notification Service (Span 6: 8ms)
```

**Key concepts:**
- **Trace:** The entire journey of a request through the system
- **Span:** A single operation within a trace (one service call)
- **Trace ID:** Unique ID propagated across all services for one request
- **Span ID:** Unique ID for each individual operation
- **Parent Span ID:** Links child spans to their parent

**Context propagation:** Trace ID is passed via HTTP headers (e.g., `X-Trace-Id`) or message metadata, so each service can correlate its work to the original request.

**Tools:** Jaeger, Zipkin, AWS X-Ray, Datadog APM, OpenTelemetry (standard)

**What distributed tracing enables:**
- Identify slow services / bottlenecks
- Visualize request flow across services
- Debug errors across service boundaries
- Measure SLA compliance per service
- Capacity planning based on actual traffic patterns

**Interview tip:** Mention distributed tracing when discussing observability in microservices. The three pillars of observability are: **Logs** (what happened), **Metrics** (how much), and **Traces** (where/how long).
