# 🌐 Networking Fundamentals

Understanding networking is crucial because every distributed system is built on top of networks. These concepts come up constantly in system design discussions.

---

## 1. OSI Model

The OSI (Open Systems Interconnection) model is a conceptual framework with 7 layers. For system design, you mainly care about layers 3-7:

```
Layer 7: Application    → HTTP, HTTPS, WebSocket, DNS, FTP
Layer 6: Presentation   → Encryption/Decryption, Compression (SSL/TLS)
Layer 5: Session        → Session management, authentication
Layer 4: Transport      → TCP, UDP — port-to-port delivery
Layer 3: Network        → IP — host-to-host routing across networks
Layer 2: Data Link      → MAC addresses, Ethernet, switches
Layer 1: Physical       → Cables, radio waves, fiber optics
```

**Why it matters for system design:**
- **Load balancers** can operate at Layer 4 (TCP — fast, no content inspection) or Layer 7 (HTTP — can route based on URL, headers, cookies)
- **Firewalls** can filter at Layer 3/4 (IP/port) or Layer 7 (application content)
- **CDNs** operate at Layer 7 (cache based on URL/content type)
- **TLS encryption** happens at Layer 5/6

---

## 2. IP Addresses

**IPv4:** 32-bit address → 4.3 billion addresses (running out!)
- Format: `192.168.1.1`
- Private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`

**IPv6:** 128-bit address → essentially unlimited
- Format: `2001:0db8:85a3::8a2e:0370:7334`

**For system design, know these:**
- **Public IP:** Globally routable, assigned by ISP
- **Private IP:** Used within a network (e.g., inside a VPC/data center)
- **Virtual IP (VIP):** A floating IP that can be reassigned between servers (used for failover)
- **NAT (Network Address Translation):** Maps private IPs to public IPs — lets many devices share one public IP

**Subnets and CIDR:**
- `10.0.0.0/24` means 256 addresses (10.0.0.0 to 10.0.0.255)
- Used to segment networks in cloud deployments (VPCs, subnets)

---

## 3. Domain Name System (DNS)

**What it is:** The "phone book of the internet" — translates human-readable domain names (google.com) to IP addresses (142.250.80.46).

**How DNS resolution works (simplified):**

```
Browser → Local Cache → OS Cache → Router Cache → ISP's DNS Resolver
    → Root DNS Server (.com, .org, .net)
        → TLD Server (.com)
            → Authoritative Name Server (google.com → 142.250.80.46)
```

**DNS Record Types:**
| Type | Purpose | Example |
|------|---------|---------|
| A | Maps domain to IPv4 | `google.com → 142.250.80.46` |
| AAAA | Maps domain to IPv6 | `google.com → 2607:f8b0::` |
| CNAME | Alias to another domain | `www.example.com → example.com` |
| NS | Nameserver for domain | `example.com → ns1.example.com` |
| MX | Mail server | `example.com → mail.example.com` |
| TXT | Arbitrary text (verification, SPF) | `example.com → "v=spf1 ..."` |

**DNS in System Design:**
- **DNS-based load balancing:** Return different IPs for the same domain (round-robin)
- **GeoDNS:** Return different IPs based on user's geographic location → route to nearest data center
- **TTL (Time to Live):** How long DNS responses are cached. Lower TTL = faster failover but more DNS traffic
- **DNS as SPOF:** Use multiple DNS providers (e.g., Route 53 + Cloudflare)

---

## 4. Proxy vs Reverse Proxy

**Forward Proxy:**
```
Client → [Forward Proxy] → Internet → Server
```
- Sits in front of CLIENTS
- Client knows about the proxy; server doesn't know the real client
- Use cases: Anonymity, content filtering, caching for an organization, bypassing geo-restrictions
- Examples: VPN, corporate proxy, Tor

**Reverse Proxy:**
```
Client → Internet → [Reverse Proxy] → Server(s)
```
- Sits in front of SERVERS
- Client doesn't know about the backend servers
- Use cases: Load balancing, SSL termination, caching, DDoS protection, compression
- Examples: Nginx, HAProxy, AWS ALB, Cloudflare

**Key differences:**
| Aspect | Forward Proxy | Reverse Proxy |
|--------|--------------|---------------|
| Protects | Clients | Servers |
| Client awareness | Client configures it | Client doesn't know |
| Hides | Client's identity | Server's identity |
| Common use | Corporate networks | Web applications |

**Interview tip:** When designing web-scale systems, you'll almost always have a reverse proxy (usually as a load balancer or API gateway) in front of your application servers.

---

## 5. HTTP / HTTPS

**HTTP (HyperText Transfer Protocol):**
- Application layer protocol (Layer 7)
- Stateless: each request is independent (server doesn't remember previous requests)
- Request/Response model

**Key HTTP methods:**
| Method | Purpose | Idempotent? | Safe? |
|--------|---------|-------------|-------|
| GET | Read data | Yes | Yes |
| POST | Create data | No | No |
| PUT | Replace data entirely | Yes | No |
| PATCH | Update data partially | No | No |
| DELETE | Remove data | Yes | No |

**HTTP Status Codes:**
- `2xx` Success: 200 OK, 201 Created, 204 No Content
- `3xx` Redirect: 301 Moved Permanently, 302 Found, 304 Not Modified
- `4xx` Client Error: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests
- `5xx` Server Error: 500 Internal Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout

**HTTP versions:**
- **HTTP/1.1:** One request per TCP connection at a time (head-of-line blocking). Keep-alive helps reuse connections.
- **HTTP/2:** Multiplexing (multiple requests over one connection), header compression, server push.
- **HTTP/3:** Uses QUIC (UDP-based) instead of TCP. Faster connection setup, better on unreliable networks.

**HTTPS:**
- HTTP + TLS (Transport Layer Security)
- Encrypts data in transit → prevents eavesdropping, tampering
- Uses certificates to verify server identity
- TLS handshake adds latency (mitigated with TLS 1.3, session resumption)

---

## 6. TCP vs UDP

**TCP (Transmission Control Protocol):**
- **Connection-oriented:** 3-way handshake (SYN, SYN-ACK, ACK) before data transfer
- **Reliable:** Guarantees delivery, ordering, no duplicates
- **Flow control:** Adjusts sending rate based on receiver capacity
- **Congestion control:** Slows down when network is congested
- Use cases: Web browsing (HTTP), email, file transfer, database connections

**UDP (User Datagram Protocol):**
- **Connectionless:** Just fire and forget — no handshake
- **Unreliable:** No delivery guarantee, no ordering, possible duplicates
- **Fast:** No overhead of connection management, acknowledgments
- Use cases: Live video/audio streaming, online gaming, DNS queries, IoT

**Comparison:**
| Feature | TCP | UDP |
|---------|-----|-----|
| Reliability | Guaranteed delivery | Best effort |
| Ordering | Maintains order | No ordering |
| Speed | Slower (overhead) | Faster (no overhead) |
| Connection | Required (handshake) | Not required |
| Use case | Correctness matters | Speed matters |

**Interview relevance:**
- Designing a **chat app** → TCP (messages must be delivered reliably)
- Designing a **video call** → UDP (a few dropped frames are OK; latency matters more)
- Designing a **live streaming** service → UDP with application-layer reliability
- Designing **DNS** → UDP for queries (small, fast), TCP for zone transfers (large, reliable)

---

## 7. Load Balancing

**What it is:** Distributing incoming network traffic across multiple servers to ensure no single server is overwhelmed.

**Load Balancing Algorithms:**

| Algorithm | How it works | Best for |
|-----------|-------------|----------|
| **Round Robin** | Requests go 1, 2, 3, 1, 2, 3... | Equal-capacity servers, stateless apps |
| **Weighted Round Robin** | More traffic to higher-capacity servers | Heterogeneous servers |
| **Least Connections** | Send to server with fewest active connections | Long-lived connections (WebSockets) |
| **Least Response Time** | Send to server with fastest response | Varying server performance |
| **IP Hash** | Hash client IP to always reach same server | Session stickiness without cookies |
| **Consistent Hashing** | Minimize redistribution when servers change | Caching layers, distributed stores |
| **Random** | Pick a random server | Simple, surprisingly effective |

**Layer 4 vs Layer 7 Load Balancing:**

| Feature | Layer 4 (Transport) | Layer 7 (Application) |
|---------|---------------------|----------------------|
| Operates on | TCP/UDP packets | HTTP requests |
| Speed | Very fast | Slower (inspects content) |
| Routing decisions | IP + Port | URL, headers, cookies, body |
| SSL termination | No (pass-through) | Yes |
| Use case | High throughput, simple routing | Content-based routing, API gateway |

**Where load balancers sit:**
```
Internet → DNS LB → L4 LB → L7 LB → Application Servers
                                    → Database (read replicas)
                                    → Cache servers
```

**Health checks:** LB periodically pings servers. If a server fails health checks, it's removed from the pool until it recovers.

**Global Server Load Balancing (GSLB):** DNS-based LB that routes users to the nearest healthy data center.

---

## 8. Checksums

**What it is:** A small fixed-size value computed from a data block, used to detect data corruption during storage or transmission.

**How it works:**
1. Sender computes checksum of data and sends both
2. Receiver recomputes checksum and compares
3. If they match → data is (probably) intact
4. If they don't match → data was corrupted

**Common checksum/hash algorithms:**
| Algorithm | Output Size | Use Case |
|-----------|------------|----------|
| CRC32 | 32 bits | Network packets, file integrity |
| MD5 | 128 bits | File verification (not security!) |
| SHA-256 | 256 bits | Cryptographic verification, blockchain |
| xxHash | 64/128 bits | Fast hashing for data structures |

**Where checksums are used in system design:**
- **Network protocols:** TCP includes checksums in every segment
- **Distributed storage:** S3, HDFS verify data integrity with checksums
- **Database pages:** Databases checksum their storage pages to detect disk corruption
- **Data replication:** Compare checksums to verify replicas are in sync (anti-entropy)
- **Deduplication:** Hash file contents to find duplicates (e.g., Dropbox)
- **ETags:** HTTP caching uses checksums to check if content has changed

**Interview tip:** Mention checksums when discussing data integrity in storage systems, file uploads, or data replication. It shows you think about correctness at the byte level.
