# 🔀 Proxies, Reverse Proxies & Load Balancing — Deep Dive

## Forward Proxy

**What it is:** An intermediary that sits in front of CLIENTS, forwarding their requests to the internet.

```
[Client A] ──┐
[Client B] ──┼──→ [Forward Proxy] ──→ Internet ──→ [Server]
[Client C] ──┘
```

The server sees the proxy's IP, not the client's IP. The client explicitly configures the proxy.

**Use cases:**
| Use Case | How |
|----------|-----|
| **Anonymity** | Server doesn't know the real client IP |
| **Content filtering** | Corporate proxy blocks social media during work hours |
| **Caching** | Proxy caches frequently-accessed content for all clients |
| **Geo-unblocking** | Proxy in another country to access geo-restricted content |
| **Logging & monitoring** | Organization monitors all outgoing traffic |

**Examples:** Squid proxy, corporate firewalls, VPNs (which are essentially encrypted forward proxies).

---

## Reverse Proxy

**What it is:** An intermediary that sits in front of SERVERS, receiving client requests and forwarding them to backend servers.

```
[Client] ──→ Internet ──→ [Reverse Proxy] ──→ [Server A]
                                            ──→ [Server B]
                                            ──→ [Server C]
```

The client sees the proxy's IP, not the backend servers' IPs. The client doesn't know the proxy exists.

**What a reverse proxy does:**

| Feature | Description |
|---------|-------------|
| **Load balancing** | Distributes requests across multiple backend servers |
| **SSL/TLS termination** | Handles HTTPS encryption; backends use plain HTTP (faster) |
| **Caching** | Caches static content, reducing load on backends |
| **Compression** | Compresses responses (gzip/brotli) before sending to client |
| **DDoS protection** | Absorbs/filters malicious traffic at the edge |
| **Request routing** | Routes `/api/*` to API servers, `/static/*` to file servers |
| **Rate limiting** | Limits requests per client to prevent abuse |
| **Security** | Hides backend server details (IP, technology stack) |
| **Health checking** | Monitors backends, removes unhealthy ones |
| **Connection pooling** | Maintains persistent connections to backends, multiplexes client connections |

**Popular reverse proxies:** Nginx, HAProxy, Envoy, Traefik, Caddy, AWS ALB/NLB, Cloudflare

---

## Load Balancing — Deep Dive

### Load Balancing Algorithms

#### 1. Round Robin
```
Request 1 → Server A
Request 2 → Server B
Request 3 → Server C
Request 4 → Server A (cycle repeats)
```
- **Pros:** Simplest algorithm. Equal distribution.
- **Cons:** Doesn't account for server capacity or current load. Long-lived requests can cause imbalance.
- **Best for:** Identical servers with uniform request processing times.

#### 2. Weighted Round Robin
```
Server A (weight 5): Gets 5 out of every 8 requests
Server B (weight 2): Gets 2 out of every 8 requests
Server C (weight 1): Gets 1 out of every 8 requests
```
- **Best for:** Heterogeneous servers (different capacities).

#### 3. Least Connections
```
Server A: 12 active connections → skip
Server B: 3 active connections  → SEND HERE
Server C: 8 active connections  → skip
```
- **Pros:** Accounts for actual server load. Great for varying request durations.
- **Cons:** Doesn't account for server capacity (a weak server with few connections might be overloaded).
- **Best for:** Long-lived connections (WebSockets, database connections).

#### 4. Least Response Time
```
Server A: avg response 50ms  → SEND HERE
Server B: avg response 200ms → skip (probably under stress)
Server C: avg response 80ms  → backup choice
```
- **Pros:** Routes to the actually fastest server. Self-correcting.
- **Best for:** When backend performance varies dynamically.

#### 5. IP Hash
```
hash(client_ip) % num_servers → always routes to the same server
```
- **Pros:** Session persistence without cookies. Same client always reaches same server.
- **Cons:** Uneven distribution if IP ranges are clustered. Adding/removing servers remaps most clients.
- **Best for:** Session-sticky applications (if you can't externalize sessions).

#### 6. Consistent Hashing
- Same as IP hash but with minimal disruption when servers are added/removed.
- Only ~K/N keys are remapped (not all of them).
- **Best for:** Cache servers, distributed data stores.

#### 7. Random with Two Choices (Power of Two)
```
Pick 2 random servers → send to the one with fewer connections
```
- Surprisingly effective! Provides near-optimal load distribution with minimal overhead.
- Used by Nginx (upstream least_conn with randomization).

---

### Layer 4 vs Layer 7 Load Balancing

| Aspect | Layer 4 | Layer 7 |
|--------|---------|---------|
| **Operates at** | TCP/UDP (transport) | HTTP/HTTPS (application) |
| **Inspects** | IP + Port only | URL, headers, cookies, body |
| **Speed** | Very fast (just forwards packets) | Slower (must parse HTTP) |
| **SSL termination** | No (passes encrypted traffic through) | Yes (decrypts, inspects, re-encrypts or sends plain HTTP) |
| **Content routing** | No | Yes (`/api` → service A, `/web` → service B) |
| **Session persistence** | By source IP | By cookie, header, or URL |
| **WebSocket support** | Yes (just TCP) | Yes (understands Upgrade header) |
| **Use case** | High throughput, simple distribution | Smart routing, API gateway |

**Real architecture pattern:**
```
Internet → [L4 LB (NLB)] → [L7 LB (ALB/Nginx)] → [Backend Services]
            fast, handles     smart routing,
            millions of       SSL termination,
            connections       content-based routing
```

### Global Server Load Balancing (GSLB)

For multi-region deployments, GSLB routes users to the nearest healthy data center:

```
User in Tokyo → [DNS/GSLB] → "Tokyo DC is closest and healthy" → routes to Tokyo
User in NYC   → [DNS/GSLB] → "US-East DC is closest" → routes to US-East
```

**Mechanisms:**
- **GeoDNS:** Return different IPs based on client location.
- **Anycast:** Same IP announced from multiple locations; BGP routing picks the nearest.
- **Global LB (Cloudflare, AWS Global Accelerator):** Intelligent routing based on latency, health, and capacity.

---

### Health Checks

Load balancers continuously monitor backend health:

```
LB → GET /health → Server A: 200 OK ✓ (healthy)
LB → GET /health → Server B: 500 Error ✗ (unhealthy → remove from pool)
LB → GET /health → Server C: timeout ✗ (unhealthy → remove from pool)
```

**Health check parameters:**
- **Interval:** How often to check (e.g., every 10 seconds)
- **Timeout:** How long to wait for response (e.g., 5 seconds)
- **Unhealthy threshold:** How many consecutive failures before marking unhealthy (e.g., 3)
- **Healthy threshold:** How many consecutive successes to mark as healthy again (e.g., 2)

**Shallow vs deep health checks:**
```
Shallow: GET /health → return 200 (just checks if process is alive)
Deep:    GET /health → check DB connection, check Redis, check disk space → return 200 or 500
```

Deep checks are more useful but can be expensive. A common pattern: shallow checks frequently (every 5s), deep checks less often (every 30s).

---

## 🎤 Interview Questions & Expected Answers

### Q1: "What's the difference between a forward proxy and a reverse proxy?"

**Expected answer:**
> "A **forward proxy** sits in front of clients. The client knows about the proxy and sends requests through it. The server doesn't know the real client. Use cases: corporate content filtering, anonymity, caching for an organization.
>
> A **reverse proxy** sits in front of servers. The client doesn't know about the proxy — it thinks it's talking directly to the server. Use cases: load balancing, SSL termination, caching, DDoS protection, request routing.
>
> The key distinction: forward proxy protects clients, reverse proxy protects servers.
>
> In system design, we almost always use reverse proxies. Nginx, HAProxy, AWS ALB — these are all reverse proxies that provide load balancing, SSL termination, and more."

### Q2: "How would you choose a load balancing algorithm for a microservices architecture?"

**Expected answer:**
> "It depends on the characteristics of the services:
>
> **Stateless APIs with similar request durations:** Round Robin. Simple and effective when all servers are identical and requests take roughly the same time.
>
> **Servers with different capacities:** Weighted Round Robin. Assign higher weights to more powerful servers.
>
> **Services with variable request durations (like video processing):** Least Connections. Routes new requests to the server handling the fewest requests, naturally balancing load.
>
> **Services where performance varies dynamically:** Least Response Time. Routes to the currently fastest server, adapting to changing conditions.
>
> **Services needing session persistence:** IP Hash or cookie-based sticky sessions. Same client always reaches the same server.
>
> **Cache layers:** Consistent Hashing. Same key always goes to the same cache server, maximizing cache hit ratio. Minimal disruption when servers change.
>
> In practice, I'd start with Round Robin for most services and switch to Least Connections for services with variable request durations. I'd use Consistent Hashing specifically for distributed caches."

### Q3: "Your website is getting DDoS attacked. How does your load balancer and proxy help?"

**Expected answer:**
> "Multiple layers of defense:
>
> 1. **CDN/Edge proxy (Cloudflare, AWS Shield):** Absorbs volumetric attacks at the edge before traffic reaches my infrastructure. Anycast distributes attack traffic across hundreds of PoPs.
>
> 2. **Rate limiting at the reverse proxy:** Nginx can limit requests per IP (`limit_req_zone`). Legitimate users typically make <100 req/s; attackers make thousands. Rate limiting drops excess traffic.
>
> 3. **Connection limits:** The LB limits concurrent connections per IP. An attacker trying to exhaust connections is throttled.
>
> 4. **L4 filtering:** Network load balancer can drop traffic from known-bad IP ranges (geo-blocking, blacklists).
>
> 5. **L7 inspection:** Application load balancer can inspect HTTP patterns. If the attack uses specific patterns (all hitting `/search`, same User-Agent), create rules to block those patterns.
>
> 6. **Auto-scaling:** Even during an attack, if some traffic is legitimate, auto-scaling adds backend capacity to handle the load.
>
> 7. **Health check isolation:** The LB's health checks ensure that even if some backends are overwhelmed, traffic only goes to healthy ones.
>
> The key is defense in depth: filter as early as possible (edge > LB > application), and use the reverse proxy to hide your origin servers' real IPs."

---

## 🧠 Mental Model

```
Forward Proxy = A personal assistant who makes calls on your behalf
  → The person you're calling doesn't know who you really are
  → Your assistant can filter what you're allowed to call (content filtering)
  → Your assistant remembers frequent numbers (caching)

Reverse Proxy = A receptionist at a company
  → Callers don't know which employee will handle their call
  → The receptionist routes calls to available staff (load balancing)
  → The receptionist screens calls (security, rate limiting)
  → The receptionist can answer frequent questions themselves (caching)

Load Balancer = A traffic cop at a busy intersection
  → Directs each car (request) to the least congested lane (server)
  → If a lane is blocked (server down), redirects traffic to other lanes
  → Different strategies: take turns (round robin), pick shortest lane (least connections)
```
