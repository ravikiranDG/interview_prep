# 🛡️ Fault Tolerance — Deep Dive

## What is Fault Tolerance?

Fault tolerance is the ability of a system to continue operating correctly — possibly at a reduced level — when one or more of its components fail.

**The key idea:** Faults are inevitable. Hardware breaks, software has bugs, networks are unreliable, humans make mistakes. A fault-tolerant system doesn't prevent all faults — it ensures faults don't become failures visible to users.

**Important distinction:**
- **Fault:** Something goes wrong (a disk dies, a process crashes, a network link drops)
- **Failure:** The system stops providing its service to users
- **Fault tolerance:** Preventing faults from becoming failures

```
Fault-intolerant:  Disk dies → Database crashes → Application errors → User sees 500 error (FAILURE)
Fault-tolerant:    Disk dies → RAID rebuilds from mirror → Database continues → User notices nothing
```

---

## Fault Tolerance vs High Availability

These overlap but aren't identical:

| Aspect | High Availability | Fault Tolerance |
|--------|------------------|-----------------|
| Goal | Minimize downtime (% uptime) | Continue operating despite faults |
| Approach | Redundancy + fast failover | Redundancy + no downtime at all |
| During failure | Brief interruption acceptable (failover time) | Zero interruption (instant, transparent) |
| Example | DB failover takes 30 seconds | RAID mirror — disk fails, zero impact |
| Cost | Less expensive | More expensive (requires more redundancy) |

**HA** accepts brief downtime during failover. **Fault tolerance** aims for zero downtime.

A truly fault-tolerant system is always highly available. But a highly available system may not be fully fault-tolerant (it has brief failover periods).

---

## Types of Faults

### 1. Hardware Faults
- **Disk failures:** Mechanical HDDs have ~2% annual failure rate. SSDs are more reliable but not immune.
- **Memory errors:** Bit flips from cosmic rays, manufacturing defects. ECC RAM detects/corrects single-bit errors.
- **CPU failures:** Rare but possible. Overheating, manufacturing defects.
- **Power failures:** Power supply dies, UPS runs out, data center power outage.
- **Network hardware:** NIC failures, switch failures, cable damage.

**Characteristic:** Random, independent failures. One disk dying doesn't cause another to die (usually).

### 2. Software Faults
- **Bugs:** Logic errors, edge cases, race conditions. Often lurk dormant until triggered by specific input or conditions.
- **Memory leaks:** Gradual resource exhaustion until the process crashes.
- **Deadlocks:** Two processes waiting for each other forever.
- **Configuration errors:** Bad config pushed to production (the #1 cause of outages at Google per their SRE book).
- **Dependency failures:** A third-party API changes behavior or goes down.

**Characteristic:** Can be correlated — a bug in shared code affects ALL instances simultaneously. This is why software faults are often more dangerous than hardware faults.

### 3. Network Faults
- **Packet loss:** Some messages never arrive.
- **High latency:** Messages arrive but very slowly (worse than complete failure — causes timeouts and retries).
- **Network partition:** Two parts of the system can't communicate.
- **DNS failure:** Can't resolve hostnames to IP addresses.

**Characteristic:** Often partial and intermittent, making them hard to detect and handle.

### 4. Human Faults
- **Operational errors:** Wrong command run on production, wrong button clicked.
- **Design errors:** Architectural decisions that create hidden failure modes.
- **Deployment errors:** Deploying buggy code or bad configuration.

**Characteristic:** The most common source of outages (70-80% by most studies).

---

## Fault Tolerance Techniques

### 1. Redundancy

The most fundamental technique — have backup copies of everything.

**Hardware redundancy:**
```
RAID (disks):
  RAID 0: Striping (fast, but NOT fault tolerant — ANY disk failure loses data)
  RAID 1: Mirroring (exact copy on 2 disks — survives 1 disk failure)
  RAID 5: Distributed parity (survives 1 disk failure, better space efficiency)
  RAID 6: Double parity (survives 2 disk failures)
  RAID 10: Mirrored stripes (performance + fault tolerance)

Power:
  Dual power supplies + UPS + Diesel generator (three levels of backup)

Network:
  Dual NICs, redundant switches, multiple ISPs
```

**Software redundancy:**
```
Application:
  N instances behind a load balancer
  If one crashes, others continue serving

Database:
  Primary + Replica(s)
  Synchronous replication = zero data loss
  Automatic failover

Cache:
  Redis Cluster with replicas
  Cache data replicated across nodes
```

**Information redundancy:**
```
Checksums:     Detect data corruption
Error-correcting codes (ECC):  Detect AND correct bit errors
Erasure coding:  Store data + parity blocks. Reconstruct from any subset.
                S3 uses this — stores data across multiple AZs, can reconstruct
                even if an AZ is lost
```

### 2. Replication

Maintaining identical copies of data or services across multiple locations.

**Synchronous replication:**
```
Client → Primary → writes data → waits for Replica to confirm → ACK to client
Pros: Zero data loss, strong consistency
Cons: Higher latency (must wait for replica), lower throughput
```

**Asynchronous replication:**
```
Client → Primary → writes data → ACK to client immediately
         Primary → replicates to Replica in background
Pros: Low latency, high throughput
Cons: Possible data loss if primary fails before replication completes
```

**Chain replication:**
```
Client → [Head] → [Middle] → [Tail] → ACK to client
Reads served from Tail (always has committed data)
Writes go through the chain
Pros: Strong consistency + high throughput (reads don't hit the head)
```

### 3. Isolation / Bulkheading

**Inspired by ship design:** Ships have compartments (bulkheads) separated by watertight doors. If one compartment floods, the ship stays afloat because other compartments are isolated.

**In software:**

**Thread pool isolation:**
```
BAD: One thread pool for all service calls
  → Slow Service X uses all threads → Service Y calls timeout → Everything fails

GOOD: Separate thread pool per dependency
  [Thread Pool for Service X: 20 threads]
  [Thread Pool for Service Y: 20 threads]  
  [Thread Pool for Service Z: 20 threads]
  → Service X is slow → only its 20 threads are affected → Y and Z work fine
```

**Process isolation:**
```
Run each microservice in its own process/container
  → One service's memory leak doesn't affect others
  → One service's crash doesn't bring down others
```

**Data isolation (database per service):**
```
  [User Service] → [User DB]     
  [Order Service] → [Order DB]   (separate databases)
  [Payment Service] → [Payment DB]
  
  → Order DB is slow → only Order Service is affected
  → User and Payment services continue working
```

**Deployment isolation:**
```
Deploy services independently
  → A bad deploy of Service A doesn't affect Service B
  → Can roll back Service A without touching anything else
```

### 4. Circuit Breaker Pattern

**The problem:** When a downstream service is failing, your service keeps calling it, each call timing out after 5 seconds. Your threads pile up waiting. Eventually YOUR service also dies. This is a cascading failure.

**The solution:** A circuit breaker that automatically stops calling the failing service.

```
         Failures < threshold                 After timeout period
    ┌──────────┐              ┌──────────┐              ┌────────────┐
    │  CLOSED  │──failures──→ │   OPEN   │──timeout──→  │ HALF-OPEN  │
    │ (normal) │ > threshold  │(fast-fail)│              │ (test one) │
    └──────────┘              └──────────┘              └──────┬─────┘
         ▲                         ▲                          │
         │         success         │        failure           │
         └─────────────────────────┴──────────────────────────┘
```

**States:**
1. **CLOSED:** Normal operation. Count failures. If failures exceed threshold (e.g., 50% of last 20 calls) → trip to OPEN.
2. **OPEN:** Immediately return error/fallback for all requests. Don't call the downstream service at all. After timeout (e.g., 30 seconds) → move to HALF-OPEN.
3. **HALF-OPEN:** Allow ONE test request through. If it succeeds → CLOSED (recovered). If it fails → back to OPEN.

**Fallback strategies when circuit is open:**
- Return cached data (might be stale, but better than an error)
- Return a default value ("recommendations unavailable, showing popular items")
- Return a degraded response (search results without personalization)
- Queue the request for later processing

**Real-world example:** Netflix's Hystrix library (now replaced by Resilience4j). When their recommendation service is slow, the circuit breaker opens, and they show generic recommendations instead of personalized ones.

### 5. Retry with Exponential Backoff and Jitter

**The problem:** Transient failures (momentary network blip, temporary overload) can be resolved by retrying. But naive retries can make things worse.

**Naive retry (BAD):**
```
1000 clients → request fails → all 1000 retry immediately → server gets 2000 requests → crashes harder
```

**Exponential backoff (BETTER):**
```
Attempt 1: immediate
Attempt 2: wait 1 second
Attempt 3: wait 2 seconds
Attempt 4: wait 4 seconds
Attempt 5: wait 8 seconds
(give up after N attempts)
```

**Exponential backoff + jitter (BEST):**
```
Attempt 1: immediate
Attempt 2: wait random(0, 1 second)
Attempt 3: wait random(0, 2 seconds)
Attempt 4: wait random(0, 4 seconds)
(jitter prevents all clients from retrying at exactly the same time)
```

**AWS recommendation:** Full jitter gives the best spread:
```
sleep = random(0, min(cap, base × 2^attempt))
```

### 6. Timeout Management

**Every external call MUST have a timeout.** Without one, a hung connection can block a thread forever, and eventually your application runs out of threads and becomes unresponsive.

```
BAD:   response = http.get("https://slow-service/api")  // no timeout → could hang forever
GOOD:  response = http.get("https://slow-service/api", timeout=2s)  // fails fast after 2 seconds
```

**Types of timeouts:**
- **Connection timeout:** How long to wait to establish a connection (short: 1-5s)
- **Read timeout:** How long to wait for a response after connecting (varies: 2-30s)
- **Total timeout:** Maximum total time for the entire operation

**Setting appropriate timeouts:**
- Too short → false failures (service was just slow, not dead)
- Too long → thread blocked for too long → reduces capacity
- Good practice: Set timeout to p99.9 latency of the downstream service + some buffer

### 7. Graceful Degradation

When under stress or partial failure, reduce functionality rather than failing completely.

**Examples:**

| Failure | Graceful Degradation |
|---------|---------------------|
| Recommendation engine down | Show generic "popular items" instead |
| Image processing slow | Serve lower-resolution images |
| Search cluster overloaded | Return results from cache (slightly stale) |
| Payment service slow | Queue orders, process when service recovers |
| Authentication service down | Allow recently-authenticated users (cached sessions) but block new logins |
| Analytics service down | Drop analytics events silently (non-critical) |

**Netflix's graceful degradation levels:**
1. Full functionality (everything works)
2. Personalized content unavailable → show generic popular content
3. Search degraded → show pre-computed results
4. New signups disabled → existing users can still watch
5. Some titles unavailable → core library still available

### 8. Idempotent Operations

Essential for fault tolerance because retries are inevitable.

```
Without idempotency:
  Client → "Transfer $100" → timeout (did it work??) → retry → "Transfer $100" → $$$ (charged twice!)

With idempotency:
  Client → "Transfer $100 (ID: abc-123)" → timeout → retry → "Transfer $100 (ID: abc-123)"
  Server → "Already processed abc-123" → return original result (charged once ✓)
```

---

## Fault Tolerance in Real-World Systems

### Netflix (The Gold Standard)
Netflix assumes everything fails, all the time. Their approach:
- **Chaos Monkey:** Randomly kills production instances
- **Chaos Kong:** Simulates entire region failures
- **Fallbacks everywhere:** Every service call has a fallback
- **Bulkheading:** Separate thread pools per dependency
- **Circuit breakers:** Stop calling failing services
- **Multi-region active-active:** Can survive an entire AWS region going down
- **EVCache:** Multi-layered caching so reads work even when databases are slow

### Amazon DynamoDB
- Data replicated across 3 AZs (erasure coding + replication)
- Automatic failover if an AZ goes down
- Request routers detect and route around failed storage nodes
- Consistent hashing ensures minimal data movement during failures

### Google Spanner
- Data replicated across data centers globally
- Paxos consensus for writes (every write is committed to majority of replicas)
- TrueTime (atomic clocks) ensures consistent ordering globally
- Can survive entire data center failures with zero data loss

---

## Building Fault-Tolerant Systems: A Checklist

```
□ Every external call has a timeout
□ Every retryable operation is idempotent
□ Retries use exponential backoff with jitter
□ Circuit breakers protect against cascading failures
□ Thread pools are isolated per dependency (bulkheading)
□ Critical services have redundancy (minimum 2 instances)
□ Data is replicated across failure domains (AZs/regions)
□ Health checks detect and remove unhealthy instances
□ Graceful degradation is implemented for non-critical features
□ Chaos engineering validates fault tolerance regularly
□ Monitoring and alerting detect faults before users do
□ Runbooks exist for common failure scenarios
□ Backups are tested (not just created)
□ Deployments are incremental with easy rollback
```

---

## 🎤 Interview Questions & Expected Answers

### Q1: "How do you design a system that's tolerant to failures?"

**Expected answer:**
> "I approach fault tolerance at multiple levels:
>
> **Infrastructure level:**
> - Deploy across multiple availability zones (survive AZ failure)
> - Redundant components: no single points of failure
> - Auto-scaling to replace failed instances
>
> **Application level:**
> - Stateless services (any instance can handle any request)
> - Timeouts on all external calls (fail fast, don't hang)
> - Circuit breakers to prevent cascading failures
> - Retry with exponential backoff + jitter for transient failures
> - Bulkheading: isolate dependencies with separate thread pools
>
> **Data level:**
> - Database replication with automatic failover
> - Regular backups tested for restoration
> - Idempotent operations for safe retries
>
> **Design level:**
> - Graceful degradation: non-critical features fail silently
> - Async processing: queue work that doesn't need immediate completion
> - Event-driven architecture: services are loosely coupled
>
> **Operational level:**
> - Chaos engineering to validate fault tolerance
> - Monitoring and alerting for rapid detection
> - Runbooks for common failure scenarios
> - Incident response procedures tested via game days
>
> The philosophy is: faults are inevitable, failures are not."

---

### Q2: "What is a cascading failure and how do you prevent it?"

**Expected answer:**
> "A cascading failure is when the failure of one component triggers failures in dependent components, which trigger more failures, until the entire system is down.
>
> **Classic example:** Service A calls Service B. Service B becomes slow (not dead, just slow). Service A's threads are all waiting for B's responses (5-second timeouts). A runs out of threads. Now A can't handle ANY requests, including ones that don't need B. Clients of A start timing out. Services that depend on A start failing. The entire system collapses like dominoes.
>
> **Prevention:**
> 1. **Circuit breakers:** When B starts failing, A's circuit breaker opens. A immediately returns a fallback response instead of waiting. This frees A's threads to handle other work.
>
> 2. **Bulkheading:** A uses separate thread pools for calling B vs C vs D. If B's pool is exhausted, C and D's pools are unaffected. Only B-related functionality degrades.
>
> 3. **Timeouts:** Short, aggressive timeouts (e.g., 2 seconds, not 30). Fail fast rather than tying up resources.
>
> 4. **Load shedding:** When A detects it's overloaded, it starts rejecting new requests (HTTP 503) rather than accepting more than it can handle. Better to serve 70% of requests successfully than 0%.
>
> 5. **Backpressure:** When B is slow, A's queue grows. When the queue reaches a limit, A tells its callers to slow down. The overload signal propagates up the chain.
>
> 6. **Async communication:** Use message queues between services. If B is slow, messages queue up. A isn't affected because it just puts the message in the queue and moves on."

---

### Q3: "Explain the circuit breaker pattern with a real-world example."

**Expected answer:**
> "The circuit breaker pattern is like a physical circuit breaker in your house. When too much current flows (too many failures), it trips (opens), cutting the circuit to prevent damage (cascading failure). After a cooldown, you can try resetting it.
>
> **Real-world example at Netflix:**
> Their home page calls multiple services: recommendation engine, personalization, trending, continue watching, etc.
>
> If the recommendation engine starts failing:
> 1. **CLOSED state:** Normal operation. Recommendations work fine.
> 2. **Failures increase:** 60% of calls to the recommendation service fail in the last 20 seconds.
> 3. **Circuit OPENS:** The circuit breaker trips. For the next 30 seconds, all calls to the recommendation service are short-circuited — Netflix immediately returns a fallback: 'Top 10 in Your Country' instead of personalized recommendations.
> 4. **Benefits:** Users still see content (just not personalized). The recommendation service isn't being hammered by failing requests. Netflix's main thread pool isn't exhausted waiting for timeouts.
> 5. **HALF-OPEN:** After 30 seconds, one test request is sent to the recommendation service.
> 6. **If it succeeds → CLOSED:** Recommendations are back!
> 7. **If it fails → OPEN again:** Wait another 30 seconds.
>
> The user experience goes from 'Netflix is completely broken' to 'Netflix is working but recommendations seem generic today.' That's the power of the circuit breaker."

---

### Q4: "What is chaos engineering? How would you implement it?"

**Expected answer:**
> "Chaos engineering is the discipline of experimenting on a production system to build confidence in its ability to withstand turbulent conditions.
>
> **How I'd implement it:**
>
> **Step 1: Define steady state.** What does 'working correctly' look like? (e.g., p99 latency <200ms, error rate <0.1%, successful transactions/sec ~1000)
>
> **Step 2: Hypothesize.** 'If we kill one application server, the system will continue operating with no user impact because the load balancer will route to healthy servers.'
>
> **Step 3: Run the experiment.** Kill the server in production (during business hours, with engineers watching).
>
> **Step 4: Verify.** Did steady state hold? Was there user impact? Did alerting fire? How quickly did auto-recovery kick in?
>
> **Step 5: Fix.** If the hypothesis was wrong (there WAS impact), fix the issue. Then re-run the experiment.
>
> **Types of chaos experiments (progressive):**
> - Kill a single application instance (easiest)
> - Kill all instances of one service
> - Inject network latency between two services
> - Corrupt DNS for one service
> - Fill disk on a database server
> - Simulate an entire AZ failure
> - Simulate a region failure (hardest)
>
> **Safety measures:**
> - Start in staging, then move to production
> - Run during business hours (not 3 AM)
> - Have a 'big red button' to stop the experiment
> - Start small (kill 1 instance, not 10)
> - Monitor continuously during the experiment
>
> Netflix, Amazon, Google, and Microsoft all practice chaos engineering. Netflix even open-sourced their tools (Chaos Monkey, Chaos Kong via the Simian Army)."

---

### Q5: "A service your system depends on is intermittently slow (not down, just slow). How do you handle this?"

**Expected answer:**
> "Intermittent slowness is actually harder to handle than a complete outage, because the service appears to be 'working' but is degrading your system.
>
> My approach:
>
> 1. **Aggressive timeouts:** Set read timeouts to slightly above the service's normal p99 latency. If it's normally 100ms p99, set timeout to 200ms. Fail fast rather than waiting 30 seconds.
>
> 2. **Circuit breaker with latency tracking:** Some circuit breakers can trip based on latency, not just errors. If p99 exceeds 500ms, trip the circuit and use fallback.
>
> 3. **Bulkhead isolation:** Calls to this slow service get their own thread pool. Even if all 20 threads are waiting on slow responses, my main thread pool is unaffected.
>
> 4. **Request hedging:** For critical calls, send the same request to multiple instances simultaneously. Use whichever responds first. Cancel the others. This cuts tail latency dramatically. Google uses this extensively.
>
> 5. **Caching:** Cache responses from this service. When it's slow, serve from cache (stale data is better than slow or no data).
>
> 6. **Async where possible:** If the slow service isn't in the critical path, call it asynchronously. Don't make the user wait.
>
> 7. **Load shedding on the slow service side:** The slow service should detect that it's overloaded and start rejecting requests (HTTP 503 with Retry-After) rather than accepting more than it can handle.
>
> The key insight: a slow dependency is WORSE than a dead dependency. A dead service fails immediately. A slow service ties up your resources while you wait."

---

## 🧠 Mental Model

```
Think of fault tolerance like a human body:

🫀 Heart (core service):
   If it stops → fatal → must have backup (pacemaker / defibrillator = failover)

🫁 Lungs (database):
   One lung can fail → you survive with reduced capacity (graceful degradation)

🦴 Bones (infrastructure):
   Broken arm → painful but you function (isolated failure / bulkheading)

🧬 Immune system (monitoring + chaos engineering):
   Constantly testing → fighting infections before they become life-threatening
   Vaccination = chaos engineering (controlled exposure to build resilience)

🧠 Brain (orchestration):
   Detects problems → routes blood flow (load balancing) → triggers healing (auto-recovery)
   Circuit breaker = pain reflex (stop touching the hot stove!)

The body doesn't try to prevent ALL damage.
It's designed to survive damage and recover.
Your system should be too.
```
