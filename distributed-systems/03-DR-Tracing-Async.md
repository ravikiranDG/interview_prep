# 🌐 Disaster Recovery, Distributed Tracing & Async Patterns — Deep Dive

## 1. Disaster Recovery (DR)

### Key Metrics

**RPO (Recovery Point Objective):** Maximum acceptable data loss, measured in time.
- "How much data can we afford to lose?"
- RPO = 0: Zero data loss (synchronous replication)
- RPO = 1 hour: Can lose up to 1 hour of data (hourly backups)

**RTO (Recovery Time Objective):** Maximum acceptable downtime.
- "How quickly must we recover?"
- RTO = 0: Zero downtime (active-active multi-region)
- RTO = 4 hours: System must be back up within 4 hours

```
    ← RPO →                    ← RTO →
    Data Loss                   Downtime
────|──────────── DISASTER ──────────|────→
  Last backup               System recovered
```

### DR Strategies (Increasing Cost & Speed)

#### 1. Backup & Restore ($)
- Regular backups to another region (daily/hourly)
- On disaster: provision new infrastructure, restore from backup
- **RPO:** Hours (since last backup). **RTO:** Hours to days.
- Cheapest but slowest recovery.

#### 2. Pilot Light ($$)
- Core infrastructure running in DR region (database replicas)
- Compute is off (or minimal)
- On disaster: scale up compute, switch DNS
- **RPO:** Minutes (replication lag). **RTO:** Minutes to hours.

#### 3. Warm Standby ($$$)
- Scaled-down copy of production in DR region
- Actively receiving replicated data, serving some read traffic
- On disaster: scale up to full capacity, switch traffic
- **RPO:** Seconds-minutes. **RTO:** Minutes.

#### 4. Active-Active Multi-Region ($$$$)
- Full production in 2+ regions
- Both regions serve live traffic
- On disaster: healthy region absorbs all traffic
- **RPO:** Near-zero. **RTO:** Seconds (DNS failover + auto-scaling).
- Most expensive but best recovery.

### DR Testing

**DR that isn't tested isn't DR — it's hope.**

- **Tabletop exercises:** Team walks through a disaster scenario verbally. Identifies gaps in runbooks.
- **DR drills:** Actually fail over to the DR region. Verify everything works. Fail back.
- **Chaos engineering:** Randomly inject region-level failures in production (Netflix Chaos Kong).
- **Backup restoration tests:** Regularly restore backups to a test environment. Verify data integrity.

---

## 2. Distributed Tracing

### The Problem

```
User reports: "The app is slow"

Your system has 15 microservices. Which one is slow?

Request path:
  API Gateway → Auth Service → User Service → Order Service
                                                  → Inventory Service
                                                  → Payment Service → Bank API
                                                  → Notification Service → Email Provider

Which of these 8 services is causing the slowness?
Without tracing: GOOD LUCK 🍀
With tracing: Exactly one click to see the bottleneck.
```

### How Distributed Tracing Works

**Key concepts:**

| Concept | Description |
|---------|-------------|
| **Trace** | The entire journey of one request through all services |
| **Span** | One unit of work within a trace (one service call, one DB query) |
| **Trace ID** | Unique identifier for the entire trace (propagated across all services) |
| **Span ID** | Unique identifier for one span |
| **Parent Span ID** | Links a child span to its parent (builds the tree) |

**A trace looks like:**
```
Trace ID: abc-123

├─ [API Gateway]           0ms  ────────────────────────── 350ms
│  ├─ [Auth Service]       5ms  ──── 15ms
│  ├─ [User Service]       20ms ──── 45ms
│  └─ [Order Service]      50ms ────────────────────────── 340ms
│     ├─ [Inventory Svc]   60ms ──── 80ms
│     ├─ [Payment Service] 85ms ──────────────────── 320ms  ← BOTTLENECK!
│     │  └─ [Bank API]     90ms ──────────────── 310ms      ← ROOT CAUSE
│     └─ [Notification]    325ms ──── 340ms
```

**One glance tells you:** Payment Service → Bank API is the bottleneck (220ms out of 350ms total).

### Context Propagation

The Trace ID must be passed from service to service:

```
HTTP headers:
  traceparent: 00-abc123-def456-01       (W3C standard)
  
  or:
  X-Trace-Id: abc123                      (custom header)
  X-Span-Id: def456
  X-Parent-Span-Id: ghi789

Kafka message headers:
  trace_id: abc123
  span_id: jkl012
```

Each service:
1. Reads the trace context from incoming request
2. Creates a new span (child of the incoming span)
3. Adds the trace context to outgoing requests
4. Reports the span to the tracing backend

### Tracing Tools

| Tool | Type | Best For |
|------|------|----------|
| **Jaeger** | Open-source (CNCF) | Kubernetes environments |
| **Zipkin** | Open-source | Simple setup, Java ecosystem |
| **AWS X-Ray** | Managed | AWS-native services |
| **Datadog APM** | Commercial | Full observability platform |
| **OpenTelemetry** | Standard/SDK | Vendor-neutral instrumentation (the future standard) |

### The Three Pillars of Observability

| Pillar | What It Answers | Tool |
|--------|----------------|------|
| **Logs** | "What happened?" (detailed event records) | ELK Stack, Splunk, Loki |
| **Metrics** | "How much?" (aggregated numerical data) | Prometheus + Grafana, Datadog |
| **Traces** | "Where and how long?" (request journey) | Jaeger, Zipkin, X-Ray |

**They complement each other:**
- Metrics alert you: "Error rate spiked to 5%!"
- Traces pinpoint: "The latency is coming from Payment Service"
- Logs explain: "Payment Service log: 'Connection to bank API timed out after 30s'"

---

## 3. Async Communication Patterns

### Why Async Matters

```
Synchronous:
  Order Service → Payment Service (3s) → Inventory Service (2s) → Email Service (5s)
  Total: 10 seconds! User waits the entire time.

Asynchronous:
  Order Service → acknowledge to user (200ms)
  Order Service → publish "OrderCreated" event to Kafka
  Payment Service → processes payment (async)
  Inventory Service → reserves stock (async)
  Email Service → sends confirmation (async)
  Total user wait: 200ms! Backend processes in parallel.
```

### Pub/Sub vs Message Queue

| Feature | Pub/Sub | Message Queue |
|---------|---------|---------------|
| **Recipients** | All subscribers (fan-out) | One consumer (work distribution) |
| **Use case** | Broadcasting events | Processing tasks |
| **Example** | "Order placed" → notify email, analytics, inventory | "Send this email" → one email worker |
| **Retention** | Varies (Kafka retains, Redis doesn't) | Until consumed and acknowledged |
| **Real-world** | Kafka topics, SNS, Redis Pub/Sub | SQS, RabbitMQ, Celery |

### Change Data Capture (CDC)

**The dual-write problem:**
```
BAD:
  1. Write to database → success
  2. Publish to Kafka  → FAILS!
  → Database has the data, Kafka doesn't. Inconsistent!

GOOD (CDC):
  1. Write to database → success
  2. CDC reads the database's transaction log (WAL/binlog)
  3. CDC publishes the change to Kafka
  → Always consistent! Database is the single source of truth.
```

**Tools:** Debezium (open-source, supports PostgreSQL, MySQL, MongoDB).

**Use cases:**
- Keep Elasticsearch in sync with the database
- Invalidate cache when data changes
- Replicate data to analytics warehouse
- Event-driven microservice communication without dual writes

---

## 🎤 Interview Questions & Expected Answers

### Q1: "How would you design a disaster recovery strategy for a critical e-commerce platform?"

**Expected answer:**
> "For a critical e-commerce platform, I'd target RPO < 1 minute and RTO < 5 minutes:
>
> **Active-passive with warm standby:**
> - **Primary region (US-East):** Full production serving all traffic.
> - **DR region (US-West):** Database replicas receiving near-synchronous replication. Reduced compute fleet (warm, not cold) that can auto-scale.
>
> **Data replication:**
> - PostgreSQL: Synchronous replication to at least one replica in the DR region. RPO ≈ 0.
> - Redis: Cross-region replication (async, RPO ≈ seconds).
> - S3: Cross-region replication enabled by default.
> - Kafka: MirrorMaker 2 for cross-region topic replication.
>
> **Failover mechanism:**
> - Route 53 health checks on primary region. On failure, DNS switches to DR region.
> - DR region auto-scales compute to handle full traffic.
> - Expected RTO: 2-5 minutes (DNS propagation + auto-scaling).
>
> **Testing:**
> - Monthly DR drills: fail over to DR region, run traffic for 1 hour, fail back.
> - Quarterly chaos: simulate full primary region failure.
> - Weekly: backup restoration verification.
>
> **For the most critical components (payments):** I'd consider active-active multi-region to achieve near-zero RTO, but that adds significant complexity (conflict resolution, data consistency)."

### Q2: "What is distributed tracing and why is it important?"

**Expected answer:**
> "Distributed tracing tracks a single request as it flows through multiple services, recording timing and metadata at each step. It's essential in microservices because a single user request might touch 10-20 services, and without tracing, identifying the source of latency or errors is nearly impossible.
>
> **How it works:**
> - A unique Trace ID is generated at the entry point (API gateway)
> - This ID is propagated to every downstream service via HTTP headers
> - Each service creates a Span (recording start time, end time, status, metadata)
> - Spans are sent to a tracing backend (Jaeger, Zipkin)
> - The backend assembles spans into a trace timeline
>
> **What it enables:**
> - Identify which service is the bottleneck (80% of latency is in Payment Service)
> - Detect errors across service boundaries (Auth Service returns 500 → causes Order Service to fail)
> - Understand request flow and dependencies
> - Measure SLA per service
>
> **In practice, I'd use OpenTelemetry** for instrumentation (vendor-neutral SDK) and Jaeger or Datadog for the backend. The key is to instrument all services and propagate context consistently."

### Q3: "When should you use synchronous vs asynchronous communication between services?"

**Expected answer:**
> "**Use synchronous when:**
> - The user needs an immediate response: 'Is my username available?' → must answer now
> - The operation is part of a critical path that must complete before responding: authentication, authorization
> - The operation is fast (<100ms) and unlikely to fail
>
> **Use asynchronous when:**
> - The user doesn't need to wait: 'Send me an email confirmation' → acknowledge immediately, send email in background
> - The operation is slow or unreliable: calling a third-party API, processing a video
> - You need to handle traffic spikes: message queue absorbs bursts, workers process at steady rate
> - You want loose coupling: services publish events, other services react independently
>
> **Hybrid (most common):**
> Accept the request synchronously (validate, create order, return order ID) then process asynchronously (payment, inventory, notification via message queue).
>
> **The tradeoff:** Async is more scalable and resilient but harder to debug and introduces eventual consistency. Sync is simpler but creates tight coupling and cascading failure risk."
