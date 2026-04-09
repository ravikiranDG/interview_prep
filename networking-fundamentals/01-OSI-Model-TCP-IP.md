# 🧅 OSI Model & TCP/IP Stack — Deep Dive

## What is the OSI Model?

The OSI (Open Systems Interconnection) model is a conceptual framework that standardizes how different networking protocols and technologies interact. Think of it as a 7-layer cake — each layer has a specific job and communicates only with the layers directly above and below it.

---

## The 7 Layers — From Bottom to Top

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 7: APPLICATION    │ HTTP, HTTPS, FTP, SMTP, DNS, WebSocket│
├─────────────────────────────────────────────────────────────────┤
│ Layer 6: PRESENTATION   │ SSL/TLS, Encryption, Compression,JSON │
├─────────────────────────────────────────────────────────────────┤
│ Layer 5: SESSION        │ Session establishment, authentication  │
├─────────────────────────────────────────────────────────────────┤
│ Layer 4: TRANSPORT      │ TCP, UDP — port-to-port delivery       │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: NETWORK        │ IP, ICMP — host-to-host routing        │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: DATA LINK      │ Ethernet, WiFi, MAC addresses          │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: PHYSICAL       │ Cables, fiber, radio waves, voltages   │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 1 — Physical
**What:** Raw bits transmitted over a physical medium (copper wire, fiber optic, radio).
**Units:** Bits
**Analogy:** The actual road surface that vehicles travel on.
**Devices:** Hubs, repeaters, cables, antennas.

### Layer 2 — Data Link
**What:** Reliable transfer of frames between two directly connected nodes. Uses MAC (Media Access Control) addresses.
**Units:** Frames
**Analogy:** Traffic rules for a single stretch of road between two intersections.
**Devices:** Switches, bridges, NICs (Network Interface Cards).
**Protocols:** Ethernet (802.3), WiFi (802.11).

**Key concept — MAC address:** A 48-bit hardware address burned into every network interface. Format: `AA:BB:CC:DD:EE:FF`. Used for LOCAL delivery (within the same network segment). Unlike IP addresses, MAC addresses don't change.

### Layer 3 — Network
**What:** Routing packets from source to destination across multiple networks.
**Units:** Packets
**Analogy:** The GPS system that figures out which roads to take from city A to city B.
**Devices:** Routers, Layer 3 switches.
**Protocols:** IP (IPv4, IPv6), ICMP (ping), ARP (IP → MAC translation).

**Key concept — IP address:** A logical address assigned to a device. Used for GLOBAL routing (across networks).

**How a packet travels:**
```
Your PC → [Switch (L2)] → [Router A (L3)] → [Router B (L3)] → [Router C (L3)] → [Server]
          same network     different        different         destination
          (MAC address)    networks         networks          network
                          (IP routing)     (IP routing)
```

### Layer 4 — Transport
**What:** End-to-end communication between processes. Port numbers identify the specific application.
**Units:** Segments (TCP) / Datagrams (UDP)
**Analogy:** The postal system that ensures a package reaches the right person at the right address.
**Protocols:** TCP (reliable), UDP (fast).

**Key concept — Ports:** A 16-bit number (0-65535) that identifies a specific process/service.
```
Well-known ports (0-1023):
  HTTP:  80       HTTPS: 443
  SSH:   22       DNS:   53
  FTP:   21       SMTP:  25
  MySQL: 3306     PostgreSQL: 5432
  Redis: 6379     MongoDB: 27017
```

**Socket = IP address + Port number:** `192.168.1.100:8080` uniquely identifies a specific process on a specific machine.

### Layer 5 — Session
**What:** Establishes, manages, and terminates sessions between applications.
**Analogy:** The phone operator who connects calls and keeps them active.
**Examples:** SSL/TLS session negotiation, RPC session management.

### Layer 6 — Presentation
**What:** Data translation, encryption/decryption, compression.
**Analogy:** A translator who converts languages so both parties understand each other.
**Examples:** SSL/TLS encryption, data serialization (JSON, XML, Protobuf), image formats (JPEG, PNG).

### Layer 7 — Application
**What:** The protocols that applications directly interact with.
**Analogy:** The language and conventions two people use to have a conversation.
**Protocols:** HTTP/HTTPS, FTP, SMTP, DNS, WebSocket, gRPC.

---

## OSI vs TCP/IP Model (What's Actually Used)

The OSI model is conceptual. In practice, the internet runs on the **TCP/IP model**, which collapses the 7 layers into 4:

```
OSI Model              TCP/IP Model
─────────              ────────────
Application  ─┐
Presentation  ├──→    Application (HTTP, DNS, FTP, SSH)
Session      ─┘
Transport    ──────→  Transport (TCP, UDP)
Network      ──────→  Internet (IP, ICMP)
Data Link    ─┐
Physical     ─┴──→    Network Access (Ethernet, WiFi)
```

---

## Why the OSI Model Matters for System Design

| Layer | System Design Relevance |
|-------|------------------------|
| **Layer 7** | API Gateway, CDN, Web Application Firewall (WAF), reverse proxy |
| **Layer 4** | TCP load balancer (fast, no content inspection), firewall rules by port |
| **Layer 7 vs L4 LB** | L4 LB is faster but can't route by URL/header. L7 LB can do content-based routing. |
| **Layer 3** | IP-based geo-routing, VPC/subnet design, DDoS mitigation |
| **Layer 4+7** | TLS termination (decrypt at LB/proxy, send plain HTTP to backends) |
| **Layer 2** | VLAN segmentation within data centers, ARP-based service discovery |

---

## How Data Flows Through the Layers (Encapsulation)

When you send an HTTP request, each layer WRAPS the data with its own header:

```
Application:  [HTTP Request: GET /index.html]
Transport:    [TCP Header | HTTP Request ]
Network:      [IP Header | TCP Header | HTTP Request ]
Data Link:    [Ethernet Header | IP Header | TCP Header | HTTP Request | Ethernet Trailer]
Physical:     01101001 01010110 ... (bits on the wire)
```

On the receiving end, each layer strips its header and passes the payload up to the next layer.

---

## 🎤 Interview Questions & Expected Answers

### Q1: "What's the difference between Layer 4 and Layer 7 load balancing?"

**Expected answer:**
> "Layer 4 load balancing operates at the transport layer (TCP/UDP). It makes routing decisions based on IP addresses and port numbers without inspecting the actual content of the packets. It's very fast because it just forwards TCP connections.
>
> Layer 7 load balancing operates at the application layer (HTTP). It can inspect request content — URLs, headers, cookies, request body — and make intelligent routing decisions. For example, routing `/api/users` to the user service and `/api/orders` to the order service. It can also do SSL termination, request transformation, and caching.
>
> **When to use L4:** When you need maximum throughput and simple distribution (e.g., distributing TCP connections across database replicas). No need to inspect content.
>
> **When to use L7:** When you need content-based routing, SSL termination, header manipulation, or API gateway functionality. Most web applications use L7 load balancing.
>
> In practice, you often use BOTH: L4 at the edge (distribute across L7 LBs) → L7 for intelligent routing to backend services."

### Q2: "Walk me through what happens when you type google.com in your browser."

**Expected answer:**
> "This is a classic question that tests understanding across all layers:
>
> 1. **DNS Resolution (L7):** Browser checks its cache → OS cache → router cache → ISP's DNS resolver → root DNS → .com TLD → Google's authoritative DNS server → returns IP address (e.g., 142.250.80.46).
>
> 2. **TCP Connection (L4):** Browser initiates a TCP 3-way handshake with the server at port 443 (HTTPS). SYN → SYN-ACK → ACK.
>
> 3. **TLS Handshake (L5/L6):** Client and server negotiate encryption parameters, exchange certificates, establish a shared secret key. This adds 1-2 round trips.
>
> 4. **HTTP Request (L7):** Browser sends `GET / HTTP/2` with headers (Host, User-Agent, Accept, cookies).
>
> 5. **Server Processing:** Request hits Google's load balancer → routed to a web server → server generates the search page HTML.
>
> 6. **HTTP Response (L7):** Server returns HTML, CSS, JavaScript. Status 200 OK.
>
> 7. **Rendering:** Browser parses HTML, discovers resources (CSS, JS, images), makes additional requests in parallel (HTTP/2 multiplexing). Renders the page.
>
> At every step, data is encapsulated going down the stack (L7→L1) and decapsulated going up (L1→L7). IP routing (L3) handles getting packets across the internet. Ethernet/WiFi (L2) handles the last-mile to and from routers."

---

## 🧠 Mental Model

```
Think of sending a letter internationally:

Layer 7 (Application):    The letter itself (your message)
Layer 6 (Presentation):   Translating it to the recipient's language
Layer 5 (Session):        Confirming the recipient is expecting your letter
Layer 4 (Transport):      Choosing registered mail (TCP) vs postcard (UDP), adding tracking number
Layer 3 (Network):        Writing the full address (IP routing across countries)
Layer 2 (Data Link):      The local postal worker who delivers it to the right house on the street
Layer 1 (Physical):       The truck, plane, or boat that physically carries the letter
```
