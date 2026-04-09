# 🛡️ Reliability — Deep Dive

## What is Reliability?

Reliability is the probability that a system will perform its intended function correctly, without errors, for a given period of time under stated conditions.

**In simpler terms:** The system does what it's supposed to do, correctly, every time.

**The difference between a reliable and unreliable system:**
- Reliable: "I transferred $100 to Bob" → $100 was actually deducted from your account and added to Bob's account. Every time.
- Unreliable: "I transferred $100 to Bob" → Sometimes it works. Sometimes the money disappears. Sometimes Bob gets $200. Sometimes it times out and you're not sure what happened.

---

## Reliability vs Availability — The Critical Distinction

These two are often confused but they're fundamentally different:

| Aspect | Availability | Reliability |
|--------|-------------|-------------|
| Question | "Is the system up?" | "Is the system correct?" |
| Measure | % of time system is operational | Probability of correct operation |
| Example | System responds to requests 99.99% of the time | System returns the correct result 99.99% of the time |

**You can have one without the other:**

**Available but NOT reliable:**
- A database that is always reachable (100% uptime) but occasionally returns wrong data due to a replication bug
- An API that always responds with 200 OK but sometimes returns incorrect calculations
- A payment system that's always up but occasionally double-charges customers

**Reliable but NOT available:**
- A system that gives perfect answers when it's running, but has frequent outages
- A calculator app that's always correct but crashes every 30 minutes

**You need BOTH for a good system.** Users don't care if your system is up 99.999% of the time if 1% of transactions produce wrong results.

---

## What Makes a System Unreliable?

### Hardware Faults
- **Hard disk failure:** Mean time to failure (MTTF) of a hard disk is about 10-50 years. But if you have 10,000 disks, you'll see one fail roughly every day.
- **RAM errors:** Bit flips in memory (cosmic rays, manufacturing defects). ECC RAM detects and corrects single-bit errors.
- **Network hardware failure:** Switch failures, cable degradation, NIC failures.

**How to handle:** Redundancy. RAID for disks, ECC RAM, redundant network paths, multiple servers.

### Software Faults
- **Bugs:** Logic errors, edge cases not handled, race conditions
- **Memory leaks:** Gradual resource exhaustion until crash
- **Cascading failures:** One service slows down → backs up → overwhelms dependent services
- **Configuration errors:** A bad config push that breaks production (the #1 cause of outages at Google, per their SRE book)
- **Dependency failures:** A library update introduces a subtle bug

**How to handle:** Testing (unit, integration, chaos), code reviews, canary deployments, rollback capability, monitoring.

### Human Errors
- **The biggest source of outages.** Studies show that human errors cause 70-80% of system failures.
- Operator runs wrong command in production
- Developer deploys buggy code
- DBA runs a migration without testing
- Engineer misconfigures infrastructure

**How to handle:**
- Design systems that minimize the opportunity for human error
- Sandbox environments that mirror production
- Easy rollback mechanisms (one-click rollback)
- Detailed monitoring and alerting to catch mistakes quickly
- Runbooks and automation for common operations
- Blameless post-mortem culture (learn from mistakes, don't punish)

---

## The MTBF and MTTR Framework

**MTBF (Mean Time Between Failures):** Average time the system works between failures.
**MTTR (Mean Time To Recovery):** Average time to fix the system after a failure.
**MTTF (Mean Time To Failure):** Average time until the first failure (for non-repairable items).
**MTTD (Mean Time To Detect):** Average time to notice something is wrong.

```
Availability = MTBF / (MTBF + MTTR)
```

**Key insight:** You can improve availability by either:
1. **Increasing MTBF:** Make the system fail less often (better hardware, better code, more testing)
2. **Decreasing MTTR:** Make recovery faster (automatic failover, easy rollback, good monitoring)

**In practice, reducing MTTR is often more cost-effective than increasing MTBF.** Failures will happen; recovering quickly matters more than preventing every failure.

```
System A: Fails once per year, takes 24 hours to recover
  Availability = 8760 / (8760 + 24) = 99.73%

System B: Fails once per month, recovers in 5 minutes
  Availability = 43800 / (43800 + 5) = 99.989%

System B is MORE available despite failing 12x more often!
```

---

## Building Reliable Systems

### 1. Data Integrity (The Most Important)

If your system loses or corrupts data, it has fundamentally failed. Money disappearing, orders lost, messages vanished — these are catastrophic.

**Techniques:**
- **Checksums everywhere:** Compute checksums on data at write time, verify on read. Detect corruption early.
- **Write-ahead log (WAL):** Before making any change, write the change to a durable log. If the system crashes mid-operation, replay the log to recover.
- **Atomic operations:** Use transactions (ACID) to ensure operations are all-or-nothing.
- **Backups and point-in-time recovery:** Regular backups + continuous WAL archiving = restore to any point in time.
- **End-to-end integrity checks:** Don't just trust each layer — verify data integrity from end to end.

### 2. Idempotent Operations

**An operation is idempotent if executing it multiple times produces the same result as executing it once.**

This is crucial because in distributed systems, you WILL have retries (network timeouts, uncertain responses).

```
IDEMPOTENT:
  GET /user/123          → Always returns user 123 (safe to retry)
  PUT /user/123 {name:"Alice"}  → Always sets name to Alice (safe to retry)
  DELETE /order/456      → Deletes order 456. Second call is a no-op (safe to retry)

NOT IDEMPOTENT:
  POST /payments {amount:100}   → First call: charges $100. Retry: charges ANOTHER $100!
```

**Making non-idempotent operations idempotent:**
- **Idempotency key:** Client generates a unique ID per operation. Server checks if it's seen that ID before.
- **Database constraints:** `INSERT ... ON CONFLICT DO NOTHING`
- **State machines:** Only allow valid transitions. If payment is already in "completed" state, ignore duplicate "complete" requests.

### 3. Testing for Reliability

**Unit tests:** Test individual functions in isolation.
**Integration tests:** Test interactions between components.
**End-to-end tests:** Test complete user flows.
**Load tests:** Does the system work correctly under heavy load?
**Chaos testing:** Intentionally break things to see what happens.

**Chaos Engineering (Netflix's approach):**
- **Chaos Monkey:** Randomly kills production server instances. Forces engineers to build resilient services.
- **Chaos Kong:** Simulates an entire AWS region going down.
- **Latency Monkey:** Introduces artificial delays to test timeout handling.
- **Chaos Gorilla:** Takes out an entire availability zone.

The philosophy: "If we're going to experience failures in production anyway, let's practice failing on our terms, so we're prepared."

### 4. Monitoring and Observability

You can't fix what you can't see.

**Three pillars of observability:**
1. **Logs:** Detailed records of what happened ("User 123 failed to login: invalid password")
2. **Metrics:** Numerical measurements over time (error rate, latency p99, CPU usage)
3. **Traces:** The path of a request through multiple services (see which service was slow or failed)

**Alerting:**
- Alert on symptoms, not causes ("error rate is 5%" not "CPU is high")
- Different severity levels (page for critical, ticket for warning)
- Avoid alert fatigue (too many alerts = all alerts get ignored)

### 5. Redundancy and Replication

- **Data replication:** Multiple copies of data across machines/regions
- **Service redundancy:** Multiple instances of every service
- **Geographic redundancy:** Data and services in multiple regions

### 6. Graceful Error Handling

- **Timeouts:** Every network call should have a timeout. Without one, a stuck request can block a thread forever.
- **Retries with backoff:** On transient failure, retry with exponential backoff + jitter
  ```
  Attempt 1: immediate
  Attempt 2: wait 1s + random(0, 1s)
  Attempt 3: wait 2s + random(0, 2s)
  Attempt 4: wait 4s + random(0, 4s)
  (give up after N attempts)
  ```
- **Circuit breakers:** Stop calling a failing service to let it recover (see Distributed Systems section)
- **Fallback responses:** Return cached/default data when a dependency fails

---

## Reliability Patterns in the Real World

### Amazon — Avoiding Correlated Failures
Amazon learned that deploying new code to all servers at once (big-bang deployment) was the top cause of outages. A single bug would take down everything simultaneously.

**Solution:** Deploy to one server first. Wait. Then 1% of servers. Wait. Then 5%, 10%, 25%, 50%, 100%. At each stage, automated systems check for errors. Any spike in error rate → automatic rollback.

This is why Amazon rarely has full outages despite deploying thousands of times per day.

### Google — Defense in Depth
Google's approach to reliability is layered:
1. **Hardware level:** ECC memory, checksummed storage, redundant power supplies
2. **Software level:** Code reviews, extensive testing, staged rollouts
3. **System level:** Replication, automatic failover, load balancing
4. **Process level:** SRE teams with error budgets, post-mortems, chaos engineering

### Netflix — Expecting Failure
Netflix assumes everything will fail, all the time. Their architecture is designed so that any single component can fail without affecting the user experience.

- Every service has fallbacks
- All calls have timeouts and circuit breakers
- Data is cached aggressively at multiple levels
- They regularly kill their own instances in production (Chaos Monkey)

---

## Reliability at Different Levels

### Application Reliability
- Input validation (reject bad data early)
- Error handling (catch and handle exceptions, don't crash)
- Boundary checking (prevent buffer overflows, integer overflows)
- Connection pooling (don't exhaust database connections)
- Resource limits (prevent memory leaks, limit thread count)

### Data Reliability
- ACID transactions for critical operations
- Checksums for data integrity
- Backups tested regularly (untested backups are not backups)
- Replication across failure domains
- Audit logs for tracing issues

### Infrastructure Reliability
- Redundancy at every level (servers, disks, power, network)
- Auto-scaling to handle load spikes
- Multi-AZ / multi-region deployment
- Infrastructure as Code (reproducible, version-controlled)
- Immutable infrastructure (don't patch servers; replace them)

---

## 🎤 Interview Questions & Expected Answers

### Q1: "What's the difference between reliability and availability?"

**Expected answer:**
> "Availability is about whether the system is up and reachable. Reliability is about whether the system behaves correctly.
>
> A system can be available but unreliable — for example, a payment service that's always online but occasionally double-charges customers. It's 'up,' but it's not doing the right thing.
>
> A system can be reliable but not available — it gives correct results when it works, but it frequently goes down.
>
> For a good system, you need both. But if I had to choose, I'd prioritize reliability for systems handling money or critical data. A correct system that's sometimes down is better than an always-up system that occasionally corrupts your data."

---

### Q2: "How would you design a system that handles financial transactions reliably?"

**Expected answer:**
> "Financial systems require the highest level of reliability. Here's my approach:
>
> 1. **ACID transactions:** All database operations for a transaction (debit + credit) wrapped in a single atomic transaction. Either both happen or neither does.
>
> 2. **Idempotency:** Every transaction has a unique idempotency key. If a request is retried (due to timeout), the server detects the duplicate and returns the cached result instead of processing again. This prevents double-charging.
>
> 3. **Double-entry bookkeeping:** Every money movement has a debit entry and a credit entry. The system can verify that books balance. Any discrepancy is immediately flagged.
>
> 4. **Saga pattern for distributed transactions:** If the transaction spans multiple services (debit from bank A, credit to bank B), use a Saga with compensating transactions. If the credit fails, execute a compensating debit reversal.
>
> 5. **Reconciliation:** Daily batch job that compares our records with the bank's records. Flags any discrepancies for manual review.
>
> 6. **Audit log:** Every operation is logged immutably. We can trace exactly what happened for any transaction.
>
> 7. **State machine:** Transactions move through defined states (Created → Processing → Completed/Failed). Invalid transitions are rejected. This prevents race conditions and undefined behavior."

---

### Q3: "What is chaos engineering and why is it important?"

**Expected answer:**
> "Chaos engineering is the practice of intentionally injecting failures into a production system to discover weaknesses before they cause real outages.
>
> Netflix pioneered this with Chaos Monkey, which randomly terminates production instances. The idea is: if a single server dying causes a user-facing outage, your system isn't resilient enough, and it's better to discover this during business hours with engineers on hand than at 3 AM during peak traffic.
>
> Common chaos experiments:
> - Kill random server instances
> - Inject network latency or packet loss
> - Fill up disk space
> - Consume CPU/memory
> - Simulate an entire availability zone failure
>
> It's important because distributed systems have emergent behavior — the interactions between components create failure modes that are impossible to predict from looking at individual components. The only way to discover these is to test them in a real environment.
>
> The key principle is: run experiments in a controlled way, have a hypothesis ('we expect zero user impact'), and have a way to quickly stop the experiment if it causes unexpected problems."

---

### Q4: "How do you ensure data integrity in a distributed system?"

**Expected answer:**
> "Data integrity in a distributed system is challenging because data lives on multiple machines and networks are unreliable. Here's my approach:
>
> 1. **Checksums at every boundary:** When data is written to disk, compute a checksum. On read, verify it. When data is sent over the network, checksum the payload. This catches corruption from hardware, software bugs, or network errors.
>
> 2. **Write-ahead logging (WAL):** Before modifying data, write the intended change to a sequential log on durable storage. If the system crashes, replay the log to recover to a consistent state. This is how PostgreSQL, MySQL, and Kafka all work.
>
> 3. **Replication with consistency checks:** Maintain multiple copies and periodically compare them. Use anti-entropy mechanisms like Merkle trees to efficiently find and repair differences.
>
> 4. **Immutable data where possible:** Instead of updating records, append new versions. This eliminates update anomalies and provides a natural audit trail.
>
> 5. **End-to-end verification:** Don't just trust each layer. Periodically read data back and verify it matches what was written. Amazon S3 does this with their scrubbing process.
>
> 6. **Tested backups:** Regularly test that backups can actually be restored. An untested backup is not a backup — it's a hope."

---

### Q5: "What's MTBF and MTTR, and which is more important?"

**Expected answer:**
> "MTBF is Mean Time Between Failures — how often the system fails. MTTR is Mean Time To Recovery — how quickly you fix it after a failure.
>
> Availability = MTBF / (MTBF + MTTR).
>
> While both matter, **MTTR is generally more important and more cost-effective to improve.** Here's why:
>
> Preventing all failures is impossible in a complex distributed system. But recovering quickly from failures is achievable with good engineering:
> - Automated failover (reduce MTTR from hours to seconds)
> - Good monitoring (reduce detection time — MTTD)
> - Rollback capability (fix bad deployments in minutes, not hours)
> - Runbooks and automation (reduce human decision-making time during incidents)
>
> A system that fails monthly but recovers in 30 seconds has better availability than a system that fails yearly but takes 24 hours to recover.
>
> Google's SRE philosophy emphasizes this: they spend more effort making systems recoverable than making them unbreakable."

---

### Q6: "How would you handle a situation where you're not sure if a network request succeeded?"

**Expected answer:**
> "This is the fundamental challenge of distributed systems — network uncertainty. The request might have succeeded but the response was lost, or the request might have never arrived.
>
> My approach:
> 1. **Make the operation idempotent:** Assign a unique request ID. If I retry and the server already processed it, it returns the cached result.
>
> 2. **Use a state machine:** The operation moves through states (Pending → Processing → Completed/Failed). I can query the current state to determine what happened.
>
> 3. **Implement the 'at-least-once' + idempotency pattern:** It's safe to retry because the server handles duplicates.
>
> 4. **Add a reconciliation process:** Periodically compare expected state with actual state to catch any inconsistencies.
>
> In practice, this is why payment systems always have idempotency keys and reconciliation processes. Stripe, for example, requires an idempotency key for every charge request, so if your server crashes after sending the charge but before receiving the response, you can safely retry."

---

## 🧠 Mental Model

Think of reliability like building an airplane:

```
An airplane must:
✅ Take off, fly, and land correctly every time (correctness)
✅ Handle turbulence, engine failure, sensor malfunction (fault tolerance)
✅ Have redundant systems for everything critical (redundancy)
✅ Be tested extensively before carrying passengers (testing)
✅ Be monitored continuously during flight (observability)
✅ Have procedures for every emergency (runbooks)
✅ Learn from every incident to prevent recurrence (post-mortems)

Your distributed system should be built with the same rigor.
```

The cost of unreliability scales with the criticality of the system. A bug in a todo app is annoying. A bug in a banking system is catastrophic. Design reliability proportional to the consequences of failure.
