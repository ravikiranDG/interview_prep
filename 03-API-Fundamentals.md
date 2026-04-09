# 🔌 API Fundamentals

APIs (Application Programming Interfaces) are the contracts between different parts of a system. In system design interviews, you'll often need to define the API for your system.

---

## 1. What is an API?

An API is a well-defined interface that allows two software components to communicate. Think of it as a restaurant menu — it tells you what you can order (endpoints), what information you need to provide (request parameters), and what you'll get back (response).

**Types of APIs in system design:**
- **Public/External APIs:** Exposed to third-party developers (Twitter API, Stripe API)
- **Internal/Private APIs:** Used between services within an organization
- **Partner APIs:** Shared with specific business partners

**API Design Principles:**
1. **Consistency:** Use the same naming conventions, error formats, pagination style everywhere
2. **Versioning:** `/api/v1/users` — never break existing clients
3. **Idempotency:** Safe to retry without side effects (more on this below)
4. **Pagination:** Never return unbounded lists. Use cursor-based or offset-based pagination.
5. **Rate Limiting:** Protect your service from abuse

---

## 2. API Gateway

**What it is:** A single entry point for all client requests that handles cross-cutting concerns before routing to backend services.

```
Mobile App  ─┐
Web Client  ─┤→ [API Gateway] → Service A
Partner API ─┘                → Service B
                              → Service C
```

**What an API Gateway does:**
| Feature | Description |
|---------|-------------|
| **Routing** | Routes requests to the appropriate microservice |
| **Authentication/Authorization** | Validates tokens, API keys before requests reach services |
| **Rate Limiting** | Throttles excessive requests |
| **Load Balancing** | Distributes traffic across service instances |
| **Request/Response Transformation** | Modifies headers, body format |
| **Caching** | Caches frequent responses |
| **SSL Termination** | Handles HTTPS, backends use plain HTTP |
| **Logging & Monitoring** | Centralized request logging and metrics |
| **Circuit Breaking** | Stops forwarding to failing services |

**Popular API Gateways:** Kong, AWS API Gateway, Nginx, Envoy, Zuul (Netflix)

**API Gateway vs Load Balancer:**
- Load balancer distributes traffic among instances of the SAME service
- API Gateway routes requests to DIFFERENT services and handles cross-cutting concerns

**Backend for Frontend (BFF):** A variant where you have different API gateways for different clients (mobile gets a different gateway than web) — each optimized for that client's needs.

---

## 3. REST vs GraphQL

### REST (Representational State Transfer)

**Core principles:**
- Resources identified by URLs: `/users/123`, `/posts/456`
- Standard HTTP methods: GET, POST, PUT, DELETE
- Stateless: each request contains all info needed
- Returns fixed data structures

**Example:**
```
GET /api/users/123
Response: { "id": 123, "name": "Alice", "email": "alice@example.com", "posts": [...] }

GET /api/users/123/posts
Response: [{ "id": 1, "title": "Hello" }, ...]
```

**Problems with REST:**
- **Over-fetching:** GET `/users/123` returns ALL fields even if you only need the name
- **Under-fetching:** Need user + posts + comments = 3 separate requests (N+1 problem)

### GraphQL

**Core idea:** Client specifies exactly what data it needs in a single query.

**Example:**
```graphql
query {
  user(id: 123) {
    name
    posts {
      title
      comments {
        text
      }
    }
  }
}
```
→ Returns exactly the requested fields in one request.

**Comparison:**

| Aspect | REST | GraphQL |
|--------|------|---------|
| Data fetching | Fixed endpoints, fixed responses | Flexible queries, exact data |
| Over/Under-fetching | Common problem | Solved by design |
| Caching | Easy (HTTP caching, CDN) | Harder (POST requests, custom caching) |
| Versioning | URL versioning (`/v1/`, `/v2/`) | Schema evolution, deprecate fields |
| Learning curve | Low | Higher |
| File uploads | Native support | Needs workarounds |
| Real-time | Needs WebSockets separately | Built-in subscriptions |
| Best for | Simple CRUD, public APIs | Complex data relationships, mobile |

**When to choose:**
- REST: Public APIs, simple CRUD, need HTTP caching
- GraphQL: Mobile apps (bandwidth matters), complex nested data, multiple frontend teams

---

## 4. WebSockets

**What it is:** A protocol providing full-duplex (bidirectional) communication over a single TCP connection.

**How it works:**
1. Client sends HTTP request with `Upgrade: websocket` header
2. Server responds with `101 Switching Protocols`
3. Connection is "upgraded" — now both sides can send data anytime

```
HTTP:       Client → Request → Server → Response (one direction at a time)
WebSocket:  Client ↔ Server (both can send anytime, persistent connection)
```

**Use cases:**
- Real-time chat (WhatsApp, Slack)
- Live sports scores / stock tickers
- Collaborative editing (Google Docs)
- Online gaming
- Live notifications

**Scaling WebSockets:**
- WebSocket connections are stateful and long-lived → harder to load balance
- Use sticky sessions or a pub/sub system (Redis) to broadcast messages across server instances
- Consider connection limits per server (each WS connection = an open socket)

**Alternatives:**
- **Server-Sent Events (SSE):** Server → Client only (unidirectional). Simpler, auto-reconnect. Good for live feeds.
- **Long Polling:** Client sends request, server holds it until data is available. Fallback when WebSockets aren't possible.

---

## 5. Webhooks

**What it is:** A pattern where a server pushes data to a client's URL when an event occurs — "don't call us, we'll call you."

**How it works:**
1. Client registers a callback URL with the server
2. When an event occurs, the server sends an HTTP POST to that URL
3. Client processes the event

```
Traditional (polling):  Client: "Any new orders?" (every 5 sec) → Server: "No" x100, then "Yes!"
Webhook (push):         Server: "Hey, a new order just came in!" → Client's callback URL
```

**Real-world examples:**
- Stripe sends a webhook when a payment succeeds/fails
- GitHub sends a webhook when code is pushed
- Twilio sends a webhook when an SMS is received

**Design considerations:**
- **Retries:** If the client's URL is down, retry with exponential backoff
- **Idempotency:** Client must handle duplicate deliveries (server might retry)
- **Security:** Sign webhook payloads (HMAC) so client can verify authenticity
- **Ordering:** Webhooks may arrive out of order — include timestamps/sequence numbers
- **Timeouts:** Server should timeout quickly (e.g., 5s) — don't wait for slow clients

---

## 6. Idempotency

**What it is:** An operation is idempotent if performing it multiple times produces the same result as performing it once.

**Why it matters:** In distributed systems, networks are unreliable. Requests might be:
- Sent but never received (timeout → client retries)
- Received but response lost (client retries, but server already processed it)
- Delivered multiple times (network duplicates)

Without idempotency, retrying a "charge $100" request could charge $200 or $300.

**Idempotent HTTP methods:**
- GET, PUT, DELETE → naturally idempotent
- POST → NOT naturally idempotent (each call creates a new resource)

**How to make operations idempotent:**

**Idempotency Key pattern:**
1. Client generates a unique ID (UUID) for each logical operation
2. Client includes it in the request: `Idempotency-Key: abc-123`
3. Server checks: "Have I seen this key before?"
   - No → Process the request, store the result with the key
   - Yes → Return the previously stored result

```
Client → POST /payments { amount: 100, idempotency_key: "uuid-xyz" }
Server → Process, store result mapped to "uuid-xyz", return 200

Client (retry) → POST /payments { amount: 100, idempotency_key: "uuid-xyz" }
Server → Found "uuid-xyz" in store → return same 200 response (no double charge)
```

**Interview tip:** ALWAYS discuss idempotency when designing payment systems, order placement, or any system where duplicate processing has real-world consequences.

---

## 7. Rate Limiting

**What it is:** Controlling how many requests a client can make in a given time window.

**Why it matters:**
- Prevents abuse and DDoS attacks
- Ensures fair usage among clients
- Protects backend services from overload
- Controls costs (especially for paid APIs)

**Common algorithms:**

### Token Bucket
- Bucket holds N tokens, refilled at rate R tokens/second
- Each request consumes one token
- If bucket is empty → reject request
- Allows bursts (up to bucket size) followed by steady rate
- **Most commonly used** (AWS, Stripe)

### Leaky Bucket
- Requests enter a FIFO queue (the bucket)
- Processed at a fixed rate (leak rate)
- If queue is full → reject request
- Produces perfectly smooth output rate, no bursts

### Fixed Window Counter
- Count requests in fixed time windows (e.g., per minute)
- Reset counter at window boundary
- Problem: burst at window boundary (e.g., 100 requests at 0:59 + 100 at 1:00 = 200 in 2 seconds)

### Sliding Window Log
- Store timestamp of each request
- Count requests in the last N seconds
- Most accurate but memory-intensive

### Sliding Window Counter
- Hybrid of fixed window + sliding window
- Weighted count: `current_window_count × overlap% + previous_window_count × (1 - overlap%)`
- Good accuracy with low memory

**Where to implement rate limiting:**
- **API Gateway** (most common) — centralized, easy to manage
- **Application level** — per-user or per-endpoint limits
- **Load balancer** — basic IP-based limiting

**Rate limit headers (standard practice):**
```
X-RateLimit-Limit: 100        (max requests per window)
X-RateLimit-Remaining: 45     (requests left)
X-RateLimit-Reset: 1634000000 (when the window resets)
HTTP 429 Too Many Requests     (when limit is exceeded)
```

---

## 8. API Design Best Practices

**Resource naming:**
```
Good: GET /users/123/posts          (noun-based, hierarchical)
Bad:  GET /getUserPosts?id=123      (verb in URL, not RESTful)
```

**Use proper HTTP methods:**
```
GET    /articles        → List articles
GET    /articles/42     → Get article 42
POST   /articles        → Create new article
PUT    /articles/42     → Replace article 42
PATCH  /articles/42     → Update fields of article 42
DELETE /articles/42     → Delete article 42
```

**Pagination:**
```
Offset-based:  GET /posts?offset=20&limit=10
Cursor-based:  GET /posts?cursor=abc123&limit=10  (preferred for large datasets)
```
- Offset-based: Simple but slow for large offsets (DB must skip rows)
- Cursor-based: Consistent, performant, handles real-time inserts/deletes

**Filtering, Sorting, Searching:**
```
GET /products?category=electronics&sort=-price&search=laptop
```

**Error responses (consistent format):**
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Email address is not valid",
    "details": [{ "field": "email", "issue": "invalid format" }]
  }
}
```

**Versioning strategies:**
- URL path: `/api/v1/users` (most common, clearest)
- Header: `Accept: application/vnd.api.v1+json`
- Query param: `/api/users?version=1`

**Security essentials:**
- Always use HTTPS
- Authenticate with OAuth 2.0 / API keys / JWTs
- Validate and sanitize all inputs
- Use CORS properly for browser clients
- Never expose internal IDs or stack traces in errors
