# 🔄 Asynchronous Communication

Not every operation needs to happen synchronously. Async communication decouples services, improves resilience, and handles bursty workloads gracefully.

---

## 1. Pub/Sub (Publish-Subscribe)

**What it is:** A messaging pattern where senders (publishers) broadcast messages to a topic, and receivers (subscribers) listen to topics they care about. Publishers and subscribers don't know about each other.

```
Publisher A ──→ [Topic: "orders"] ──→ Subscriber 1 (Email Service)
Publisher B ──→                   ──→ Subscriber 2 (Inventory Service)
                                  ──→ Subscriber 3 (Analytics Service)
```

**Key characteristics:**
- **Decoupling:** Publisher doesn't know (or care) who subscribes
- **Fan-out:** One message can be delivered to multiple subscribers
- **Topic-based routing:** Subscribers only get messages from topics they subscribe to

**How it differs from point-to-point messaging:**
| Feature | Pub/Sub | Point-to-Point (Queue) |
|---------|---------|----------------------|
| Recipients | Multiple (all subscribers) | One (single consumer) |
| Coupling | Very loose | Loose |
| Pattern | Broadcasting | Work distribution |
| Example | "New order placed" → notify email, inventory, analytics | "Process this order" → one worker picks it up |

**Real-world implementations:**
| System | Key Features |
|--------|-------------|
| **Apache Kafka** | Distributed log, high throughput, persistent, consumer groups |
| **Google Pub/Sub** | Fully managed, at-least-once delivery, global |
| **AWS SNS** | Simple, integrates with SQS/Lambda, push-based |
| **Redis Pub/Sub** | In-memory, very fast, no persistence (messages are fire-and-forget) |
| **RabbitMQ** | Exchange-based routing, multiple protocols, flexible |

**Delivery guarantees:**
- **At-most-once:** Message may be lost, never duplicated (Redis Pub/Sub)
- **At-least-once:** Message is never lost, may be duplicated (Kafka default, SQS)
- **Exactly-once:** Message is delivered exactly once (hardest, Kafka with transactions)

**Use cases:**
- Event notifications (order placed, user signed up)
- Real-time data pipelines (clickstream, logs → analytics)
- Microservice event-driven architecture
- Chat/notification systems

---

## 2. Message Queues

**What it is:** A buffer that sits between a producer (sender) and consumer (worker), storing messages until the consumer is ready to process them.

```
Producer → [Message Queue] → Consumer
   (fast)    (buffer)         (processes at its own pace)
```

**Why message queues are powerful:**

### Decoupling
```
Without queue: Service A → Service B (A must wait for B, A breaks if B is down)
With queue:    Service A → [Queue] → Service B (A just drops the message and moves on)
```

### Load Leveling
```
Traffic:  📈📈📈📈📈📈📉📉📉📈📈📈📈📈📈📉📉
Queue:    Absorbs spikes, consumers process at steady rate
Workers:  ████████████████████████████████████ (constant throughput)
```

### Guaranteed Processing
- Messages persist in the queue until acknowledged by a consumer
- If a consumer crashes, the message is re-delivered to another consumer

**Key concepts:**

**Visibility Timeout:** When a consumer picks up a message, it becomes "invisible" to other consumers for a period. If the consumer doesn't acknowledge it in time, it becomes visible again.

**Dead Letter Queue (DLQ):** Messages that fail processing repeatedly are moved to a special queue for investigation.

**Message ordering:**
- **FIFO (First In, First Out):** Messages processed in order (SQS FIFO, Kafka within a partition)
- **Standard:** Best-effort ordering (faster, higher throughput)

**Backpressure:** When the queue fills up, producers are slowed down or rejected — prevents overwhelming the system.

**Popular message queues:**
| System | Type | Best For |
|--------|------|----------|
| **Apache Kafka** | Distributed log | High throughput streaming, event sourcing |
| **RabbitMQ** | Traditional broker | Complex routing, multiple protocols |
| **Amazon SQS** | Managed queue | Simple, serverless, auto-scaling |
| **Redis Streams** | In-memory stream | Low-latency, lightweight workloads |
| **Apache Pulsar** | Distributed log | Multi-tenancy, tiered storage |

**Kafka vs RabbitMQ:**
| Feature | Kafka | RabbitMQ |
|---------|-------|----------|
| Model | Distributed log (pull) | Message broker (push) |
| Ordering | Per-partition ordering | Per-queue FIFO |
| Retention | Keeps messages (configurable) | Deletes after consumption |
| Throughput | Very high (millions/sec) | Moderate (tens of thousands/sec) |
| Consumer groups | Built-in (parallel consumption) | Requires configuration |
| Best for | Event streaming, data pipelines | Task queues, RPC, complex routing |

---

## 3. Change Data Capture (CDC)

**What it is:** A pattern that tracks and captures changes (inserts, updates, deletes) in a database and streams them as events to other systems.

**The problem CDC solves:**
```
Without CDC:
  Service A writes to Database
  Service B needs the same data → polls Database every 5 seconds
  Problems: Polling is wasteful, introduces latency, couples services to DB

With CDC:
  Service A writes to Database
  [CDC] captures the change → publishes to Kafka/Queue
  Service B consumes the event in real-time
```

**How CDC works (approaches):**

### Log-based CDC (Preferred)
- Reads the database's internal transaction log (WAL in PostgreSQL, binlog in MySQL)
- Non-invasive: doesn't affect database performance
- Captures ALL changes, in order
- Tools: Debezium, Maxwell, DynamoDB Streams

```
Database WAL/Binlog → [Debezium] → [Kafka] → Consumer Services
```

### Trigger-based CDC
- Database triggers fire on INSERT/UPDATE/DELETE
- Triggers write change data to a separate "changes" table
- Invasive: adds overhead to every write operation
- Simpler to set up but impacts performance

### Polling-based CDC
- Periodically query the database for changes (using `updated_at` timestamps)
- Simple but has latency (polling interval)
- Can miss deletes (no row to query after deletion)
- Higher database load from frequent polling

### Timestamp-based CDC
- Relies on `created_at` / `updated_at` columns
- Simple but misses deletes, limited resolution

**Use cases for CDC:**
1. **Keeping caches in sync:** DB change → invalidate/update Redis cache
2. **Search index updates:** DB change → update Elasticsearch
3. **Data warehousing:** Stream operational data to analytics store in real-time
4. **Microservice communication:** Avoid dual writes (write to DB + publish event = inconsistency risk); instead, write to DB and let CDC publish the event
5. **Audit logging:** Capture every change for compliance
6. **Cross-region replication:** Stream changes to another data center

**The dual-write problem and how CDC solves it:**
```
BAD (dual write):
  1. Write to database    ← succeeds
  2. Publish to Kafka     ← fails!
  → Database and Kafka are now inconsistent

GOOD (CDC):
  1. Write to database    ← succeeds
  2. CDC reads DB log     ← guaranteed to capture the change
  3. CDC publishes to Kafka
  → Always consistent (source of truth is the DB)
```

**Debezium (most popular CDC tool):**
- Open source, by Red Hat
- Supports: PostgreSQL, MySQL, MongoDB, SQL Server, Oracle, Cassandra
- Reads database transaction logs
- Publishes to Kafka
- Tracks position in the log (resume after restart)
- Handles schema changes

**Interview tip:** CDC is especially impressive to mention when discussing:
- How to keep search indexes (Elasticsearch) in sync with the database
- How to build real-time data pipelines
- How to solve the dual-write problem in event-driven architectures
