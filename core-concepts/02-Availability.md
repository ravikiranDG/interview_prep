# 🟢 Availability — Deep Dive

## What is Availability?

Availability measures the proportion of time a system is operational and accessible to users. It's usually expressed as a percentage — the famous "nines."

**Simple formula:**
```
Availability = Uptime / (Uptime + Downtime)
```

**The real question it answers:** "If a user tries to access your system at a random moment, what's the probability it's working?"

---

## The Nines Table — Memorize This

| Availability | Common Name | Downtime/Year | Downtime/Month | Downtime/Week |
|-------------|-------------|---------------|----------------|---------------|
| 99% | Two nines | 3.65 days | 7.31 hours | 1.68 hours |
| 99.9% | Three nines | 8.77 hours | 43.83 min | 10.08 min |
| 99.95% | Three and a half nines | 4.38 hours | 21.92 min | 5.04 min |
| 99.99% | Four nines | 52.60 min | 4.38 min | 1.01 min |
| 99.999% | Five nines | 5.26 min | 26.30 sec | 6.05 sec |
| 99.9999% | Six nines | 31.56 sec | 2.63 sec | 0.605 sec |

**Context for each level:**
- **99% (two nines):** Acceptable for internal tools, dev environments. Would be terrible for production.
- **99.9% (three nines):** Minimum for most SaaS products. ~9 hours downtime/year.
- **99.99% (four nines):** Standard target for critical business applications. ~52 min downtime/year.
- **99.999% (five nines):** "Five nines" — target for critical infrastructure (banking, healthcare, telecom). Extremely expensive to achieve.
- **99.9999% (six nines):** Virtually zero downtime. Only the most critical systems (air traffic control, nuclear systems).

---

## What Counts as Downtime?

This is more nuanced than it seems:

**Total outage:** System is completely unreachable → definitely downtime.

**Partial outage:** Some features work, others don't. How do you count this?
- Payment processing is down but browsing works → is the system "available"?
- Usually defined per-SLA: "99.99% availability for the payments API endpoint"

**Degraded performance:** System responds, but takes 30 seconds instead of 200ms.
- Some SLAs count responses above a latency threshold as "unavailable"
- Example: "A request that takes >5s to respond counts as failed"

**Planned maintenance:** Scheduled downtime (database migration, upgrades)
- Some companies exclude planned maintenance from availability calculations
- Modern expectation: zero-downtime deployments (rolling updates, blue-green)

---

## Availability in Series vs Parallel

### Components in Series (Sequential Dependency)
If your request must pass through ALL components, the overall availability is the PRODUCT:

```
Client → [LB: 99.99%] → [App: 99.99%] → [DB: 99.99%]

Overall = 0.9999 × 0.9999 × 0.9999 = 99.97%
```

**Each additional component in series REDUCES overall availability.** A chain is only as strong as its weakest link — actually, it's WEAKER than its weakest link.

With 5 components each at 99.99%:
```
0.9999^5 = 99.95%  (went from 52 min to 4.38 hours downtime/year!)
```

### Components in Parallel (Redundancy)
If you have redundant components where any ONE can serve the request:

```
             ┌─→ [Server A: 99%]
Client → LB ─┤
             └─→ [Server B: 99%]

Overall = 1 - (1-0.99) × (1-0.99) = 1 - 0.01 × 0.01 = 99.99%
```

**Redundancy dramatically improves availability.** Two components at 99% give you 99.99% combined!

With 3 replicas at 99% each:
```
1 - (0.01)^3 = 99.9999%  (Six nines from three-nine components!)
```

**This is the fundamental insight:** You achieve high availability through REDUNDANCY, not by making individual components more reliable.

---

## How to Achieve High Availability

### 1. Eliminate Single Points of Failure (SPOF)
Every component should have a backup. If drawing your architecture, every box should appear at least twice.

```
BAD:   Client → [1 LB] → [1 Server] → [1 DB]
GOOD:  Client → [LB pair] → [Server 1, 2, 3] → [DB Primary + Replica]
```

### 2. Load Balancing
Distribute traffic so no single server is overwhelmed. If one server dies, others absorb the load.

### 3. Health Checks and Auto-Recovery
- Load balancers health-check backend servers every few seconds
- Unhealthy servers are removed from the pool automatically
- Kubernetes restarts crashed pods automatically
- Auto-scaling replaces failed instances

### 4. Redundant Data Storage
- Database replication (primary → replica)
- Cross-region replication for disaster recovery
- Object storage (S3) stores data across multiple availability zones by default

### 5. Geographic Distribution (Multi-Region)
```
US users → [US-East Region]      EU users → [EU-West Region]
              Primary                          Primary
              + Replicas                       + Replicas
```
- If an entire region goes down, traffic is routed to another region
- DNS-based failover or global load balancer

### 6. Graceful Degradation
When under stress, serve reduced functionality rather than failing completely:
- Netflix: If the recommendation service is down, show generic popular content instead of personalized recommendations
- Amazon: If the review service is down, show product pages without reviews
- Twitter: If timeline generation is slow, show cached/stale timeline

### 7. Zero-Downtime Deployments
- **Rolling deployment:** Update instances one at a time. Always some healthy instances serving traffic.
- **Blue-green deployment:** Run two identical environments. Switch traffic from blue (old) to green (new). Instant rollback by switching back.
- **Canary deployment:** Route 1% of traffic to new version. Monitor. If good, gradually increase to 100%.

---

## Availability in Real-World Systems

### Amazon (e-commerce)
- Every 100ms of latency costs ~1% in sales
- Target: 99.99%+ for the shopping experience
- Multi-AZ, multi-region architecture
- Their own internal availability studies led to building DynamoDB (always available, eventually consistent)

### Google Search
- Target: ~99.999% availability
- Serves from multiple data centers simultaneously
- If one data center fails, others seamlessly handle traffic
- Redundancy at every level: servers, racks, data centers, regions

### AWS S3
- Designed for 99.99% availability (11 nines of durability — different metric)
- Data stored across minimum 3 availability zones
- Even S3 has had outages (2017: ~4 hours, caused by a typo in a command)

### GitHub
- Target: 99.95% uptime
- Has had notable outages (2018: 24-hour incident due to a network partition causing split-brain in MySQL cluster)
- Their post-mortems are public and educational

---

## SLA vs SLO vs SLI

Understanding this distinction is important for interviews:

**SLI (Service Level Indicator):** The actual measured metric.
- "Our p99 latency this month was 180ms"
- "Our uptime this month was 99.97%"

**SLO (Service Level Objective):** The target value for an SLI — an internal goal.
- "We target 99.99% uptime for our API"
- "We target p99 latency under 200ms"

**SLA (Service Level Agreement):** A formal contract with customers, with financial penalties for violations.
- "If we deliver less than 99.95% uptime, we'll credit 10% of your bill"
- SLAs are typically LESS strict than SLOs (buffer for safety)

```
SLI (what we measure) < SLO (our internal target) > SLA (what we promise customers)

Example:
  SLI: 99.98% uptime measured
  SLO: 99.99% uptime target (we're slightly below target — investigate)
  SLA: 99.95% uptime promised (we're above our promise — no penalty)
```

---

## Error Budgets

**What it is:** The acceptable amount of failure allowed by your SLO.

```
SLO: 99.9% availability
Error budget: 0.1% = 8.77 hours of downtime per year = ~43 minutes per month
```

**How it's used:**
- If you've used 30 minutes of your 43-minute monthly error budget, be cautious with risky deployments.
- If you have plenty of error budget left, you can deploy more aggressively and experiment.
- If you've exceeded your error budget, freeze deployments and focus on reliability.

**This concept from Google SRE is a game-changer:** It turns reliability from "infinite effort toward zero downtime" into a measurable budget that balances reliability with feature velocity.

---

## Measuring Availability

### Uptime Monitoring
- External probes (Pingdom, UptimeRobot) — check from outside the network
- Internal health checks — load balancer checking backends
- Synthetic monitoring — automated scripts that simulate user journeys

### Success Rate
```
Availability = Successful requests / Total requests

Last hour: 999,850 successes / 1,000,000 total = 99.985%
```

### Multi-dimensional
Track availability per:
- Region (US-East may be up while EU-West is down)
- Endpoint (`/api/payments` may be down while `/api/users` is up)
- Customer tier (premium customers may have dedicated, more reliable infrastructure)

---

## 🎤 Interview Questions & Expected Answers

### Q1: "What does it mean for a system to be 'highly available,' and how would you design for it?"

**Expected answer:**
> "Highly available means the system has minimal downtime — typically 99.99% or higher uptime, which is less than 52 minutes of downtime per year.
>
> To design for high availability, I'd apply these principles:
> 1. **No single point of failure:** Every component is redundant. Multiple app servers behind a load balancer, database with primary + replicas, redundant load balancers with virtual IPs.
> 2. **Health checks and automatic failover:** Load balancers detect unhealthy servers and route traffic away. Database replication with automatic failover (e.g., using Patroni for PostgreSQL).
> 3. **Multi-AZ deployment:** Deploy across at least 2-3 availability zones. If one AZ has an outage, others continue serving.
> 4. **Graceful degradation:** When a non-critical service fails, the system continues with reduced functionality rather than failing entirely.
> 5. **Zero-downtime deployments:** Rolling updates or blue-green deployments so deployments don't cause downtime.
> 6. **For the most critical systems, multi-region:** Active-active or active-passive across geographic regions for disaster recovery."

---

### Q2: "How do you calculate the overall availability of a system with multiple components?"

**Expected answer:**
> "It depends on how the components are arranged:
>
> **In series (all must work):** Multiply their availabilities.
> - If I have an API gateway at 99.99%, an app server at 99.99%, and a database at 99.99%, the overall availability is 0.9999³ = 99.97%.
> - Each additional component in series reduces overall availability.
>
> **In parallel (any one can serve):** Use the complement formula: 1 - (probability all fail).
> - Two servers at 99% each in parallel: 1 - (0.01 × 0.01) = 99.99%.
> - This is why redundancy is so powerful — even mediocre individual reliability becomes excellent with redundancy.
>
> **Combined:** Real systems have both. Parallel components at each layer, with layers in series.
>
> The key insight is that you can't make a system more available than its serial components allow. So you add redundancy (parallelism) at every layer to boost each layer's effective availability."

---

### Q3: "What's the difference between SLA, SLO, and SLI?"

**Expected answer:**
> "SLI is the Service Level Indicator — the actual measured metric, like 'uptime was 99.97% this month' or 'p99 latency was 180ms.'
>
> SLO is the Service Level Objective — our internal target for that metric. 'We target 99.99% uptime.' SLOs drive engineering priorities.
>
> SLA is the Service Level Agreement — a formal contract with customers that often has financial penalties. 'If uptime drops below 99.95%, we credit 10% of your bill.'
>
> The SLA is typically less strict than the SLO — we give ourselves a buffer. If our SLO is 99.99% and our SLA promises 99.95%, then we have to fall below 99.99% before we even start worrying, and way below 99.95% before we owe customers money.
>
> Google SRE introduced the concept of 'error budgets': if our SLO is 99.99%, we have 0.01% of 'budget' to spend on downtime. This budget balances reliability work against shipping new features."

---

### Q4: "Your system needs to be highly available, but you also need to do database migrations. How do you handle this?"

**Expected answer:**
> "I'd ensure zero-downtime migrations:
>
> 1. **Additive changes only in the first phase:** Add new columns/tables, don't remove or rename existing ones. The old code continues to work.
>
> 2. **Dual-write phase:** Deploy code that writes to both old and new schema. Backfill old data into the new schema.
>
> 3. **Switch reads:** Once all data is in the new schema, switch reads to use the new schema.
>
> 4. **Clean up:** Remove old code paths and old columns (in a separate deployment).
>
> This is called the 'expand and contract' or 'parallel change' pattern. Each step is a separate deployment, and the system works correctly at every intermediate state.
>
> For the database itself, I'd use online DDL tools like `pt-online-schema-change` (MySQL) or PostgreSQL's native online DDL (most ALTER TABLE operations don't lock in modern PostgreSQL). For really large migrations, tools like `gh-ost` from GitHub create a shadow table and do a live cutover."

---

### Q5: "A critical service in your system has gone down. Walk me through your response."

**Expected answer:**
> "Assuming we have proper incident management:
>
> **Immediate (first 5 minutes):**
> 1. Automatic alerting fires (PagerDuty/OpsGenie). On-call engineer is paged.
> 2. Check: Did automatic failover work? If we have redundancy, traffic should have shifted to healthy instances.
> 3. If auto-failover worked, verify the system is stable. Investigate root cause.
> 4. If auto-failover didn't work, manually trigger failover or restart the service.
>
> **Stabilization (5-30 minutes):**
> 5. Communicate status to stakeholders (status page update).
> 6. If the primary fix isn't quick, implement a workaround: restart, rollback to previous deployment, switch to degraded mode.
> 7. Monitor system health after recovery.
>
> **Post-incident:**
> 8. Conduct a blameless post-mortem: What happened? Why? How did we detect it? How did we fix it? How do we prevent it?
> 9. Create action items: improve monitoring, add redundancy, add circuit breakers, improve runbooks.
>
> The most important thing is to have PRACTICED this before the incident. Chaos engineering (killing instances in production), game days (simulated incidents), and well-maintained runbooks make the difference between a 5-minute recovery and a 5-hour outage."

---

### Q6: "What is graceful degradation? Give me an example."

**Expected answer:**
> "Graceful degradation means that when a component fails, the system continues to function with reduced capability rather than failing entirely.
>
> **Netflix example:** If their recommendation engine goes down, instead of showing users an error page, they show a generic 'Top 10 in Your Country' list. The user experience is worse, but the service is still usable.
>
> **Amazon example:** If the reviews service is down, product pages still load — they just don't show reviews. Customers can still browse and buy.
>
> **My design approach:** I'd identify critical vs non-critical services. Critical services (authentication, payments) need full redundancy. Non-critical services (recommendations, analytics) should fail silently — return a default/cached response instead of an error.
>
> I'd implement this with circuit breakers: when a non-critical service fails, the circuit breaker opens, and we immediately return a fallback response. This also protects the failing service from being overwhelmed by retries."

---

## 🧠 Mental Model

Think of availability like a chain:

```
🔗 Strong chain (high availability):
   Every link has a backup. If one breaks, the backup takes over.
   The chain never breaks.

🔗 Weak chain (low availability):
   A single link with no backup.
   When it breaks, everything connected falls apart.
```

**The goal is not to prevent failures (impossible in distributed systems). The goal is to make failures invisible to users.**
