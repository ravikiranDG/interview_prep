# 💻 System Design Interview Problems — Easy

For each problem, I provide: Requirements, High-Level Design, Key Components, Data Model, and Tradeoffs.

---

## 1. Design URL Shortener (like TinyURL)

### Requirements
- **Functional:** Shorten a URL, redirect short URL to original, custom aliases (optional), analytics (click count), expiration
- **Non-functional:** 100M URLs/day, 10:1 read:write, <100ms redirect latency, high availability

### Estimation
- Writes: ~1200 URLs/sec, Reads: ~12,000 redirects/sec
- Storage: 100M × 500 bytes × 365 days × 5 years ≈ 90 TB

### High-Level Design
```
Client → [LB] → [API Servers] → [Cache (Redis)] → [Database]
                                                    ↓
Short URL: base62(hash) or base62(auto-increment ID)
```

### Key Decisions
- **URL generation:** Use a globally unique ID generator (auto-increment with distributed ID generator like Snowflake) → encode in base62 (a-z, A-Z, 0-9)
- 7 characters of base62 = 62^7 = ~3.5 trillion unique URLs
- **Database:** NoSQL (DynamoDB/Cassandra) — simple key-value lookup, high throughput
- **Caching:** Redis cache for hot URLs (80/20 rule — 20% of URLs get 80% traffic)

### Data Model
```
URL Table:
  short_url (PK): "abc1234"
  original_url: "https://example.com/very/long/path"
  created_at: timestamp
  expires_at: timestamp
  user_id: (optional)
```

### API Design
```
POST /api/shorten  { url: "https://...", custom_alias: "my-link" }  → { short_url: "tiny.url/abc1234" }
GET  /abc1234      → 301/302 Redirect to original URL
```

### Tradeoffs
- **301 vs 302 redirect:** 301 (permanent) — browser caches, fewer server hits, but lose analytics. 302 (temporary) — every request hits server, better for analytics.
- **Hash collision:** If using hash-based approach, handle collisions by appending and re-hashing
- **Rate limiting:** Prevent abuse (spammers creating millions of short URLs)

---

## 2. Design Autocomplete / Typeahead

### Requirements
- As user types, suggest top 10 completions
- Rank by popularity/relevance
- Low latency (<100ms)
- Support billions of queries

### High-Level Design
```
User types "syst" → [API Server] → [Trie Service (in-memory)] → ["system design", "system of a down", ...]
                                          ↑
                                    [Periodic data aggregation from search logs]
```

### Key Data Structure: Trie (Prefix Tree)
```
         root
        / | \
       s  a  b
      /
     y
    /
   s    → stores: [("system design", 50K), ("systems biology", 10K)]
  /
 t
/
e
/
m  → top K suggestions precomputed at each node
```

### Key Decisions
- **Trie with top-K at each node:** Precompute top suggestions at every prefix node → O(1) lookup
- **Data collection:** Aggregate search queries in a pipeline (Kafka → Spark → Update Trie)
- **Update frequency:** Rebuild trie periodically (hourly/daily), not real-time
- **Sharding:** Shard by prefix range (a-m → Shard 1, n-z → Shard 2) or by consistent hashing
- **Caching:** Cache popular prefixes in CDN/browser (most people type the same things)

### Tradeoffs
- Trie in-memory = fast but limited by RAM → shard across machines
- Real-time updates vs periodic rebuilds → periodic is simpler and sufficient

---

## 3. Design a Load Balancer

### Requirements
- Distribute traffic across backend servers
- Health checking and automatic failover
- Support multiple algorithms
- Handle millions of concurrent connections

### High-Level Design
```
Client → [Load Balancer] → [Server Pool]
              ↓
         [Health Checker] → monitors all servers
              ↓
         [Config Store]   → routing rules, weights
```

### Key Components
1. **Request Router:** Accepts connections, applies algorithm, forwards to backend
2. **Health Checker:** Periodic health checks (HTTP GET /health, TCP connect, custom scripts)
3. **Server Pool Manager:** Add/remove servers, track weights and capacity
4. **Session Persistence:** Sticky sessions (if needed) via cookies or IP hash

### Algorithms
- Round Robin, Weighted Round Robin
- Least Connections, Least Response Time
- IP Hash, Consistent Hashing
- Random with Two Choices (pick 2 random servers, choose the less loaded one — surprisingly effective)

### L4 vs L7
- **L4:** Operates on TCP/UDP. Faster, can't inspect content. Use for raw throughput.
- **L7:** Operates on HTTP. Can route by URL path, header, cookie. Use for application-aware routing.

---

## 4. Design a CDN

### Requirements
- Serve static content globally with low latency
- Handle cache invalidation
- Support origin shielding
- Absorb traffic spikes (DDoS resilience)

### High-Level Design
```
User → [Nearest Edge Server (PoP)] → Cache HIT → Serve content
                                   → Cache MISS → [Origin Shield] → [Origin Server]
```

### Key Decisions
- **PoP placement:** Edge servers in major cities worldwide
- **DNS-based routing:** GeoDNS routes users to nearest PoP
- **Origin Shield:** An intermediate cache layer that reduces origin hits (only one PoP fetches from origin, others fetch from shield)
- **Cache key:** URL + headers (Accept-Encoding, Accept-Language)
- **Purging:** API-based invalidation, TTL-based expiry, versioned URLs
- **Push vs Pull:** Pull (lazy load on first request) for most content; Push for critical assets

---

## 5. Design a Distributed Key-Value Store

### Requirements
- GET(key) → value, PUT(key, value)
- High availability, partition tolerant
- Tunable consistency
- Horizontal scaling

### High-Level Design
```
Client → [Coordinator Node] → [Consistent Hash Ring] → [Responsible Nodes (N replicas)]
```

### Key Decisions (DynamoDB/Cassandra style)
- **Partitioning:** Consistent hashing with virtual nodes
- **Replication:** Each key stored on N nodes (e.g., N=3)
- **Consistency:** Quorum reads/writes (W + R > N for strong consistency)
  - W=1, R=1: Fast but eventual consistency
  - W=2, R=2 (N=3): Strong consistency
- **Conflict resolution:** Vector clocks + last-write-wins or application-level merge
- **Failure detection:** Gossip protocol
- **Temporary failures:** Hinted handoff (write to a different node, replay later)
- **Permanent failures:** Anti-entropy with Merkle trees (compare hash trees to find differences)

### Data Model
```
Key: user:123:profile
Value: { serialized data }
Metadata: version_vector, timestamp, TTL
```

---

## 6. Design a Distributed Cache

### Requirements
- In-memory key-value store across multiple machines
- Low latency (<1ms), high throughput
- Eviction policies, TTL support
- Handle node failures gracefully

### High-Level Design
```
App Servers → [Cache Client Library] → [Consistent Hash Ring] → Cache Nodes [Node A | Node B | Node C]
```

### Key Decisions
- **Partitioning:** Consistent hashing (minimal key redistribution when nodes change)
- **Eviction:** LRU (most common), with TTL as safety net
- **Cache miss handling:** Cache-aside pattern (app queries DB, populates cache)
- **Thundering herd:** Lock on cache key — only one request loads from DB
- **Hot keys:** Replicate hot keys across multiple nodes, or add random suffix (key:1, key:2)
- **Monitoring:** Hit rate, eviction rate, memory usage, latency percentiles

---

## 7. Design an Authentication System

### Requirements
- User registration and login
- Secure password storage
- Session management or token-based auth
- Multi-factor authentication (optional)
- OAuth/SSO integration (optional)

### High-Level Design
```
Client → [API Gateway (rate limiting)] → [Auth Service] → [User DB]
                                                         → [Token Store (Redis)]
```

### Key Decisions
- **Password storage:** NEVER store plaintext. Use bcrypt/scrypt/Argon2 (slow hash + salt)
- **Authentication:** JWT (stateless) vs Session (stateful)
  - **JWT:** Signed token, no server-side storage, but can't revoke easily
  - **Session:** Server stores session ID in Redis, easy to revoke, but needs shared session store
- **Token rotation:** Short-lived access tokens (15 min) + long-lived refresh tokens (7 days)
- **MFA:** TOTP (Google Authenticator), SMS, Email code
- **Rate limiting:** Limit login attempts per IP and per account (prevent brute force)
- **OAuth 2.0:** For "Login with Google/GitHub" — auth code flow for web, PKCE for mobile

### Security Measures
- HTTPS everywhere
- CSRF tokens for form submissions
- Secure cookies (HttpOnly, Secure, SameSite)
- Account lockout after N failed attempts
- Audit logging for all auth events

---

## 8. Design a Parking Garage System

### Requirements
- Track available spots per floor/type (compact, regular, large)
- Issue tickets on entry, calculate fees on exit
- Handle concurrent entry/exit (multiple gates)
- Display availability in real-time

### High-Level Design
```
Entry Gate → [Gate Controller] → [Parking Service] → [Database]
                                        ↑
Exit Gate  → [Gate Controller] ─────────┘
                                        ↓
Display Board ← [Availability Service] ←┘
```

### Data Model
```
ParkingSpot: id, floor, type (compact/regular/large), status (available/occupied)
Ticket: id, spot_id, vehicle_plate, entry_time, exit_time, amount
Vehicle: plate_number, type (compact/regular/large)
```

### Key Decisions
- **Spot assignment:** Nearest available spot of matching type
- **Concurrency:** Optimistic locking or database-level locks to prevent double-booking
- **Pricing:** Time-based (per hour), flat rate, or tiered
- **Real-time availability:** Use Redis counters per floor/type, update on entry/exit
- **Payment:** Integrate with payment gateway at exit

---

## 9. Design a UPI (Unified Payments Interface) System

### Requirements
- Send/receive money between bank accounts via virtual payment address (VPA)
- Instant settlement, real-time notifications
- Idempotent transactions (no double payments)
- High availability, eventual consistency OK for non-critical paths

### High-Level Design
```
User App → [API Gateway] → [UPI Service] → [Bank Switch/NPCI Equivalent]
                                ↓               ↓
                         [Transaction DB]   [Sender's Bank] → [Receiver's Bank]
                                ↓
                         [Notification Service]
```

### Key Decisions
- **Idempotency:** Transaction ID generated client-side, server deduplicates
- **Two-phase approach:** 
  1. Debit sender's account (hold)
  2. Credit receiver's account (settle)
  3. If credit fails → reverse the debit
- **Saga pattern:** For distributed transactions across banks
- **Reconciliation:** Periodic batch reconciliation to catch discrepancies
- **Status tracking:** Pending → Processing → Success/Failed → Settled
- **Timeouts:** If bank doesn't respond in N seconds, mark as "pending" and retry/reconcile

### Tradeoffs
- Strong consistency for individual transactions, eventual consistency for aggregations
- Synchronous user response (acknowledge) + async backend settlement
