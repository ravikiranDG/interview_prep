# ⚡ TCP vs UDP — Deep Dive

## Overview

TCP and UDP are the two main transport-layer (Layer 4) protocols. Every networked application uses one of them to send data.

| | TCP | UDP |
|---|-----|-----|
| **Full name** | Transmission Control Protocol | User Datagram Protocol |
| **Connection** | Connection-oriented (handshake first) | Connectionless (just send) |
| **Reliability** | Guaranteed delivery, ordering, no duplicates | Best effort — no guarantees |
| **Speed** | Slower (overhead for reliability) | Faster (minimal overhead) |
| **Flow control** | Yes (sender adapts to receiver's capacity) | No |
| **Congestion control** | Yes (slows down when network is congested) | No |
| **Header size** | 20-60 bytes | 8 bytes |
| **Use case** | When correctness matters | When speed matters |

---

## TCP — The Reliable Workhorse

### The Three-Way Handshake

Before any data is sent, TCP establishes a connection:

```
Client                    Server
  │── SYN (seq=100) ──────→│     "I want to connect. My starting sequence is 100."
  │←── SYN-ACK (seq=300,   │     "OK! My starting sequence is 300. I acknowledge your 100."
  │     ack=101) ──────────│
  │── ACK (ack=301) ──────→│     "Got it. Connection established!"
  │                         │
  │═══ Data transfer ══════→│
```

**Cost:** 1.5 round trips before any data can flow. On a 100ms RTT link, that's 150ms just for the handshake.

### How TCP Guarantees Reliability

**Sequence numbers:** Every byte of data is numbered. The receiver can detect missing or out-of-order data.

**Acknowledgments (ACKs):** Receiver sends ACK for received data. Sender knows what was received.

**Retransmission:** If an ACK isn't received within a timeout, the sender retransmits the data.

**Ordering:** Receiver buffers out-of-order segments and reassembles them in the correct order before delivering to the application.

**Duplicate detection:** Sequence numbers let the receiver identify and discard duplicate segments.

### TCP Flow Control (Sliding Window)

The receiver advertises a "window size" — how much data it can accept. The sender won't send more than this.

```
Receiver says: "My window is 64KB"
Sender sends 64KB, then waits for ACK
Receiver processes some data, ACKs, says "Window is now 32KB" (buffer partially full)
Sender sends only 32KB
```

This prevents a fast sender from overwhelming a slow receiver.

### TCP Congestion Control

TCP detects network congestion (packet loss) and adjusts its sending rate:

1. **Slow Start:** Start with a small congestion window. Double it every RTT.
2. **Congestion Avoidance:** After a threshold, grow linearly (additive increase).
3. **Packet loss detected:** Cut the window in half (multiplicative decrease).
4. **Fast Recovery:** Retransmit the lost segment, don't reset to slow start.

```
Sending rate
     ↑
     │        /\    /\    /\
     │       /  \  /  \  /  \
     │      /    \/    \/    \
     │     /                  \
     │    /                    
     │   / ← Slow start
     │  /
     │ /
     └──────────────────────→ Time
         ↑ Packet loss → cut in half
```

**Implications for system design:** TCP ramps up slowly. New connections start with low throughput. This matters for:
- Short-lived connections (HTTP/1.1 without keep-alive): never reach full speed
- Connection pooling: reusing warm connections avoids slow start
- Long transfers: eventually reach full link speed

### TCP Connection Termination (Four-Way Handshake)

```
Client                    Server
  │── FIN ────────────────→│     "I'm done sending."
  │←── ACK ───────────────│     "OK, I'll finish up."
  │←── FIN ───────────────│     "I'm done too."
  │── ACK ────────────────→│     "Got it. Connection closed."
```

**TIME_WAIT state:** After closing, the client waits 2×MSL (Maximum Segment Lifetime, typically 60s) before fully releasing the connection. This catches any delayed packets.

**Implication:** High-connection-churn servers can exhaust ports due to TIME_WAIT. Solution: reuse connections (keep-alive, connection pooling), or tune `SO_REUSEADDR`.

---

## UDP — The Speed Demon

### How UDP Works

It's almost nothing:
```
Application gives data → UDP adds 8-byte header (source port, dest port, length, checksum) → Send!
```

No handshake. No acknowledgment. No retransmission. No ordering. Just fire and forget.

### UDP Header (8 bytes only)

```
┌──────────────────┬──────────────────┐
│ Source Port (16)  │ Dest Port (16)   │
├──────────────────┼──────────────────┤
│ Length (16)       │ Checksum (16)    │
└──────────────────┴──────────────────┘
```

Compare to TCP's 20-60 byte header. UDP is minimal overhead.

### Why Choose UDP?

1. **Lower latency:** No handshake, no ACK waiting. Data arrives as fast as the network allows.
2. **No HOL blocking:** Lost packet doesn't block other packets (unlike TCP's in-order delivery).
3. **Multicast/Broadcast:** UDP supports sending to multiple recipients simultaneously. TCP is point-to-point only.
4. **Application-level control:** The application can implement exactly the reliability it needs (not TCP's one-size-fits-all).

---

## When to Use Which — Decision Framework

| Scenario | Protocol | Why |
|----------|----------|-----|
| **Web browsing (HTTP)** | TCP | Pages must load completely and correctly |
| **REST APIs** | TCP | Request-response must be reliable |
| **Database connections** | TCP | Queries and results must be accurate |
| **Email (SMTP)** | TCP | Messages must be delivered intact |
| **File transfer (FTP/SCP)** | TCP | Files must be complete |
| **Live video streaming** | UDP | Dropped frames OK; latency matters more |
| **Video conferencing (Zoom)** | UDP (SRTP/WebRTC) | Real-time interaction; rebuffering is worse than drops |
| **Online gaming** | UDP | Player positions must be current; old positions are useless |
| **DNS queries** | UDP | Small, fast queries; retransmit at app level if needed |
| **VoIP (phone calls)** | UDP (RTP) | Voice must be real-time; dropped syllable < delayed syllable |
| **IoT sensor data** | UDP | High volume, some loss acceptable |
| **Live sports scores** | UDP | Latest score matters; old score is irrelevant |

**Rule of thumb:** If a 200ms delay is worse than a lost packet → UDP. If losing a packet is worse than a delay → TCP.

---

## QUIC — The Best of Both Worlds

QUIC (Quick UDP Internet Connections) is built on UDP but adds reliability features:

```
TCP:  Reliable, ordered, connection-oriented — but slow setup, HOL blocking
UDP:  Fast, no HOL blocking — but unreliable

QUIC: Built on UDP, but adds:
  ✓ Reliability (per-stream retransmission)
  ✓ Ordering (per-stream, not connection-wide)
  ✓ Encryption (TLS 1.3 built in)
  ✓ Multiplexing (multiple streams, no HOL blocking)
  ✓ Fast connection setup (0-1 RTT)
  ✓ Connection migration (survives IP changes)
```

QUIC is used by HTTP/3 and is supported by Google, Facebook, Cloudflare, and most CDNs.

---

## 🎤 Interview Questions & Expected Answers

### Q1: "When would you choose UDP over TCP for a system you're designing?"

**Expected answer:**
> "I'd choose UDP when low latency is more important than guaranteed delivery:
>
> **Video conferencing / live streaming:** A dropped video frame causes a brief glitch, but the stream continues. With TCP, a lost packet would cause ALL subsequent frames to wait for retransmission — causing visible stuttering and buffering.
>
> **Online gaming:** Player positions need to be current. If a position update is lost, the next update (arriving 50ms later) will have a newer position anyway. Retransmitting the old position is useless.
>
> **DNS queries:** Small packets (typically <512 bytes), stateless queries. If a response is lost, the client just sends another query. No need for TCP's overhead.
>
> **IoT sensor data:** Thousands of sensors sending temperature readings every second. Losing one reading is fine — the next one comes in a second. TCP's handshake per connection would be wasteful.
>
> In all these cases, I'd implement application-level reliability where needed — like sequence numbers for ordering, or checksums for integrity — rather than using TCP's full reliability stack."

### Q2: "Explain TCP's three-way handshake and why it exists."

**Expected answer:**
> "The three-way handshake (SYN → SYN-ACK → ACK) establishes a TCP connection before data transfer.
>
> **Why it exists:** It serves three purposes:
> 1. **Verify both sides are reachable:** Client confirms it can reach the server, and server confirms it can reach the client.
> 2. **Synchronize sequence numbers:** Both sides exchange their starting sequence numbers. These are used to track bytes, detect loss, and reorder data.
> 3. **Prevent stale connections:** If an old SYN packet arrives (delayed in the network), the handshake prevents it from accidentally creating a connection.
>
> **The cost:** 1.5 RTT before any data can be sent. On a 100ms RTT link, that's 150ms of latency just for connection setup — before you even add TLS handshake time.
>
> **System design implications:**
> - Connection pooling is important (reuse established connections to avoid repeated handshakes).
> - HTTP keep-alive reuses TCP connections for multiple requests.
> - HTTP/3 (QUIC) reduces this to 0-1 RTT by combining transport and TLS handshake."

### Q3: "You're designing a real-time multiplayer game. What network protocol would you use?"

**Expected answer:**
> "I'd use **UDP** for game state updates with application-level reliability where needed.
>
> **For player position/movement updates:** Pure UDP. These are sent 20-60 times per second. If one update is lost, the next one (arriving 16-50ms later) has a newer position. Retransmitting an old position is wasteful. Low latency is critical — players need to see each other's movements in real-time.
>
> **For critical game events (damage, kills, item pickups):** UDP with application-level reliability — I'd add sequence numbers and acknowledgments at the application level. If an ACK isn't received, retransmit. This ensures critical events aren't lost while keeping the speed of UDP.
>
> **For chat messages:** TCP (or reliable UDP). Messages must be delivered completely and in order. The slight extra latency is acceptable for text.
>
> **For matchmaking, login, store:** TCP/HTTPS. These are traditional request-response patterns where reliability matters and latency is less critical.
>
> Many game engines use this hybrid approach. Some use QUIC for the best of both worlds. Libraries like ENet provide reliable UDP with configurable reliability per channel."

---

## 🧠 Mental Model

```
TCP = Certified mail with tracking 📦
  - You get a tracking number (sequence number)
  - Delivery is confirmed (ACK)
  - If lost, it's re-sent (retransmission)
  - Arrives in order (sequencing)
  - Slower, more expensive, but guaranteed

UDP = Throwing a paper airplane 🛫
  - Just throw it and hope it arrives
  - No confirmation
  - If it's lost, throw another one
  - Might arrive out of order
  - Fast, cheap, but no guarantees
  
QUIC = A drone delivery service 🤖
  - Fast like a paper airplane (built on UDP)
  - But with tracking and retry (application-level reliability)
  - Multiple packages in one trip (multiplexing)
  - Encrypted by default
  - Survives address changes (connection migration)
```
