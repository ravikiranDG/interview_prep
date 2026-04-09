# 🤝 Consensus, Service Discovery & Heartbeats — Deep Dive

## 1. Consensus Algorithms

### The Fundamental Problem

In a distributed system, nodes can crash and networks can partition. How do N nodes agree on a single value (leader, transaction commit, configuration change) even when some nodes fail?

### Raft — The Understandable Consensus

Raft was designed to be easier to understand than Paxos. It guarantees that a cluster of N nodes can tolerate (N-1)/2 failures.

**Three roles:** Leader, Follower, Candidate.

```
Normal operation (stable leader):
  Client → [Leader] → appends to log → replicates to [Follower 1, Follower 2]
           → majority ACK → entry committed → response to client

Leader election (leader dies):
  [Follower] timeout → becomes [Candidate] → requests votes from all nodes
  → receives majority votes → becomes new [Leader]
  → sends heartbeats to assert leadership
```

**Key guarantees:**
1. **Election safety:** At most one leader per term
2. **Leader append-only:** Leader never overwrites its log
3. **Log matching:** If two logs have an entry with same index and term, all preceding entries are identical
4. **Leader completeness:** If an entry is committed, it appears in all future leaders' logs

**How leader election works:**
```
Term 1: Leader = Node A (sends heartbeats every 150ms)
Node A crashes.
Nodes B, C, D don't receive heartbeats for 300ms (election timeout, randomized 150-300ms).
Node B (timeout first) becomes Candidate for Term 2, votes for itself.
Node B requests votes from C, D.
C votes for B ✓, D votes for B ✓ → B wins (3 out of 4 = majority).
Node B becomes Leader for Term 2, starts sending heartbeats.
```

**Randomized election timeout is crucial:** Without it, all followers would become candidates simultaneously, split the vote, and never elect a leader. The random timeout (150-300ms) ensures one node usually times out first and wins.

**Used by:** etcd, CockroachDB, TiKV, Consul, RethinkDB.

### Paxos

The original consensus algorithm (Leslie Lamport, 1989). Proven correct but notoriously difficult to implement.

Three roles: **Proposer**, **Acceptor**, **Learner**.

**Phase 1 (Prepare):**
```
Proposer → "Prepare(n)" → Acceptors
Acceptors → "Promise: I won't accept proposals < n" → Proposer
```

**Phase 2 (Accept):**
```
Proposer → "Accept(n, value)" → Acceptors (if majority promised)
Acceptors → "Accepted" → Learner
```

**Used by:** Google Chubby, original Google Spanner.

### When Consensus Matters in System Design
- **Leader election:** Who is the primary database node?
- **Distributed locks:** Coordination across services
- **Configuration management:** All nodes must see the same config
- **Log replication:** Committing entries to a replicated log (like Kafka's ISR)

---

## 2. Service Discovery

### The Problem
In a dynamic environment (Kubernetes, auto-scaling), services come and go. IP addresses change constantly. How does Service A find Service B?

### Client-Side Discovery
```
Service A → [Service Registry (Consul/Eureka)] → "Service B is at 10.0.1.5, 10.0.1.6, 10.0.1.7"
Service A → picks 10.0.1.6 (client-side load balancing) → calls Service B
```

**Pros:** No extra network hop (client calls directly). Client can implement smart routing.
**Cons:** Every client needs discovery logic. Each language needs its own implementation.
**Example:** Netflix Eureka + Ribbon.

### Server-Side Discovery
```
Service A → [Load Balancer / DNS] → routes to Service B instance
Service A doesn't know or care which instance it reaches.
```

**Pros:** Simple client (just call the LB address). Language-agnostic.
**Cons:** Extra network hop through the LB.
**Example:** Kubernetes Services (ClusterIP), AWS ELB.

### Service Mesh (Sidecar Pattern)
```
[Service A] → [Envoy Sidecar A] ──→ [Envoy Sidecar B] → [Service B]
                (handles discovery, load balancing, TLS, retries, metrics)
```

Each service has a sidecar proxy that handles all network concerns. The service just calls `localhost`.

**Pros:** Zero application code changes. Consistent behavior across all services.
**Cons:** Resource overhead (extra container per service). Operational complexity.
**Examples:** Istio + Envoy, Linkerd, Consul Connect.

### Kubernetes Service Discovery
```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
    - port: 80
      targetPort: 8080
```

Other pods call `http://user-service` or `http://user-service.default.svc.cluster.local`.
Kubernetes DNS resolves to a ClusterIP, which load-balances across matching pods.

---

## 3. Heartbeats

### How Heartbeats Work

```
Node → ♥ → Monitor  (every 2 seconds)
Node → ♥ → Monitor
Node → ♥ → Monitor
Node → ✗ → Monitor  (missed!)
Node → ✗ → Monitor  (missed!)
Node → ✗ → Monitor  (missed! — 3 misses = 6 seconds)
Monitor: "Node is DEAD" → trigger failover
```

### Heartbeat Parameters and Tradeoffs

| Parameter | Short Value | Long Value |
|-----------|------------|-----------|
| **Interval** | Fast detection, more network traffic, more false positives | Slower detection, less traffic, fewer false positives |
| **Timeout (misses)** | Fast detection, more false positives | Slower detection, more accurate |

**Typical production values:**
- Kubernetes liveness probe: every 10s, 3 failures = 30s to detect
- Consul: every 10s, deregister after 90s
- Redis Sentinel: every 1s, 30s timeout

### Heartbeat Patterns

**Centralized:** All nodes heartbeat to a central monitor.
- Simple but monitor is a SPOF.
- Used by: Kubernetes (kubelet → API server), load balancer health checks.

**Peer-to-peer:** Nodes heartbeat each other.
- No SPOF but O(n²) network traffic.
- Impractical for large clusters.

**Gossip-based:** Nodes periodically share their view of which nodes are alive.
- Scalable, no SPOF, eventually consistent.
- Used by: Cassandra, Consul, Redis Cluster.

---

## 🎤 Interview Questions & Expected Answers

### Q1: "How does leader election work in a distributed system?"

**Expected answer:**
> "Leader election ensures exactly one node acts as the leader at any time, even during failures. The most common approach is using a consensus algorithm like Raft:
>
> 1. All nodes start as followers. A follower becomes a candidate if it doesn't hear from a leader within a randomized timeout.
> 2. The candidate votes for itself and requests votes from all other nodes.
> 3. Each node votes for at most one candidate per term (first-come-first-served).
> 4. If a candidate receives votes from a majority (> N/2), it becomes the leader.
> 5. The leader sends periodic heartbeats to maintain its authority.
> 6. If the leader fails, followers time out and a new election starts.
>
> **Key safety properties:**
> - Only one leader per term (ensured by majority voting — only one candidate can get majority)
> - The randomized election timeout prevents perpetual split votes
> - A stale leader from a previous term is rejected (nodes track the current term number)
>
> In practice, I'd use an existing implementation (etcd, ZooKeeper, Consul) rather than implementing consensus from scratch. These are battle-tested and handle edge cases that are notoriously tricky."

### Q2: "How does service discovery work in a microservices architecture?"

**Expected answer:**
> "In a dynamic microservices environment, services need to find each other without hardcoded addresses. Three approaches:
>
> **1. DNS-based (simplest, Kubernetes default):**
> Each service gets a DNS name (`user-service.default.svc.cluster.local`). Kubernetes DNS resolves it to a ClusterIP that load-balances across healthy pods. Simple but limited (DNS caching can cause stale routing, no sophisticated load balancing).
>
> **2. Service registry (Consul, Eureka):**
> Services register on startup, deregister on shutdown. The registry health-checks services and removes unhealthy ones. Clients query the registry to find service instances. More flexible — supports metadata, tags, health status.
>
> **3. Service mesh (Istio/Envoy):**
> Each service has a sidecar proxy. The proxy handles discovery, load balancing, retries, circuit breaking, and mTLS — all transparently. Zero application code changes. Most feature-rich but highest operational complexity.
>
> For most systems, I'd start with Kubernetes DNS-based discovery. If I need advanced routing (canary deployments, traffic splitting, retry policies), I'd add a service mesh."

### Q3: "How would you detect if a node in your distributed system has failed?"

**Expected answer:**
> "Node failure detection is done through heartbeats and health checks:
>
> **Heartbeat mechanism:** Each node periodically sends a signal (heartbeat) to a monitor or peers. If a node misses several consecutive heartbeats (e.g., 3 misses at 5-second intervals = 15 seconds), it's declared dead.
>
> **The tradeoff is speed vs accuracy:**
> - Short intervals (1s) + low threshold (2 misses) = fast detection (2s) but more false positives (network hiccup ≠ node failure)
> - Long intervals (10s) + high threshold (5 misses) = slow detection (50s) but fewer false positives
>
> **Phi Accrual Failure Detector (used by Cassandra):**
> Instead of a binary alive/dead threshold, it computes a 'suspicion level' (phi) based on the statistical distribution of heartbeat arrival times. If heartbeats suddenly become irregular, phi increases. This adapts to network conditions and is more accurate than fixed timeouts.
>
> **In practice:**
> - Use multiple levels: TCP health check (is the process alive?) + HTTP health check (is the application responsive?) + deep health check (are dependencies healthy?)
> - Combine with gossip protocol for scalability — instead of all nodes reporting to a central monitor, nodes gossip about who they've heard from
> - Never rely on a single mechanism — use defense in depth"
