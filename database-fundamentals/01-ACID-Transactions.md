# 🔒 ACID Transactions & Isolation Levels — Deep Dive

## ACID — The Four Pillars of Database Transactions

### Atomicity — "All or Nothing"

A transaction is an indivisible unit. Either ALL operations succeed, or NONE of them take effect.

```
Transfer $100 from Alice to Bob:
  BEGIN TRANSACTION;
    UPDATE accounts SET balance = balance - 100 WHERE user = 'Alice';  -- Step 1
    UPDATE accounts SET balance = balance + 100 WHERE user = 'Bob';    -- Step 2
  COMMIT;

If Step 2 fails (e.g., Bob's account doesn't exist):
  → ROLLBACK: Step 1 is undone. Alice's $100 is restored.
  → The database is as if the transaction never happened.
```

**How it works under the hood:** Write-Ahead Logging (WAL). Before any change is made to actual data, the intended change is written to a sequential log file on durable storage. If the system crashes mid-transaction, the WAL is replayed during recovery to undo incomplete transactions.

### Consistency — "Valid State to Valid State"

A transaction brings the database from one valid state to another. All constraints, triggers, cascades, and rules are satisfied after the transaction.

```
Constraint: CHECK (balance >= 0)

Alice has $50.
Transaction: Transfer $100 from Alice to Bob.
Step 1: Alice's balance = $50 - $100 = -$50
→ VIOLATION! balance < 0
→ Transaction is REJECTED. Database remains unchanged.
```

Consistency is enforced by the application logic AND database constraints working together.

### Isolation — "Transactions Don't Interfere"

Concurrent transactions behave as if they're executed one at a time (serially), even though they actually run in parallel.

**The problem without isolation:**
```
Transaction A: Read Alice's balance ($100)
Transaction B: Read Alice's balance ($100)
Transaction A: Deduct $80 → Alice has $20
Transaction B: Deduct $70 → Alice has $30  (based on stale $100 read!)
Final: Alice has $30, but she should have $100 - $80 - $70 = -$50 → REJECTED, or at minimum $20
```

This is called a "lost update" — Transaction B's read was based on stale data.

### Durability — "Committed = Permanent"

Once a transaction is committed, it survives system crashes, power failures, and disk failures.

**How:** Data is written to durable storage (disk) before COMMIT returns. The WAL is flushed to disk synchronously. Even if the server crashes immediately after COMMIT, the data is safe.

**Extra protection:** Replicate to another machine. Even if the primary disk dies, data exists on the replica.

---

## Isolation Levels — The Performance vs Correctness Tradeoff

Higher isolation = more correct behavior but worse performance (more locking, less concurrency).

### Read Phenomena (Problems)

| Phenomenon | Description | Example |
|-----------|-------------|---------|
| **Dirty Read** | Read uncommitted data from another transaction | T1 writes $50 → T2 reads $50 → T1 rollbacks → T2 used wrong data |
| **Non-Repeatable Read** | Same query returns different results within a transaction | T1 reads balance=$100 → T2 updates to $50 → T1 reads again, gets $50 |
| **Phantom Read** | New rows appear between two identical queries | T1: SELECT count WHERE age>20 → 5 rows → T2 inserts a new row → T1: SELECT count → 6 rows |
| **Lost Update** | Two transactions read same value, both update, one overwrites the other | Both read balance=$100, both deduct $50, final=$50 instead of $0 |

### The Four Isolation Levels

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Performance |
|-------|-----------|-------------------|-------------|-------------|
| **Read Uncommitted** | Possible ⚠️ | Possible ⚠️ | Possible ⚠️ | Fastest |
| **Read Committed** | Prevented ✅ | Possible ⚠️ | Possible ⚠️ | Fast |
| **Repeatable Read** | Prevented ✅ | Prevented ✅ | Possible ⚠️ | Moderate |
| **Serializable** | Prevented ✅ | Prevented ✅ | Prevented ✅ | Slowest |

**Defaults:**
- PostgreSQL: Read Committed
- MySQL (InnoDB): Repeatable Read
- Oracle: Read Committed
- SQL Server: Read Committed

### MVCC (Multi-Version Concurrency Control)

Most modern databases use MVCC instead of traditional locking:

```
Database stores multiple versions of each row:

Row "Alice": [v1: balance=$100, created by T1] [v2: balance=$80, created by T3]

Transaction T2 (started before T3):
  → Sees v1 ($100) — its snapshot doesn't include T3's changes

Transaction T4 (started after T3 committed):
  → Sees v2 ($80) — the latest committed version
```

**Benefits:** Readers don't block writers. Writers don't block readers. Much better concurrency than lock-based isolation.

**PostgreSQL's MVCC:** Each row has `xmin` (transaction that created it) and `xmax` (transaction that deleted/updated it). A transaction only sees rows where `xmin < my_transaction_id AND (xmax is null OR xmax > my_transaction_id)`.

---

## Distributed Transactions

### The Problem

In microservices, a single business operation might span multiple databases:

```
Order placed:
  1. Deduct inventory (Inventory DB)
  2. Charge payment (Payment DB)
  3. Create order record (Order DB)
  4. Send confirmation (Notification Service)
```

You can't wrap all four in a single database transaction — they're different databases!

### 2PC (Two-Phase Commit)

```
Coordinator → "Prepare to commit" → All participants
All participants → "Ready" → Coordinator
Coordinator → "COMMIT" → All participants
All participants → "Done" → Coordinator
```

**Phase 1 (Prepare):** Coordinator asks all participants if they can commit. Each participant locks resources and says "yes" or "no."
**Phase 2 (Commit/Abort):** If all say yes → COMMIT. If any says no → ABORT.

**Problems:** Blocking (if coordinator crashes during phase 2, participants are stuck holding locks). Slow (multiple round trips). Reduced availability.

### Saga Pattern (Preferred for Microservices)

Instead of a distributed transaction, use a series of local transactions with compensating actions:

```
Happy path:
  1. Create Order (Order Service)     → success
  2. Reserve Inventory                → success
  3. Process Payment                  → success
  4. Confirm Order                    → success ✓

If Step 3 fails:
  3. Process Payment                  → FAILED
  Compensate 2: Release Inventory     → done
  Compensate 1: Cancel Order          → done
```

**Choreography:** Each service publishes events; other services react.
**Orchestration:** A central orchestrator tells each service what to do.

---

## 🎤 Interview Questions & Expected Answers

### Q1: "Explain ACID with a real-world example."

**Expected answer:**
> "Consider a bank transfer of $500 from Account A to Account B:
>
> **Atomicity:** The debit from A and credit to B are a single transaction. If the credit to B fails (maybe B's account was closed), the debit from A is rolled back. Money never disappears.
>
> **Consistency:** We have a constraint that balances can't be negative. If A has only $300 and tries to transfer $500, the transaction is rejected. The database moves from one valid state to another.
>
> **Isolation:** If two transfers from Account A happen simultaneously ($500 to B and $300 to C), isolation ensures they don't both read $800 and both succeed. They're processed as if sequential: one succeeds, reducing the balance, and the second sees the updated balance.
>
> **Durability:** Once the transfer is committed and you see 'Transfer successful,' the data is on disk. Even if the server crashes a millisecond later, the transfer is permanent."

### Q2: "What isolation level would you choose for a banking application?"

**Expected answer:**
> "For a banking application, I'd use **Serializable** for critical operations like transfers and balance checks, and **Read Committed** for less critical operations like viewing transaction history.
>
> **Why Serializable for transfers:** Lost updates and phantom reads can cause real financial damage. Serializable prevents all concurrency anomalies. Yes, it's slower, but correctness is non-negotiable for money.
>
> **Why Read Committed for history:** Viewing past transactions doesn't need perfect consistency. A brief delay in seeing the very latest transaction is acceptable.
>
> **In practice, I might use PostgreSQL's Serializable Snapshot Isolation (SSI),** which provides serializable isolation with MVCC-level performance. It detects serialization conflicts and aborts one of the conflicting transactions, which the application retries. This gives us serializable correctness without the lock-heavy performance penalty of traditional serializable."

### Q3: "How would you handle distributed transactions across microservices?"

**Expected answer:**
> "I'd avoid distributed transactions (2PC) because they're slow, blocking, and reduce availability. Instead, I'd use the **Saga pattern**:
>
> Each step in the business process is a local transaction with a compensating action if a later step fails.
>
> **Example — E-commerce order:**
> 1. Order Service: Create order (status=PENDING)
> 2. Inventory Service: Reserve items
> 3. Payment Service: Charge customer
> 4. Order Service: Confirm order (status=CONFIRMED)
>
> If payment fails at step 3:
> - Compensate step 2: Release reserved inventory
> - Compensate step 1: Cancel order (status=CANCELLED)
>
> **Implementation:** I'd use an **orchestrator** — a central coordinator service that manages the saga flow. It calls each service in sequence and handles compensations on failure. The orchestrator's state is persisted (so it survives crashes).
>
> **Idempotency is critical:** Each step must be idempotent because retries are inevitable in distributed systems.
>
> **Eventual consistency:** The system is temporarily in an inconsistent state between steps (order exists but payment hasn't been processed). This is acceptable because the saga will eventually resolve to a consistent final state."
