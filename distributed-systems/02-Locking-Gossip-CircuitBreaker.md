# 🔐 Distributed Locking, Gossip Protocol & Circuit Breaker — Deep Dive

## 1. Distributed Locking

### The Problem
In a single-process application, you use a mutex/lock. In a distributed system, multiple processes on different machines need to coordinate access to a shared resource.

```
Service Instance A: "I'm processing order #123"
Service Instance B: "I'm ALSO processing order #123" ← DISASTER! Double processing!
```

### Distributed Lock Requirements
1. **Mutual exclusion:** Only one client holds the lock at a time
2. **Deadlock-free:** Lock is eventually released (even if holder crashes)
3. **Fault tolerant:** Lock service is highly available

### Implementation Approaches

#### Redis-based (Most Common)
```
ACQUIRE: SET lock:order:123 <unique_id> NX PX 30000
  NX = only set if not exists
  PX = auto-expire in 30,000ms (30 seconds)

RELEASE (Lua script for atomicity):
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
  
  (Only delete if WE hold the lock — prevents releasing someone else's lock)
```

**Why unique_id matters:**
```
Client A acquires lock → pauses (GC, network delay) → lock expires (TTL)
Client B acquires lock (A's lock expired)
Client A resumes → tries to release lock → WOULD RELEASE B's LOCK!

With unique_id: A's release checks if the lock value matches A's ID. It doesn't, so A doesn't release B's lock.
```

#### Redlock (Redis Multi-Instance)
To avoid relying on a single Redis instance:
1. Try to acquire lock on 5 independent Redis instances
2. Lock is acquired if successful on ≥3 (majority)
3. Lock validity time = original TTL - time taken to acquire

**Controversy:** Martin Kleppmann argues Redlock isn't safe because clock drift and process pauses can cause safety violations. Redis creator Salvatore Sanfilippo disagrees. In practice, use fencing tokens for safety.

#### ZooKeeper-based (Strongest Guarantees)
```
1. Create ephemeral sequential znode: /locks/order-123/lock-000001
2. List all children of /locks/order-123/
3. If my znode has the LOWEST sequence number → I have the lock!
4. Otherwise → set a watch on the znode just BEFORE mine → wait
5. When that znode is deleted → re-check → maybe I'm now lowest → acquire lock!
```

**Why ephemeral znodes?** If the lock holder crashes, its session expires, ZooKeeper automatically deletes the ephemeral znode → lock is released → no stuck locks.

#### Fencing Tokens — The Safety Net

```
Process A acquires lock, gets fencing token #33
Process A pauses (long GC pause)
Lock expires (TTL), Process B acquires lock, gets fencing token #34
Process A wakes up, thinks it has the lock
Process A → sends request to storage with token #33
Storage: "I already saw token #34 (which is > #33). Rejecting #33."

Safety preserved! Even though Process A thought it had the lock,
the storage layer rejects its stale operation.
```

**Key insight:** The distributed lock is a best-effort coordination mechanism. For true safety, the downstream resource must validate fencing tokens.

---

## 2. Gossip Protocol

### What It Is
A peer-to-peer communication protocol where nodes periodically exchange state information with random peers, like a rumor spreading through a crowd.

### How It Works
```
Round 1: Node A randomly picks Node B → shares its state
         "I'm alive, I last heard from C at t=100, D's data version is 5"

Round 2: Node B randomly picks Node E → shares everything it knows
         "A is alive, C was seen at t=100, D's data version is 5"

Round 3: Node E randomly picks Node F → shares... 

After O(log N) rounds → ALL nodes have the information
```

### Properties
- **Scalable:** Each node only talks to 1-3 random peers per round (not all N nodes)
- **Fault tolerant:** No SPOF, no coordinator. Works even if many nodes fail.
- **Eventually consistent:** Information propagates in O(log N) rounds
- **Probabilistic:** Very high probability (approaching 100%) of convergence, but not guaranteed

### Types of Gossip

**Anti-entropy gossip:** Nodes compare their full state → resolve all differences.
- Heavy but thorough. Used for periodic full reconciliation.

**Rumor mongering:** Nodes only spread NEW information (like gossip about news).
- Light and fast. Used for time-sensitive updates.

### Real-World Uses

| System | Gossip Use |
|--------|-----------|
| **Cassandra** | Cluster membership, failure detection, schema changes. Every node gossips every second. |
| **DynamoDB** | Ring membership and failure detection |
| **Consul/Serf** | Membership management, health checking across the cluster |
| **Redis Cluster** | Node discovery, failure detection, configuration propagation |
| **Bitcoin** | Transaction and block propagation across the network |

---

## 3. Circuit Breaker Pattern

### The Cascading Failure Problem

```
User → [API Gateway] → [Order Service] → [Payment Service] (SLOW/DEAD)

Payment Service responds in 30 seconds (or not at all).
Order Service: 100 threads all waiting for Payment Service.
Order Service: No threads left → can't handle ANY requests.
API Gateway: times out waiting for Order Service.
User: sees error. System is effectively DOWN.

One service failure → cascading failure through the entire system.
```

### Circuit Breaker Solution

```
         ┌─────────────────────────────────────┐
         │                                     │
    ┌────▼─────┐    failure rate    ┌──────────┴──┐    cooldown    ┌────────────┐
    │  CLOSED   │  > threshold (50%)│    OPEN      │    timer      │ HALF-OPEN  │
    │ (normal)  │ ─────────────────→│(fast-fail)   │ ────────────→ │(test probe)│
    └───────────┘                   └──────────────┘               └─────┬──────┘
         ▲                                                               │
         │                          success                              │
         └──────────────────────────────── ←─────────────────────────────┘
                                    failure → back to OPEN
```

### Configuration Parameters

| Parameter | Description | Typical Value |
|-----------|-------------|---------------|
| **Failure threshold** | % or count of failures to trip | 50% of last 20 calls, or 5 consecutive |
| **Timeout** | Time before trying again (OPEN → HALF-OPEN) | 30-60 seconds |
| **Success threshold** | Successes needed to close (HALF-OPEN → CLOSED) | 3 consecutive |
| **Sliding window** | Time window for tracking failures | 10-60 seconds |
| **Slow call threshold** | Call duration considered "slow" (counted as failure) | 2× normal p99 |

### Fallback Strategies

| Strategy | Description | Example |
|----------|-------------|---------|
| **Cache** | Return last known good response | Show cached recommendations |
| **Default** | Return a hardcoded default value | Show "Popular Items" instead of personalized |
| **Graceful degradation** | Return partial response | Show product without reviews |
| **Queue for retry** | Accept and process later | "Order received, processing shortly" |
| **Alternative service** | Call a backup service | Fall back to a secondary payment provider |

### Real-World Example: Netflix Hystrix (now Resilience4j)

Netflix's API gateway calls 100+ microservices. Without circuit breakers, any one failing service could take down the entire platform.

```
User opens Netflix → API calls:
  - User Profile Service ✓
  - Recommendation Service (circuit OPEN → fallback: show "Popular in US") ⚠️
  - Continue Watching Service ✓
  - Trending Service ✓
  - New Releases Service ✓

Result: User sees the homepage. Recommendations are generic but everything else works.
Without circuit breaker: Page times out entirely → user sees error.
```

---

## 🎤 Interview Questions & Expected Answers

### Q1: "How would you implement a distributed lock for preventing double-processing of orders?"

**Expected answer:**
> "I'd use Redis-based locking with fencing tokens:
>
> **Acquire lock:**
> ```
> SET lock:order:{order_id} {worker_id}:{fencing_token} NX PX 30000
> ```
> NX ensures only one worker gets the lock. PX sets a 30-second TTL to prevent deadlocks if the worker crashes.
>
> **Process the order with fencing token:**
> The fencing token (monotonically increasing) is passed with every operation on the order. The order database checks: 'Is this fencing token ≥ the last token I saw for this order?' If not, reject.
>
> **Release lock (atomic Lua script):**
> Only release if the lock value matches my worker ID + fencing token. This prevents accidentally releasing another worker's lock.
>
> **Why not ZooKeeper?** Redis is simpler to operate and sufficient for most use cases. If I need stronger guarantees (and can tolerate higher latency), I'd use ZooKeeper or etcd with ephemeral nodes.
>
> **Additional safety:** Make the order processing idempotent. Even if the lock fails edge case occurs, reprocessing the same order is a no-op (check order status before processing: if already processed, skip)."

### Q2: "Explain the gossip protocol and where you'd use it."

**Expected answer:**
> "The gossip protocol is a peer-to-peer communication method where each node periodically shares information with random peers, like a rumor spreading through a crowd.
>
> **How it works:** Every second, each node picks 1-3 random peers and exchanges state (who's alive, what version of data they have). After O(log N) rounds, all N nodes converge to the same state.
>
> **Properties:**
> - Decentralized: no coordinator, no SPOF
> - Scalable: each node only communicates with a few peers
> - Fault tolerant: works even if many nodes fail
> - Eventually consistent: converges within seconds for clusters of thousands
>
> **Where I'd use it:**
> - **Cluster membership:** Detecting which nodes are alive (Cassandra, Consul)
> - **Failure detection:** If Node A hasn't been mentioned in gossip for 30 seconds, it's probably dead
> - **Configuration propagation:** Spread config changes across the cluster
> - **Aggregate computing:** Compute cluster-wide statistics (total load, average temperature)
>
> **Where I wouldn't use it:** When strong consistency is needed immediately. Gossip is eventually consistent — there's a brief window where different nodes have different views."

### Q3: "What is the circuit breaker pattern and why is it essential for microservices?"

**Expected answer:**
> "The circuit breaker prevents cascading failures by automatically stopping requests to a failing service.
>
> **Without circuit breaker:** Service A calls Service B. B is slow (5s timeout). A's thread pool fills up waiting for B. A can't handle ANY requests. A's callers start failing. Entire system cascades into failure.
>
> **With circuit breaker:** After detecting B is failing (e.g., 50% failure rate in last 20 calls), A's circuit breaker 'opens.' All subsequent calls to B immediately return a fallback response (cached data, default value, or a friendly error). No threads are wasted waiting.
>
> After a cooldown period (30 seconds), the circuit goes to 'half-open' — one test request is sent to B. If it succeeds, the circuit closes (B has recovered). If it fails, the circuit stays open for another cooldown.
>
> **Why it's essential for microservices:**
> 1. Prevents resource exhaustion (threads, connections) from slow dependencies
> 2. Gives failing services breathing room to recover
> 3. Provides graceful degradation instead of total failure
> 4. Combined with bulkheading (separate thread pools per dependency), it isolates failures completely
>
> I'd implement it at the API gateway level for external services, and within each microservice for inter-service calls. Libraries like Resilience4j (Java), Polly (.NET), or custom middleware handle this."
