# 📡 WebSockets, SSE & Real-Time Communication — Deep Dive

## The Problem: HTTP is Request-Response

Standard HTTP is pull-based: the client must ask the server for data. The server can't spontaneously send data to the client.

```
Client: "Any new messages?"  → Server: "No."
Client: "Any new messages?"  → Server: "No."
Client: "Any new messages?"  → Server: "No."
Client: "Any new messages?"  → Server: "Yes! Here's one."
Client: "Any new messages?"  → Server: "No."
```

This is wasteful and slow. We need better patterns for real-time data.

---

## The Four Real-Time Patterns

### 1. Short Polling (Simplest, Worst)
Client repeatedly sends HTTP requests at fixed intervals.

```
Every 5 seconds:
  Client → GET /messages?since=last_id → Server: "Nothing new" (wasted request)
  Client → GET /messages?since=last_id → Server: "Nothing new" (wasted request)
  Client → GET /messages?since=last_id → Server: "Here's a message!" 
```

**Pros:** Dead simple. Works everywhere.
**Cons:** Wasteful (most polls return empty), latency = poll interval (up to 5 seconds), server load from empty requests.
**Use when:** Low-frequency updates, simple implementations, prototypes.

### 2. Long Polling (Better)
Client sends a request. Server HOLDS it open until data is available (or timeout).

```
Client → GET /messages (hangs...) → (30 seconds later, server has data) → Server: "Here's a message!"
Client → GET /messages (hangs...) → (immediately) → Server: "Another message!"
Client → GET /messages (hangs...) → (timeout after 30s) → Server: "Nothing" → Client: reconnects
```

**Pros:** Near real-time. No wasted empty responses. Works through most firewalls/proxies.
**Cons:** Server holds many open connections. HTTP overhead on each reconnection (headers). Not truly bidirectional.
**Use when:** Need real-time-ish updates, WebSocket not feasible, compatibility is important.
**Used by:** Early Facebook chat, many notification systems.

### 3. Server-Sent Events (SSE) — Server → Client Only
A persistent HTTP connection where the server continuously pushes events to the client.

```
Client → GET /events (Accept: text/event-stream) → Connection stays open

Server sends: 
  data: {"type": "message", "text": "Hello"}

  data: {"type": "message", "text": "World"}

  event: notification
  data: {"text": "New follower!"}
```

**Pros:**
- Simple (standard HTTP, built into browsers with `EventSource` API)
- Automatic reconnection (browser handles it)
- Lightweight (no framing overhead)
- Works with HTTP/2 (multiplexed with other requests)

**Cons:**
- Unidirectional (server → client only). Client must use separate HTTP requests to send data.
- Limited to text data (no binary)
- Max ~6 connections per domain in HTTP/1.1 (not an issue with HTTP/2)

**Use when:** Live feeds (stock prices, sports scores), notifications, dashboards, log tailing.

### 4. WebSockets — Full Bidirectional
A persistent, full-duplex TCP connection between client and server. Both can send data anytime.

```
1. HTTP Upgrade handshake:
   Client: GET / HTTP/1.1
           Upgrade: websocket
           Connection: Upgrade
   
   Server: HTTP/1.1 101 Switching Protocols
           Upgrade: websocket

2. Now it's a persistent TCP connection:
   Client ←→ Server (both send frames anytime)
   
   Server: {"type": "message", "from": "Alice", "text": "Hi!"}
   Client: {"type": "typing", "user": "Bob"}
   Server: {"type": "message", "from": "Bob", "text": "Hey!"}
```

**Pros:**
- True bidirectional, real-time communication
- Low overhead (just 2-14 bytes framing per message, no HTTP headers)
- Both sides can send anytime
- Supports binary data

**Cons:**
- Stateful (each connection is bound to a server → harder to scale)
- Some proxies/firewalls block WebSocket upgrades
- No automatic reconnection (must implement client-side)
- More complex server infrastructure

**Use when:** Chat apps, collaborative editing, gaming, live dashboards with user interaction.

---

## Comparison Table

| Feature | Short Polling | Long Polling | SSE | WebSocket |
|---------|--------------|-------------|-----|-----------|
| Direction | Client → Server | Client → Server | Server → Client | Bidirectional |
| Latency | High (poll interval) | Low-Medium | Low | Very Low |
| Server overhead | High (many requests) | Medium (held connections) | Low | Low |
| HTTP overhead | High (full headers each time) | Medium | Low | Very low (small frames) |
| Browser support | Universal | Universal | All modern | All modern |
| Firewall friendly | Yes | Yes | Yes | Sometimes blocked |
| Binary data | No | No | No | Yes |
| Auto-reconnect | N/A | No (must implement) | Yes (built in) | No (must implement) |
| Scaling difficulty | Easy | Medium | Medium | Hard |

---

## Scaling WebSockets

The challenge: WebSocket connections are stateful and long-lived. You can't just add servers behind a round-robin LB — a client connected to Server A can't get messages from Server B.

### Solution 1: Sticky Sessions
Route each client to the same server. Simple but limits scalability and failover.

### Solution 2: Pub/Sub Backend (Preferred)
```
Client A (connected to Server 1) sends a message
Server 1 publishes to Redis Pub/Sub
All servers receive the message
Server 3 (where recipient Client B is connected) forwards the message to Client B
```

```
[Client A] ↔ [WS Server 1] ←→ [Redis Pub/Sub] ←→ [WS Server 2] ↔ [Client B]
                                                ←→ [WS Server 3] ↔ [Client C]
```

### Solution 3: Dedicated Connection Servers
Separate connection management from business logic. Connection servers handle WebSocket connections; they forward messages to/from backend services via message queues.

```
[Client] ↔ [Connection Server] ↔ [Kafka/Redis] ↔ [Business Logic Servers]
```

### Connection Limits per Server
Each WebSocket connection = 1 file descriptor + memory for buffers.
- Linux default: ~1024 file descriptors (increase with `ulimit`)
- Practical limit per server: ~100K-1M concurrent connections (with tuning)
- At 500K connections, you need ~50 servers for 25M concurrent users

---

## Real-World Architectures

### Slack
- Uses WebSockets for real-time messaging
- If WebSocket fails, falls back to long polling
- Messages flow through a central message gateway
- Pub/Sub system (originally Redis, evolved to custom) distributes messages to connected clients

### Discord
- WebSocket for real-time chat and voice signaling
- Custom gateway system handles millions of concurrent connections
- Uses Elixir (Erlang VM) for concurrent connection handling — great at managing millions of lightweight processes

### WhatsApp Web
- Uses WebSocket to connect the browser to WhatsApp servers
- Messages are end-to-end encrypted
- The phone initially acts as a relay, but newer versions connect directly to servers

---

## 🎤 Interview Questions & Expected Answers

### Q1: "You're designing a chat application. Would you use WebSockets, SSE, or long polling?"

**Expected answer:**
> "I'd use **WebSockets** as the primary protocol because chat requires bidirectional real-time communication — both the client sending messages and the server delivering incoming messages.
>
> **Why not SSE?** SSE is unidirectional (server → client only). I'd need separate HTTP requests for sending messages, which adds latency and complexity.
>
> **Why not long polling?** It works but has higher overhead — each message delivery requires a new HTTP connection with full headers. For a high-volume chat app, this adds up.
>
> **My architecture:**
> - Client connects via WebSocket to a connection gateway server
> - Client sends a message → gateway → message service → store in DB → publish to Kafka
> - Recipient's connection server subscribes to relevant Kafka topics → delivers via WebSocket
> - If recipient is offline → store in DB for later delivery + send push notification
>
> **Fallback:** If WebSocket connection fails (corporate firewall, unstable network), fall back to long polling. Slack does exactly this.
>
> **Scaling:** Use Redis Pub/Sub or Kafka to fan out messages across WebSocket servers. Each server manages ~100K concurrent connections."

### Q2: "How do you scale WebSocket connections to handle 10 million concurrent users?"

**Expected answer:**
> "10M concurrent WebSocket connections is a significant infrastructure challenge. Here's my approach:
>
> **Connection tier:**
> - ~100 WebSocket gateway servers, each handling ~100K connections
> - Connections are distributed by user ID hash → consistent server assignment
> - Each server is a lightweight event-loop based process (Node.js, Go, or Erlang) optimized for many concurrent connections
>
> **Message routing:**
> - All servers subscribe to a Pub/Sub system (Redis Cluster or Kafka)
> - When a message is sent, it's published to a topic/channel
> - Only the server hosting the recipient's connection picks it up and delivers
>
> **Load balancing:**
> - L4 load balancer (NLB) in front of WebSocket servers
> - Sticky sessions by user ID (same user always connects to the same server)
> - If a server dies, connections are re-established to another server (client-side reconnect logic)
>
> **Presence tracking:**
> - Track which server each user is connected to in Redis: `user:123 → ws-server-42`
> - When sending a message, look up the recipient's server and route directly
>
> **Resource management:**
> - Tune OS limits: `ulimit -n 1000000`, `sysctl` for TCP buffers
> - Monitor per-server: connection count, memory usage, message throughput
> - Auto-scale based on total connections
>
> **Heartbeats:**
> - Server pings each client every 30 seconds
> - Client must respond with a pong
> - If no pong → connection is dead → clean up resources"

### Q3: "When would you choose SSE over WebSockets?"

**Expected answer:**
> "I'd choose SSE when:
>
> 1. **Data flows only server → client.** Live dashboards, stock tickers, notification feeds, news feeds. The client reads data but doesn't send data through this channel.
>
> 2. **Simplicity matters.** SSE is just HTTP — no special protocol, works with standard HTTP/2, easy to debug with curl, automatic reconnection built into the browser's `EventSource` API.
>
> 3. **Infrastructure constraints.** SSE works through HTTP proxies and firewalls that might block WebSocket upgrades. It works natively with HTTP/2 multiplexing.
>
> 4. **The client sends data infrequently.** If the client occasionally sends data (like a button click), a regular HTTP POST is fine alongside the SSE stream.
>
> I'd choose WebSockets when:
> - Both sides need to send data frequently (chat, gaming)
> - Binary data is needed
> - The lowest possible latency is required (WebSocket framing is lighter than HTTP)
>
> **Example:** For a monitoring dashboard that shows real-time metrics — SSE is perfect. The server streams metric updates, and if the user wants to change the time range, a regular HTTP request is fine."
