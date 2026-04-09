# 📖 Core Concepts — Deep Dive Index

Each core concept now has its own detailed document with:
- 🔍 Deep explanations with real-world analogies
- 🏢 Real-world company examples (how Netflix, Amazon, Google, etc. actually use these)
- 🎤 Interview Q&A — exact questions interviewers ask and the answers they expect
- 🧠 Mental models to think about each concept

---

| # | Concept | One-Liner |
|---|---------|-----------|
| 1 | [Scalability](./01-Scalability.md) | "Can the system handle 10x, 100x growth?" |
| 2 | [Availability](./02-Availability.md) | "What % of time is the system up?" |
| 3 | [Reliability](./03-Reliability.md) | "Does the system do the right thing, every time?" |
| 4 | [Single Point of Failure](./04-SPOF.md) | "If this one thing dies, does everything die?" |
| 5 | [Latency vs Throughput vs Bandwidth](./05-Latency-Throughput-Bandwidth.md) | "How fast, how much, how wide?" |
| 6 | [Consistent Hashing](./06-Consistent-Hashing.md) | "How to distribute data without reshuffling everything" |
| 7 | [CAP Theorem](./07-CAP-Theorem.md) | "Pick two: Consistency, Availability, Partition Tolerance" |
| 8 | [Failover](./08-Failover.md) | "What happens when the primary goes down?" |
| 9 | [Fault Tolerance](./09-Fault-Tolerance.md) | "How does the system survive failures gracefully?" |

---

## Study Order

**Week 1:** Scalability → Availability → Reliability → SPOF (foundations)
**Week 2:** Latency/Throughput/Bandwidth → Consistent Hashing (performance + distribution)
**Week 3:** CAP Theorem → Failover → Fault Tolerance (distributed systems resilience)

Then practice applying these concepts to real design problems in files `11-13`.
