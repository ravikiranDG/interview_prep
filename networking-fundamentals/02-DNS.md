# 🌍 DNS (Domain Name System) — Deep Dive

## What is DNS?

DNS is the system that translates human-readable domain names (like `google.com`) into machine-readable IP addresses (like `142.250.80.46`). Without DNS, you'd need to memorize IP addresses for every website.

**Analogy:** DNS is the phone book of the internet. You look up a name (domain) and get a number (IP address).

---

## How DNS Resolution Works — Step by Step

When you visit `www.example.com`, here's the full resolution chain:

```
Step 1: Browser cache     → "Have I looked this up recently?"
Step 2: OS cache          → "Has any app on this machine looked it up?"
Step 3: Router cache      → "Has anyone on this network looked it up?"
Step 4: ISP DNS resolver  → "Let me check my cache... not found. I'll resolve it."
        (Recursive Resolver)
Step 5: Root DNS server   → "I don't know example.com, but .com is handled by these TLD servers"
Step 6: TLD server (.com) → "I don't know example.com's IP, but its nameserver is ns1.example.com"
Step 7: Authoritative NS  → "example.com is at 93.184.216.34. Here you go!"
Step 8: Response flows back through the chain, cached at each level
```

**Detailed flow:**
```
Browser                ISP Resolver           Root Server        .com TLD         Authoritative NS
   │                       │                      │                 │                    │
   │──"www.example.com?"──→│                      │                 │                    │
   │                       │──"where is .com?"───→│                 │                    │
   │                       │←─"try 192.5.6.30"───│                 │                    │
   │                       │──"where is example.com?"──────────────→│                    │
   │                       │←─"try ns1.example.com (198.51.100.1)"─│                    │
   │                       │──"what is www.example.com?"───────────────────────────────→│
   │                       │←─"93.184.216.34, TTL=3600"────────────────────────────────│
   │←─"93.184.216.34"─────│ (caches for 3600 seconds)
   │ (caches locally)
```

---

## DNS Record Types

| Type | Name | Purpose | Example |
|------|------|---------|---------|
| **A** | Address | Maps domain to IPv4 address | `example.com → 93.184.216.34` |
| **AAAA** | IPv6 Address | Maps domain to IPv6 address | `example.com → 2606:2800:220:1::` |
| **CNAME** | Canonical Name | Alias pointing to another domain | `www.example.com → example.com` |
| **NS** | Name Server | Delegates a domain to a nameserver | `example.com → ns1.example.com` |
| **MX** | Mail Exchange | Specifies mail server for a domain | `example.com → mail.example.com (priority 10)` |
| **TXT** | Text | Arbitrary text (verification, SPF, DKIM) | `example.com → "v=spf1 include:_spf.google.com"` |
| **SRV** | Service | Specifies host/port for a service | `_sip._tcp.example.com → 5060 sipserver.example.com` |
| **PTR** | Pointer | Reverse DNS — IP to domain | `34.216.184.93.in-addr.arpa → example.com` |
| **SOA** | Start of Authority | Primary NS, admin email, serial number, timers | Zone metadata |

### CNAME vs A Record — When to Use Which

```
A Record:     example.com      → 93.184.216.34     (direct IP mapping)
CNAME Record: www.example.com  → example.com        (alias to another name)
CNAME Record: api.example.com  → myapp.herokuapp.com (alias to external service)
```

**Rule:** You CANNOT have a CNAME at the zone apex (the root domain `example.com`). You can only use CNAME on subdomains (`www.example.com`, `api.example.com`).

**Why?** Because CNAME replaces ALL records for that name, and the root domain must have SOA and NS records.

**Workaround:** Many DNS providers offer "ALIAS" or "ANAME" records that act like CNAME at the apex but resolve at the DNS server level.

---

## TTL (Time to Live)

**What it is:** How long (in seconds) a DNS response can be cached before the resolver must query again.

```
example.com.  3600  IN  A  93.184.216.34
                ↑
              TTL = 3600 seconds (1 hour)
```

**Tradeoffs:**

| TTL | Pros | Cons |
|-----|------|------|
| **Long (1-24 hours)** | Less DNS traffic, faster for users (cached) | Slow to update, failover takes longer |
| **Short (30-300 sec)** | Fast failover, quick updates | More DNS queries, slightly slower (more lookups) |

**Best practices:**
- **Stable services:** TTL 1-24 hours (reduce DNS load)
- **Before a migration:** Lower TTL to 60s a few days ahead, so old records drain from caches
- **During failover:** Low TTL ensures traffic shifts quickly
- **After migration:** Raise TTL back to normal

---

## DNS in System Design

### 1. DNS-Based Load Balancing (Round Robin DNS)

```
example.com → A record → 10.0.1.1
example.com → A record → 10.0.1.2
example.com → A record → 10.0.1.3
```

Each DNS query returns a different IP (rotated). Simple but limited:
- No health checks (DNS doesn't know if a server is dead)
- Clients cache results (sticky to one IP for TTL duration)
- Uneven distribution (clients may cache different IPs for different durations)

### 2. GeoDNS (Geographic Routing)

```
User in Tokyo   → DNS returns → 10.0.1.1 (Tokyo server)
User in New York → DNS returns → 10.0.2.1 (New York server)
User in London   → DNS returns → 10.0.3.1 (London server)
```

The DNS server inspects the source IP of the query, determines the geographic location, and returns the IP of the nearest data center.

**Used by:** Virtually all global services (Netflix, Google, Amazon, Cloudflare).
**Provider:** AWS Route 53 Geolocation/Latency routing, Cloudflare, Akamai.

### 3. DNS Failover

```
Normal:    example.com → 10.0.1.1 (primary, healthy ✓)
Failover:  example.com → 10.0.2.1 (secondary — health check detected primary is down)
```

Route 53 health checks: ping your servers every 10-30 seconds. If a server fails, Route 53 stops returning its IP and returns the healthy backup.

**Limitation:** DNS failover is not instant. Clients with cached DNS records keep hitting the dead server until cache expires (TTL). This is why low TTL is important for failover.

### 4. DNS as a SPOF — and the Fix

**The risk:** If your DNS provider has an outage, nobody can resolve your domain → your entire system is unreachable, even if your servers are perfectly healthy.

**Real-world incident:** October 2016 — Dyn (DNS provider) DDoS attack. Twitter, Netflix, Reddit, GitHub all went down because DNS queries couldn't be resolved.

**Solutions:**
- Use multiple DNS providers (Route 53 + Cloudflare)
- Use Anycast DNS (requests go to the nearest available DNS server)
- Long-ish TTLs as a buffer (cached records survive provider outage)

---

## DNS Security

### DNS Spoofing / Cache Poisoning
An attacker injects false DNS records into a resolver's cache, redirecting users to a malicious server.

```
User → "What's bank.com?" → Poisoned resolver → "It's 6.6.6.6 (attacker's server)"
User → connects to fake bank.com → enters credentials → stolen!
```

**Solution: DNSSEC (DNS Security Extensions)**
- Signs DNS records with cryptographic keys
- Resolver can verify the authenticity of DNS responses
- Prevents tampering but adds complexity

### DNS Amplification DDoS
Attacker sends small DNS queries with the victim's spoofed source IP. DNS servers send large responses to the victim.

```
Attacker → small query (spoofed source: victim's IP) → DNS server
DNS server → large response → Victim (overwhelmed!)
```

Amplification factor: up to 70x (small query → large response).

**Solution:** Rate limiting on DNS servers, BCP38 (ingress filtering to prevent IP spoofing).

---

## Internal DNS / Service Discovery

In microservices, internal DNS resolves service names to their current IP addresses:

```
order-service.internal → 10.0.3.42
user-service.internal  → 10.0.3.56
```

**Kubernetes DNS:** Every Kubernetes Service gets a DNS entry:
```
my-service.my-namespace.svc.cluster.local → ClusterIP
```

Pods can call `http://user-service/api/users` and Kubernetes DNS resolves it.

**Consul DNS:** HashiCorp Consul provides DNS-based service discovery:
```
web.service.consul → 10.0.3.42, 10.0.3.43, 10.0.3.44
```

---

## 🎤 Interview Questions & Expected Answers

### Q1: "How does DNS work? Walk me through a DNS lookup."

**Expected answer:**
> "When a user types `example.com` in their browser:
>
> 1. **Local caches checked first:** Browser cache → OS cache → router cache. If found, return immediately.
>
> 2. **Recursive resolver (ISP's DNS):** If not cached, the OS asks the ISP's recursive resolver. This resolver does the heavy lifting.
>
> 3. **Root server:** The resolver asks one of the 13 root server clusters: 'Where can I find `.com`?' Root returns the IP of the `.com` TLD servers.
>
> 4. **TLD server:** The resolver asks the `.com` TLD server: 'Where is `example.com`?' TLD returns the authoritative nameserver for `example.com`.
>
> 5. **Authoritative nameserver:** The resolver asks: 'What is the IP of `example.com`?' The authoritative NS returns the A record: `93.184.216.34`, with a TTL.
>
> 6. **Response cached:** The resolver caches the result for TTL seconds and returns it to the client. The browser caches it too.
>
> In practice, most lookups are served from cache and complete in <5ms. Cold lookups (nothing cached) might take 50-200ms due to multiple round trips."

### Q2: "You're designing a global system. How would you use DNS for traffic management?"

**Expected answer:**
> "I'd use a combination of DNS strategies:
>
> **GeoDNS / Latency-based routing:** Route users to the nearest data center. A user in Japan gets the Tokyo data center's IP, a user in Germany gets the Frankfurt data center's IP. AWS Route 53 latency-based routing does this automatically.
>
> **Weighted routing:** During a migration, I can route 90% of traffic to the old system and 10% to the new system. Gradually shift the weight.
>
> **Failover routing:** Health checks on each data center. If Tokyo goes down, Route 53 stops returning Tokyo's IP and routes Japanese users to the next nearest healthy data center (e.g., Singapore).
>
> **Low TTL for failover:** Set TTL to 60 seconds for records involved in failover, so clients pick up changes quickly.
>
> **Multiple DNS providers:** Use Route 53 and Cloudflare simultaneously. If one provider has an outage, the other continues resolving.
>
> **Important caveat:** DNS-level routing is coarse-grained. For fine-grained traffic management (A/B testing, canary deployments), I'd use a load balancer or API gateway, not DNS."

### Q3: "What's the difference between A record, CNAME, and ALIAS?"

**Expected answer:**
> "An **A record** maps a domain directly to an IPv4 address. It's the most basic record type. `example.com → 93.184.216.34`.
>
> A **CNAME** is an alias that points one domain to another domain. `www.example.com → example.com`. The resolver then looks up the target domain's A record. CNAME cannot be used at the zone apex (root domain) because it would conflict with SOA and NS records.
>
> An **ALIAS** (or ANAME) record is a DNS-provider-specific feature that works like CNAME but at the zone apex. It resolves at the DNS server level, returning an A record to the client. `example.com → ALIAS → myapp.elb.amazonaws.com`. The DNS server resolves the target and returns the IP directly.
>
> When to use each:
> - **A record:** When you have a static IP address.
> - **CNAME:** For subdomains that should point to another service (e.g., `api.example.com → myapi.herokuapp.com`).
> - **ALIAS:** When you need CNAME behavior at the root domain (e.g., `example.com → your-load-balancer.elb.amazonaws.com`)."

---

## 🧠 Mental Model

```
DNS is like a hierarchical directory assistance system:

You call:                "I need the number for John Smith at 123 Main St, Springfield, IL"
Local operator:          "Let me check... not in my book."
State operator (Root):   "Illinois? Call the IL directory at 217-555-0100."
City operator (TLD):     "Springfield? Call Springfield directory at 217-555-0200."
Local directory (Auth):  "John Smith at 123 Main St? His number is 555-1234."

Each operator remembers recent lookups (caching / TTL).
If you call again tomorrow, the local operator says "Oh, I remember — 555-1234!"

GeoDNS = different operators give different numbers based on where YOU are calling from.
DNS failover = if John's home number is disconnected, the operator gives you his mobile instead.
```
