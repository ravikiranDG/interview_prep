# 🛡️ Idempotency, Rate Limiting & Webhooks — Deep Dive

## 1. Idempotency

### What It Is
An operation is idempotent if performing it N times produces the same result as performing it once.

### Why It's Critical in Distributed Systems

In distributed systems, three things WILL happen:
1. **Network timeout:** Client sends request, server processes it, but the response is lost. Client doesn't know if it succeeded.
2. **Client retry:** Client resends the same request. Without idempotency → double processing.
3. **Message duplication:** Message queue delivers the same message twice.

```
Without idempotency:
  Client → "Charge $100" → timeout → Client: "Did it work? Let me retry"
  Client → "Charge $100" → success
  Result: Customer charged $200! 💸💸

With idempotency:
  Client → "Charge $100 (key: abc-123)" → timeout → Client: "Let me retry"
  Client → "Charge $100 (key: abc-123)" → Server: "Already processed abc-123, here's the result"
  Result: Customer charged $100 ✓
```

### Idempotency Key Pattern

```
POST /api/payments
Headers:
  Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Body:
  { "amount": 100, "currency": "USD", "to": "merchant_42" }
```

**Server-side logic:**
```python
def process_payment(request):
    key = request.headers["Idempotency-Key"]
    
    # Check if we've seen this key before
    existing = db.get("idempotency:" + key)
    if existing:
        return existing.response  # Return the cached response (no double processing)
    
    # Process the payment
    result = payment_gateway.charge(request.body)
    
    # Store the result for this key (with TTL, e.g., 24 hours)
    db.set("idempotency:" + key, result, ttl=86400)
    
    return result
```

### Which HTTP Methods Are Naturally Idempotent?

| Method | Idempotent? | Why |
|--------|-------------|-----|
| GET | ✅ Yes | Reading data doesn't change state |
| PUT | ✅ Yes | Replaces entire resource — same input = same state |
| DELETE | ✅ Yes | Deleting something twice = still deleted |
| HEAD | ✅ Yes | Just reading headers |
| **POST** | ❌ **No** | Creates new resources — each call = new resource |
| PATCH | ❌ Sometimes | Depends on implementation |

**Making POST idempotent:** Use idempotency keys (shown above) or check for existing resources before creating.

### Real-World Examples

**Stripe:** Every API call that creates a resource (charges, customers, subscriptions) accepts an `Idempotency-Key` header. If you retry with the same key, Stripe returns the original response.

**Amazon:** AWS uses request IDs and client tokens for idempotency. `CreateStack` with the same `ClientRequestToken` returns the existing stack.

**Airbnb:** Their payment system uses idempotency keys + a state machine. A payment can only transition Pending → Processing → Completed. Retrying a completed payment is a no-op.

---

## 2. Rate Limiting

### What It Is
Controlling how many requests a client can make in a given time period.

### Why It Matters
- **Prevent abuse:** Stop bad actors from overwhelming your API
- **Fair usage:** No single client hogs all capacity
- **Cost control:** Limit expensive operations (AI model calls, SMS sending)
- **Protect infrastructure:** Prevent cascading failures from traffic spikes

### Rate Limiting Algorithms — Deep Dive

#### Token Bucket (Most Common)

```
Bucket capacity: 10 tokens
Refill rate: 1 token/second

t=0:  [🪙🪙🪙🪙🪙🪙🪙🪙🪙🪙] 10 tokens — full bucket
t=0:  Request → consume 1 token → 9 tokens → ALLOWED
t=0:  Request → consume 1 token → 8 tokens → ALLOWED
...
t=0:  10th request → 0 tokens → ALLOWED
t=0:  11th request → 0 tokens → REJECTED (429)
t=1:  1 token refilled → [🪙] → next request allowed
```

**Pros:** Allows bursts (up to bucket size), smooth long-term rate. The most intuitive.
**Used by:** AWS, Stripe, most production systems.

#### Sliding Window Counter (Best Balance)

Combines the accuracy of sliding window log with the efficiency of fixed window:

```
Window: 1 minute, Limit: 100 requests
Current time: 1:15 (15 seconds into the current window)

Previous window (0:00-1:00): 84 requests
Current window  (1:00-2:00): 36 requests so far

Weighted count = 84 × (45/60) + 36 × (15/60) = 63 + 9 = 72
72 < 100 → ALLOWED
```

**Pros:** No boundary-burst problem, good accuracy, low memory.

#### Distributed Rate Limiting with Redis

```lua
-- Redis Lua script (atomic, prevents race conditions)
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call('GET', key)

if current and tonumber(current) >= limit then
    return 0  -- Rate limited
end

current = redis.call('INCR', key)
if tonumber(current) == 1 then
    redis.call('EXPIRE', key, window)
end
return 1  -- Allowed
```

### Rate Limiting Headers (Industry Standard)

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100         ← Max requests per window
X-RateLimit-Remaining: 67      ← Requests left in current window
X-RateLimit-Reset: 1634000000  ← Unix timestamp when window resets

HTTP/1.1 429 Too Many Requests
Retry-After: 30                ← Seconds to wait before retrying
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1634000030
```

### Rate Limiting Strategies

| Strategy | Description | Example |
|----------|-------------|---------|
| **Per-user** | Each authenticated user has their own limit | 1000 req/hour per user |
| **Per-IP** | Each IP address has a limit | 100 req/min per IP |
| **Per-API-key** | Each API key has a limit | Based on pricing tier |
| **Per-endpoint** | Different limits for different endpoints | POST /payments: 10/min, GET /products: 1000/min |
| **Global** | Total limit across all clients | System can handle 100K req/sec total |

---

## 3. Webhooks

### What They Are
Webhooks are HTTP callbacks — when an event occurs, the server sends an HTTP POST to a pre-registered URL.

```
Traditional polling:
  Client: "Any new orders?" → "No"
  Client: "Any new orders?" → "No"
  Client: "Any new orders?" → "Yes!" (wasted 2 requests)

Webhook (push):
  Server: (order placed) → POST https://your-app.com/webhook/orders → { order data }
  (No wasted requests! Immediate notification!)
```

### Webhook Design — Best Practices

**1. Payload design:**
```json
{
  "event": "payment.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "payment_id": "pay_abc123",
    "amount": 5000,
    "currency": "usd"
  },
  "webhook_id": "wh_xyz789"
}
```

**2. Security — HMAC Signature Verification:**
```
Server computes: HMAC-SHA256(webhook_secret, request_body) → signature
Server sends:    X-Signature: sha256=abc123def456...
Client verifies: recompute HMAC with their copy of the secret, compare to header
```

This ensures the webhook came from the real server, not an attacker.

**3. Retry with Exponential Backoff:**
```
First attempt:    immediately
If 5xx/timeout:   retry after 1 minute
If still failing: retry after 5 minutes
Then:             retry after 30 minutes
Then:             retry after 2 hours
After 3 days:     give up, alert admin
```

**4. Idempotency:** Webhooks can be delivered multiple times (retries). Include a unique `webhook_id` so the receiver can deduplicate.

**5. Quick Response:** The receiver should return 200 OK quickly (<5 seconds), then process the event asynchronously. Don't make the sender wait.

```
Sender → POST /webhook → Receiver: store event in queue → return 200 OK (fast!)
                          Worker: process event from queue (async)
```

### Real-World Webhook Examples

| Provider | Events | Webhook URL |
|----------|--------|-------------|
| **Stripe** | `payment_intent.succeeded`, `invoice.paid`, `customer.subscription.deleted` | Your server's `/webhooks/stripe` |
| **GitHub** | `push`, `pull_request.opened`, `issues.created` | Your CI/CD server |
| **Twilio** | `message.received`, `call.completed` | Your app server |
| **Shopify** | `orders/create`, `products/update` | Your fulfillment system |

---

## 🎤 Interview Questions & Expected Answers

### Q1: "How would you ensure that a payment is never processed twice in a distributed system?"

**Expected answer:**
> "I'd use the idempotency key pattern combined with a state machine:
>
> 1. **Idempotency key:** Client generates a UUID for each payment intent and includes it in the request. Server stores a mapping of `idempotency_key → result` in the database.
>
> 2. **Before processing:** Check if the key exists. If yes, return the stored result (no reprocessing).
>
> 3. **Atomic state machine:** The payment record has states: `created → processing → completed/failed`. Use database transactions with optimistic locking:
>    ```sql
>    UPDATE payments SET status = 'processing' WHERE id = ? AND status = 'created';
>    -- If affected rows = 0, the payment already moved past 'created' state
>    ```
>
> 4. **Database constraint:** Unique index on `idempotency_key` prevents duplicate inserts at the DB level, even if the application check has a race condition.
>
> 5. **Cleanup:** Store idempotency keys with a TTL (e.g., 24 hours). After that, the key expires and a new request with the same key would be treated as new.
>
> This gives us defense in depth: application-level check, database constraint, and state machine transitions."

### Q2: "Design a rate limiter for a large-scale API serving 100,000 requests per second."

**Expected answer:**
> "At that scale, the rate limiter itself must be distributed and fast:
>
> **Algorithm:** Token bucket per client (allows bursts, intuitive for users).
>
> **Storage:** Redis Cluster. Each rate limit check is a single Lua script execution (~0.1ms). Redis can handle 100K+ operations per second per node.
>
> **Architecture:**
> ```
> Client → API Gateway → [Rate Limit Check (Redis)] → Backend Service
> ```
>
> **Implementation:**
> - Key: `ratelimit:{user_id}:{endpoint}` or `ratelimit:{api_key}`
> - Use Redis Lua script for atomic check-and-decrement
> - Shard across Redis cluster by key hash
>
> **Multi-tier limits:**
> - Per second: 50 req/s (prevent bursts)
> - Per minute: 1000 req/min (sustained rate)
> - Per hour: 10000 req/hr (overall cap)
>
> **Edge cases:**
> - If Redis is down, fail open (allow requests) or fail closed (reject) based on criticality
> - For truly global rate limiting across multiple data centers, use a local rate limiter + periodic sync to a central store
> - Return proper 429 responses with `Retry-After` header
>
> **Monitoring:** Track rate limit hits by user, endpoint, and API key. Alert on sudden spikes (potential abuse or misconfigured client)."

### Q3: "How would you design a webhook delivery system that handles millions of events per day?"

**Expected answer:**
> "A reliable webhook system needs to handle high volume, retries, and failures gracefully:
>
> **Architecture:**
> ```
> Event Source → [Kafka Topic] → [Webhook Worker Pool] → HTTPS POST to customer URLs
>                                        ↓ (on failure)
>                                [Retry Queue (delayed)]
>                                        ↓ (after max retries)
>                                [Dead Letter Queue] → Alert + Manual Review
> ```
>
> **Key design decisions:**
>
> 1. **Event ingestion:** Events go to Kafka first (durable buffer). Decouples event generation from delivery.
>
> 2. **Worker pool:** Multiple workers consume from Kafka, each delivering webhooks. Horizontally scalable.
>
> 3. **Per-destination queuing:** Separate queue per destination URL. If one customer's endpoint is slow, it doesn't block others.
>
> 4. **Retry strategy:** Exponential backoff (1min → 5min → 30min → 2hr → 12hr). Max retries: 5-10 over 3 days.
>
> 5. **Timeout:** 5-second timeout per delivery attempt. Don't let slow receivers tie up workers.
>
> 6. **Security:** Sign payloads with HMAC-SHA256. Include signature in header for verification.
>
> 7. **Idempotency:** Include unique event ID. Receivers should deduplicate.
>
> 8. **Monitoring dashboard:** Show customers their webhook delivery status, failures, and let them retry manually.
>
> 9. **Circuit breaker per destination:** If a customer's URL fails consistently, stop sending and notify them, rather than burning resources on retries."
