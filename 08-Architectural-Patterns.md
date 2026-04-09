# 🖇️ Architectural Patterns

These are the high-level blueprints for how systems are organized. Knowing when to use each pattern is essential for system design interviews.

---

## 1. Client-Server Architecture

**What it is:** The foundational pattern where clients (requestors) communicate with servers (providers) over a network.

```
[Client: Browser/App] ──request──→ [Server: API/Web Server] ──query──→ [Database]
                      ←─response──                          ←─result──
```

**Characteristics:**
- **Separation of concerns:** Client handles UI/presentation, server handles business logic + data
- **Centralized data:** Server is the single source of truth
- **Stateless communication:** Each request is independent (server doesn't remember client)

**Variants:**
- **Thin client:** Minimal logic on client (traditional web pages, server-rendered HTML)
- **Thick/Fat client:** Significant logic on client (SPAs with React/Angular, mobile apps)
- **Two-tier:** Client ↔ Server (simple, direct DB access)
- **Three-tier:** Client ↔ Application Server ↔ Database (most web apps)
- **N-tier:** Multiple layers (presentation → API → business logic → data access → database)

**Pros:** Centralized control, easier security, shared data
**Cons:** Server is a potential bottleneck/SPOF, network dependency, scaling requires server investment

---

## 2. Microservices Architecture

**What it is:** An application is built as a collection of small, independent services, each running in its own process, communicating via APIs.

```
                    ┌─────────────────┐
                    │   API Gateway    │
                    └──┬──────┬───────┘
              ┌────────┘      └────────┐
     ┌────────▼───────┐    ┌──────────▼────────┐
     │  User Service   │    │  Order Service     │
     │  (PostgreSQL)   │    │  (MongoDB)         │
     └────────────────┘    └────────┬───────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Payment Service    │
                          │  (Redis + MySQL)    │
                          └────────────────────┘
```

**Key principles:**
1. **Single responsibility:** Each service does one thing well
2. **Independent deployment:** Deploy one service without affecting others
3. **Own their data:** Each service has its own database (no shared DB!)
4. **Communicate via APIs:** REST, gRPC, or async messaging
5. **Decentralized governance:** Teams choose their own tech stack

**Monolith vs Microservices:**
| Aspect | Monolith | Microservices |
|--------|----------|---------------|
| Deployment | All-or-nothing | Independent per service |
| Scaling | Scale entire app | Scale individual services |
| Tech stack | Single stack | Polyglot (per service) |
| Data | Shared database | Database per service |
| Complexity | Simple initially | Complex from day one |
| Team autonomy | Low | High |
| Debugging | Easier (one process) | Harder (distributed tracing needed) |
| Latency | In-process calls (fast) | Network calls (slower) |

**When to use microservices:**
- Large teams (>10 developers) that need to work independently
- Services with very different scaling needs
- Need for independent deployment and technology choices
- System is complex enough to benefit from decomposition

**When NOT to use microservices:**
- Small team (2-5 developers)
- Simple application (CRUD with basic logic)
- Early-stage startup (focus on speed, not architecture)
- You don't have DevOps maturity (CI/CD, monitoring, containerization)

**Common challenges:**
- Distributed transactions → use Sagas (choreography or orchestration)
- Service-to-service communication → use async messaging where possible
- Data consistency → eventual consistency is the norm
- Observability → distributed tracing, centralized logging
- Testing → contract testing, integration testing

---

## 3. Serverless Architecture

**What it is:** A cloud model where the cloud provider manages the infrastructure entirely. You write functions, and they execute on demand. No servers to provision, manage, or scale.

```
HTTP Request → [API Gateway] → [Lambda Function] → [DynamoDB]
                                (runs 200ms, costs $0.0000002)
```

**Key characteristics:**
- **Event-driven:** Functions triggered by events (HTTP requests, file uploads, queue messages, schedules)
- **Pay-per-use:** Pay only when your code runs (per invocation + duration). Zero traffic = zero cost.
- **Auto-scaling:** Scales to zero and scales up to thousands of concurrent executions automatically
- **Stateless:** Each invocation is independent (no local state between calls)
- **Short-lived:** Functions have execution time limits (e.g., AWS Lambda max 15 minutes)

**Serverless services beyond functions:**
- **Compute:** AWS Lambda, Google Cloud Functions, Azure Functions
- **Database:** DynamoDB, Firestore, Aurora Serverless
- **Storage:** S3, Cloud Storage
- **Messaging:** SQS, EventBridge, Pub/Sub
- **API:** API Gateway, App Engine

**Pros:**
- Zero infrastructure management
- Automatic scaling (including to zero)
- Pay only for what you use
- Faster time to market
- Built-in high availability

**Cons:**
- **Cold starts:** First invocation after idle period is slow (~100ms-1s)
- **Execution limits:** Time, memory, payload size limits
- **Vendor lock-in:** Deeply tied to a specific cloud provider
- **Debugging difficulty:** Harder to debug distributed serverless functions
- **Not for long-running tasks:** Better suited for short, event-driven workloads
- **State management:** Need external stores (DynamoDB, Redis) for any state

**When to use:**
- Event-driven workloads (file processing, webhooks)
- APIs with unpredictable traffic
- Periodic tasks (cron jobs, data processing)
- Prototypes and MVPs
- Glue logic between services

---

## 4. Event-Driven Architecture (EDA)

**What it is:** A pattern where the flow of the system is determined by events — significant changes in state that other parts of the system react to.

```
Traditional (request-driven):
  Order Service → calls → Payment Service → calls → Inventory Service → calls → Email Service
  (tightly coupled, synchronous, fragile)

Event-driven:
  Order Service publishes "OrderPlaced" event
    → Payment Service reacts: processes payment
    → Inventory Service reacts: reserves stock
    → Email Service reacts: sends confirmation
  (loosely coupled, asynchronous, resilient)
```

**Core concepts:**
- **Event:** An immutable record of something that happened ("OrderPlaced", "UserSignedUp")
- **Event Producer:** Creates and publishes events
- **Event Consumer:** Subscribes to and processes events
- **Event Broker:** Routes events from producers to consumers (Kafka, RabbitMQ, EventBridge)

**Patterns within EDA:**

### Event Notification
- Service publishes a minimal event: "OrderPlaced: {orderId: 123}"
- Interested services react to it
- Simplest form of EDA

### Event-Carried State Transfer
- Event contains ALL the data consumers need: "OrderPlaced: {orderId: 123, items: [...], total: $50}"
- Consumers don't need to call back to the producer for details
- Reduces coupling further

### Event Sourcing
- Instead of storing current state, store ALL events that led to current state
- Current state = replay all events from the beginning
- Example: Bank account balance = sum of all deposits and withdrawals
- Pros: Complete audit trail, can rebuild state at any point in time, debug by replaying
- Cons: Complexity, eventual consistency, CQRS often needed

### CQRS (Command Query Responsibility Segregation)
- Separate the read model from the write model
- Write side: optimized for writes (event store, normalized)
- Read side: optimized for reads (materialized views, denormalized)
- Connected by events: write side publishes events, read side updates its views

```
Write Path: Command → [Write Model / Event Store]
                           │ (events)
                           ▼
Read Path:  Query → [Read Model / Materialized Views]
```

**Pros of EDA:**
- Loose coupling between services
- High scalability (async processing)
- Better resilience (failures are isolated)
- Easy to add new consumers (open/closed principle)

**Cons:**
- Eventually consistent (not immediate)
- Harder to debug (events flow through multiple services)
- Event ordering can be tricky
- Requires good event schema management

---

## 5. Peer-to-Peer (P2P) Architecture

**What it is:** A decentralized architecture where each node (peer) acts as both a client and a server. No central authority.

```
Client-Server:        P2P:
     [Server]           Peer A ←→ Peer B
    /  |  \              ↕    ╲ ╱    ↕
  C1  C2  C3          Peer C ←→ Peer D
```

**Types of P2P:**

### Unstructured P2P
- No rules about where data is stored
- To find data: flood queries to all peers (or random walk)
- Simple but inefficient for lookups
- Example: Early Napster, Gnutella

### Structured P2P (DHT — Distributed Hash Table)
- Data placement is deterministic: `hash(key) → responsible peer`
- Efficient lookups: O(log N) hops
- Examples: BitTorrent (DHT), IPFS, Chord, Kademlia

### Hybrid P2P
- Some centralized components (tracker, indexer) with P2P data transfer
- Example: BitTorrent with trackers, Skype's super-nodes

**Key P2P concepts:**
- **Churn:** Peers constantly joining and leaving → data must be replicated
- **Free-riding:** Peers consume but don't contribute → incentive mechanisms needed
- **NAT traversal:** Peers behind routers need techniques like STUN/TURN to connect directly

**Use cases:**
- **File sharing:** BitTorrent — download pieces from multiple peers simultaneously
- **Cryptocurrency:** Bitcoin — decentralized ledger, no central authority
- **Content delivery:** IPFS — decentralized web
- **Video streaming:** WebRTC — peer-to-peer video calls
- **Messaging:** Some aspects of WhatsApp, Signal

**Why P2P matters for system design:**
- Understanding P2P helps when designing systems that need to distribute large files efficiently (video streaming, software updates)
- CDNs are evolving to include P2P elements
- WebRTC (used in Zoom, Google Meet) uses P2P for media transmission

**Interview tip:** P2P comes up when designing file sharing (Dropbox), video calling (Zoom), or content distribution systems. The key insight is that P2P shifts bandwidth costs from servers to users.
