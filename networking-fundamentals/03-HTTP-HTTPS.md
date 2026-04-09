# 🔐 HTTP, HTTPS & HTTP Versions — Deep Dive

## What is HTTP?

HTTP (HyperText Transfer Protocol) is the application-layer protocol that powers the web. It defines how clients (browsers, apps) and servers communicate — the format of requests and responses.

**Core characteristics:**
- **Request-Response model:** Client sends a request, server sends a response.
- **Stateless:** Each request is independent. The server doesn't remember previous requests.
- **Text-based (HTTP/1.1):** Human-readable headers and methods.

---

## HTTP Request Anatomy

```
POST /api/users HTTP/1.1          ← Request line (method, path, version)
Host: api.example.com             ← Headers
Content-Type: application/json
Authorization: Bearer eyJhbGc...
Content-Length: 42

{"name": "Alice", "email": "a@b.com"}  ← Body
```

## HTTP Response Anatomy

```
HTTP/1.1 201 Created              ← Status line (version, status code, reason)
Content-Type: application/json    ← Headers
Cache-Control: no-cache
X-Request-Id: abc-123

{"id": 42, "name": "Alice"}      ← Body
```

---

## HTTP Methods — Deep Dive

| Method | Purpose | Idempotent? | Safe? | Has Body? |
|--------|---------|-------------|-------|-----------|
| **GET** | Retrieve a resource | Yes | Yes | No |
| **POST** | Create a resource / trigger action | No | No | Yes |
| **PUT** | Replace a resource entirely | Yes | No | Yes |
| **PATCH** | Update a resource partially | No* | No | Yes |
| **DELETE** | Remove a resource | Yes | No | Optional |
| **HEAD** | Same as GET but no body (just headers) | Yes | Yes | No |
| **OPTIONS** | Describe communication options (CORS preflight) | Yes | Yes | No |

**Safe** = doesn't modify server state (read-only). **Idempotent** = multiple identical requests produce the same result as a single request.

**PUT vs PATCH:**
```
PUT /users/42   {"name": "Alice", "email": "a@b.com", "age": 30}
  → Replaces the ENTIRE user object. If you omit "age", it's deleted.

PATCH /users/42  {"email": "new@email.com"}
  → Updates ONLY the specified fields. Other fields untouched.
```

**POST vs PUT:**
```
POST /users     → Creates a new user. Server assigns the ID. Not idempotent (calling twice = 2 users).
PUT /users/42   → Creates or replaces user 42. Idempotent (calling twice = same result).
```

---

## HTTP Status Codes

### 2xx — Success
| Code | Meaning | When to Use |
|------|---------|-------------|
| **200** OK | Request succeeded | Default success for GET, PUT, PATCH, DELETE |
| **201** Created | Resource was created | After successful POST |
| **202** Accepted | Request accepted for async processing | When work is queued (not yet completed) |
| **204** No Content | Success, but no response body | After DELETE, or PUT with no return body |

### 3xx — Redirection
| Code | Meaning | When to Use |
|------|---------|-------------|
| **301** Moved Permanently | Resource has a new permanent URL | SEO redirects, domain migration. Browser caches. |
| **302** Found | Resource temporarily at a different URL | Temporary redirects. Browser doesn't cache. |
| **304** Not Modified | Resource hasn't changed (use cached version) | Conditional GET with ETag/If-Modified-Since |

### 4xx — Client Error
| Code | Meaning | When to Use |
|------|---------|-------------|
| **400** Bad Request | Malformed request, invalid input | Validation errors |
| **401** Unauthorized | Not authenticated | Missing or invalid auth token |
| **403** Forbidden | Authenticated but not authorized | User doesn't have permission |
| **404** Not Found | Resource doesn't exist | Invalid URL or deleted resource |
| **405** Method Not Allowed | HTTP method not supported for this URL | POST on a read-only endpoint |
| **409** Conflict | Request conflicts with current state | Duplicate creation, version conflict |
| **429** Too Many Requests | Rate limit exceeded | Client sent too many requests |

### 5xx — Server Error
| Code | Meaning | When to Use |
|------|---------|-------------|
| **500** Internal Server Error | Unhandled server exception | Bugs, unexpected errors |
| **502** Bad Gateway | Upstream server returned invalid response | Proxy/LB can't reach backend |
| **503** Service Unavailable | Server temporarily overloaded/down | Maintenance, overload. Include Retry-After header. |
| **504** Gateway Timeout | Upstream server didn't respond in time | Backend too slow |

---

## HTTP Versions

### HTTP/1.0 (1996)
- One request per TCP connection (open → request → response → close)
- Extremely wasteful (TCP handshake for every single request)

### HTTP/1.1 (1997) — Still widely used
**Key improvements:**
- **Keep-Alive:** Reuse TCP connections for multiple requests
- **Pipelining:** Send multiple requests without waiting for responses (rarely used due to head-of-line blocking)
- **Chunked transfer:** Stream responses in chunks
- **Host header:** Multiple websites on one IP (virtual hosting)

**Problem — Head-of-Line (HOL) Blocking:**
```
Connection: Request A → Request B → Request C
If A is slow, B and C wait. Even though B might be fast.
```

**Workaround:** Browsers open 6-8 parallel connections per domain. But this wastes resources.

### HTTP/2 (2015) — Modern standard
**Key improvements:**
- **Multiplexing:** Multiple requests/responses over a SINGLE TCP connection, interleaved.
  ```
  HTTP/1.1:  |--Request A--|--Request B--|--Request C--|  (sequential)
  HTTP/2:    |--A---|--B--|--A--|--C--|--B--|--C--|      (interleaved on one connection)
  ```
- **Header compression (HPACK):** Dramatically reduces header size (headers are sent with every request — they're often repetitive).
- **Server Push:** Server proactively sends resources the client will need (e.g., push CSS/JS when HTML is requested). Rarely used in practice.
- **Binary framing:** Binary protocol (not text). More efficient parsing.
- **Stream prioritization:** Client can indicate which resources are most important.

**Still has a problem:** TCP-level HOL blocking. If a TCP packet is lost, ALL streams on that connection stall (waiting for TCP retransmission).

### HTTP/3 (2022) — The future
**Key change:** Replaces TCP with **QUIC** (built on UDP).

**Why QUIC?**
- **No TCP HOL blocking:** Each stream is independent. A lost packet only affects that one stream.
- **Faster connection setup:** 0-RTT or 1-RTT (TCP+TLS = 2-3 RTT). On repeat connections, can send data immediately (0-RTT).
- **Built-in encryption:** TLS 1.3 is part of QUIC (not a separate layer).
- **Connection migration:** If your phone switches from WiFi to cellular, the QUIC connection survives (identified by connection ID, not IP+port).

```
Connection setup time:
  HTTP/1.1 + TLS 1.2:  3 RTT (TCP handshake + TLS handshake)
  HTTP/2 + TLS 1.3:    2 RTT (TCP handshake + TLS 1.3)
  HTTP/3 + QUIC:       1 RTT (QUIC+TLS combined), 0 RTT for repeat connections
```

**Adoption:** Google (YouTube, Search), Facebook, Cloudflare all use HTTP/3. ~30% of web traffic as of 2024.

---

## HTTPS — HTTP Secure

**What it is:** HTTP encrypted with TLS (Transport Layer Security). All data between client and server is encrypted.

**What HTTPS protects against:**
1. **Eavesdropping:** Attacker can't read the data (it's encrypted)
2. **Tampering:** Attacker can't modify data without detection (integrity checks)
3. **Impersonation:** Client verifies the server is who it claims to be (certificates)

**TLS Handshake (simplified):**
```
Client                              Server
  │── ClientHello (supported ciphers) ──→│
  │←── ServerHello (chosen cipher) ──────│
  │←── Certificate (server's public key) │
  │── Key Exchange (shared secret) ──────→│
  │←── Finished ─────────────────────────│
  │── Finished ──────────────────────────→│
  │←═══ Encrypted communication ═══════→ │
```

**TLS 1.3 improvements (over TLS 1.2):**
- 1-RTT handshake (down from 2-RTT)
- 0-RTT resumption (for repeat connections)
- Removed insecure cipher suites
- Forward secrecy by default

**Certificates:**
- Server has a certificate signed by a Certificate Authority (CA) — e.g., Let's Encrypt, DigiCert
- Client verifies the certificate chain (server cert → intermediate CA → root CA)
- Root CAs are pre-installed in browsers/OS
- **Let's Encrypt:** Free, automated certificates. Revolutionized HTTPS adoption.

---

## HTTP Caching

### Cache-Control Headers
```
Cache-Control: public, max-age=86400    → Any cache can store, valid for 1 day
Cache-Control: private, max-age=3600    → Only browser can cache (not CDN), valid 1 hour
Cache-Control: no-cache                 → Must revalidate with server before using cached copy
Cache-Control: no-store                 → Never cache this response (sensitive data)
```

### ETag (Entity Tag) — Conditional Requests
```
First request:
  GET /api/users/42 → Response: ETag: "abc123", body: {...}

Subsequent request:
  GET /api/users/42
  If-None-Match: "abc123"
  
  → If unchanged: 304 Not Modified (no body, use cached version)
  → If changed:   200 OK with new ETag and new body
```

This saves bandwidth — the server only sends the full response if the data has changed.

---

## 🎤 Interview Questions & Expected Answers

### Q1: "What's the difference between HTTP/1.1, HTTP/2, and HTTP/3?"

**Expected answer:**
> "**HTTP/1.1** sends requests sequentially over TCP connections. It supports keep-alive (connection reuse) but suffers from head-of-line blocking — if one request is slow, subsequent requests on that connection wait. Browsers work around this by opening 6-8 parallel connections.
>
> **HTTP/2** adds multiplexing — multiple requests and responses are interleaved over a single TCP connection as binary frames. It also adds header compression and stream prioritization. This dramatically reduces latency for page loads with many resources. However, it still uses TCP, so a single lost packet blocks ALL streams (TCP-level HOL blocking).
>
> **HTTP/3** replaces TCP with QUIC (built on UDP). Each stream is independent — a lost packet only blocks that stream, not others. Connection setup is faster (1-RTT vs 2-3 RTT) because TLS is integrated into QUIC. It also supports connection migration (switching from WiFi to cellular without dropping the connection).
>
> For system design, HTTP/2 is the baseline for modern services. HTTP/3 matters for latency-sensitive, mobile-first applications where network changes and packet loss are common."

### Q2: "When should you use 401 vs 403?"

**Expected answer:**
> "**401 Unauthorized** means the client is NOT authenticated — the server doesn't know who you are. The request is missing credentials or has invalid credentials. The client should authenticate (log in) and retry.
>
> **403 Forbidden** means the client IS authenticated but NOT authorized — the server knows who you are, but you don't have permission to access this resource. Re-authenticating won't help.
>
> **Example:** A regular user tries to access the admin panel.
> - If they're not logged in: **401** — 'Please log in first.'
> - If they're logged in but not an admin: **403** — 'You don't have permission.'
>
> A common mistake is returning 404 instead of 403 for security reasons (don't reveal that the resource exists). This is a valid security practice — if you don't want an attacker to know whether `/admin` exists, return 404 instead of 403."

### Q3: "Why is HTTPS important and how does TLS work at a high level?"

**Expected answer:**
> "HTTPS encrypts all communication between client and server, protecting against three threats:
> 1. **Eavesdropping** — attackers can't read the data
> 2. **Tampering** — attackers can't modify data undetected
> 3. **Impersonation** — the client verifies the server's identity via certificates
>
> TLS works through a handshake:
> 1. Client sends supported cipher suites
> 2. Server responds with its chosen cipher and its certificate (containing its public key, signed by a trusted CA)
> 3. Client verifies the certificate chain against trusted root CAs
> 4. Client and server perform a key exchange (typically ECDHE) to establish a shared secret
> 5. All subsequent communication is encrypted with this shared secret (symmetric encryption — much faster than asymmetric)
>
> TLS 1.3 reduced the handshake to 1 round trip (from 2 in TLS 1.2) and supports 0-RTT for repeat connections. It also removed insecure cipher suites and mandates forward secrecy — even if the server's private key is compromised later, past sessions can't be decrypted.
>
> In system design, HTTPS should be used everywhere. TLS termination often happens at the load balancer or reverse proxy, with plain HTTP between internal services (within a trusted network/VPC)."
