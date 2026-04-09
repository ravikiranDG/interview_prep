# 💻 System Design Interview Problems — Hard

These problems require sophisticated distributed systems knowledge, handling real-time data at massive scale, or complex coordination.

---

## 1. Design Uber (Ride-Sharing)

### Requirements
- Rider requests a ride, matched with nearest available driver
- Real-time location tracking of drivers
- ETA calculation
- Surge pricing during peak demand
- Scale: 100M riders, 5M drivers, 20M rides/day

### Estimation
- Location updates: 5M drivers × 1 update/4 sec = ~1.25M location updates/sec
- Ride requests: ~230 rides/sec average, peak 5x = ~1,200/sec

### High-Level Design
```
Rider App → [API Gateway] → [Ride Service] → [Matching Service]
                                                    ↓
Driver App → [Location Service] → [Geospatial Index (in-memory)]
                                                    ↓
              [ETA Service] → [Maps/Routing Service]
              [Pricing Service] (supply/demand based)
              [Payment Service]
              [Notification Service (push + SMS)]
```

### Key Decisions — The Matching Problem
- **Driver location tracking:** Drivers send GPS coordinates every 4 seconds
- **Geospatial indexing:** Use geohashing or quadtrees to efficiently find nearby drivers
  ```
  Geohash: Divide Earth into grid cells. Same prefix = nearby.
  "9q8yyk" and "9q8yym" are neighboring cells.
  Query: Find all drivers with geohash prefix "9q8yy"
  ```
- **Matching algorithm:**
  1. Rider requests ride → get rider location
  2. Query geospatial index for available drivers within radius
  3. Sort by distance/ETA
  4. Send ride request to nearest driver
  5. If declined/timeout → try next driver
- **Driver location store:** In-memory (Redis with Geo commands or custom in-memory grid) — can afford to lose data (drivers re-send locations constantly)

### Surge Pricing
- Divide city into zones
- Track supply (available drivers) and demand (ride requests) per zone
- When demand >> supply → multiply base price by surge factor
- Recalculate every few minutes

### ETA Calculation
- Pre-computed road graph with edge weights (time, distance)
- Dijkstra's / A* algorithm for routing
- Adjust weights based on real-time traffic data
- Use map services (Google Maps API) or build in-house (like Uber's H3 hex grid)

---

## 2. Design Google Docs (Collaborative Editing)

### Requirements
- Multiple users edit the same document simultaneously
- Real-time sync — see each other's changes instantly
- No data loss, conflict resolution
- Version history
- Offline editing with later sync

### The Core Challenge: Concurrent Editing

When two users type at the same time in the same document, how do you merge their changes without losing anything?

### Approach 1: Operational Transformation (OT)
- Used by Google Docs
- Each edit is an "operation": insert(char, position) or delete(position)
- Server transforms concurrent operations so they can be applied in any order and produce the same result

```
User A: insert('X', pos=5)     User B: insert('Y', pos=3)
                    ↓
Server receives both. Transforms B's op relative to A's:
  - B inserted at pos 3, A inserted at pos 5
  - B's insert at 3 doesn't affect A's position
  - A's insert at 5 shifts to 6 after B's insert at 3
  - Result: Both users see 'Y' at pos 3 and 'X' at pos 6
```

### Approach 2: Conflict-free Replicated Data Types (CRDTs)
- Used by Figma, some newer editors
- Data structure that automatically merges without conflicts
- No central server needed for conflict resolution
- Higher memory overhead but simpler distributed model

### High-Level Design
```
Client A → [WebSocket] → [Collaboration Service] → [Document Store]
                              ↓ broadcasts
Client B ← [WebSocket] ←─────┘
Client C ← [WebSocket] ←─────┘
```

### Key Components
- **WebSocket server:** Maintains persistent connections with all editors of a document
- **Operation queue:** Buffer operations, apply in order, broadcast transformed ops
- **Document store:** Current state + operation log (for version history)
- **Presence service:** Show cursors of other editors, who's online
- **Version history:** Store snapshots at intervals + operation log between snapshots
- **Offline mode:** Queue operations locally, sync and merge when reconnected

---

## 3. Design Google Maps

### Requirements
- Display map tiles at various zoom levels
- Calculate routes (driving, walking, transit)
- Real-time traffic data
- Search for places (POI — Points of Interest)
- ETA estimation
- Scale: 1B users, petabytes of map data

### High-Level Design
```
Client → [CDN (map tiles)] → pre-rendered tiles
Client → [API Gateway] → [Routing Service] → [Graph DB (road network)]
                       → [Search Service (Elasticsearch)] → [POI DB]
                       → [Traffic Service] → [Real-time traffic data]
                       → [Geocoding Service] → address ↔ coordinates
```

### Key Decisions

**Map Tiles:**
- Pre-render map images at ~20 zoom levels
- Each zoom level: world divided into 4^zoom tiles
- Store in object storage, serve via CDN
- Vector tiles (newer): send vector data, client renders (more flexible, smaller)

**Routing (the hard part):**
- Road network as a weighted graph (intersections = nodes, roads = edges, weight = time/distance)
- **Dijkstra's algorithm:** Basic shortest path — too slow for global routes
- **A* algorithm:** Heuristic-guided — faster but still slow for long distances
- **Contraction Hierarchies:** Pre-process the graph by "contracting" unimportant nodes. Queries are then millisecond-fast. Used by OSRM.
- **Hierarchical routing:** Different graph resolutions — use local roads nearby, highways for long distances

**Real-time Traffic:**
- Aggregate GPS data from millions of users (phones with Google Maps running)
- Update edge weights in the road graph based on actual speeds
- Recalculate ETAs dynamically

**Search/Geocoding:**
- Elasticsearch for POI search (restaurants, gas stations, etc.)
- Geocoding: address → (lat, lng) and reverse
- Geospatial indexes for "find restaurants near me"

---

## 4. Design Zoom (Video Conferencing)

### Requirements
- 1:1 and group video calls (up to 1000 participants)
- Screen sharing
- Chat during calls
- Recording
- Low latency (<150ms for real-time conversation)

### High-Level Design
```
User A → [Signaling Server (WebSocket)] → exchange connection info
         [STUN/TURN Server] → NAT traversal
         [Media Server (SFU)] → forward video/audio streams
                ↓
User B ← receives A's stream from SFU
User C ← receives A's stream from SFU
```

### Key Decisions

**P2P vs Media Server:**
- **P2P (WebRTC):** Direct connection between users. Great for 1:1 calls. Doesn't scale for groups (each user sends N-1 streams).
- **SFU (Selective Forwarding Unit):** Server receives one stream from each user, forwards to others. Each user uploads once, downloads N-1. **Used by Zoom for groups.**
- **MCU (Multipoint Control Unit):** Server receives all streams, mixes into one composite stream, sends one stream to each user. Lower bandwidth for clients but very CPU-intensive on server.

```
P2P (4 users):  Each sends 3 streams, receives 3  = 6 streams per user
SFU (4 users):  Each sends 1 stream, receives 3   = 4 streams per user
MCU (4 users):  Each sends 1 stream, receives 1   = 2 streams per user
```

**Adaptive quality:**
- Simulcast: Each user sends video at 3 quality levels (high, medium, low)
- SFU sends appropriate quality to each receiver based on their bandwidth
- Active speaker detection: Send high-quality for speaker, low-quality for others

**Architecture considerations:**
- **Signaling:** WebSocket for session setup (offer/answer/ICE candidates — SDP protocol)
- **Media transport:** UDP (low latency, OK to lose frames) with SRTP encryption
- **NAT traversal:** STUN server to discover public IP; TURN server as relay when P2P impossible
- **Recording:** SFU sends a copy of all streams to a recording service → transcode → store in S3
- **Global deployment:** Media servers in every region; route users to nearest server

---

## 5. Design Dropbox (File Sharing & Sync)

### Requirements
- Upload/download files
- Sync files across devices
- Share files/folders with others
- Version history
- Efficient sync (don't re-upload unchanged files)
- Scale: 500M users, billions of files, petabytes of storage

### High-Level Design
```
Client (Desktop/Mobile) → [API Gateway] → [Metadata Service] → [Metadata DB]
                                        → [Block Storage Service] → [Object Store (S3)]
                        → [Sync Service (WebSocket)] → [Message Queue]
                                                            ↓
                                                    [Notification to other devices]
```

### The Key Innovation: Chunking + Deduplication

**Don't upload entire files — upload CHUNKS:**
1. Split file into fixed-size chunks (e.g., 4 MB)
2. Compute hash (SHA-256) of each chunk
3. Upload only chunks that are new (server doesn't already have that hash)
4. File = ordered list of chunk hashes

```
File "report.pdf" (16 MB):
  Chunk 1: hash_abc → already on server (skip upload!)
  Chunk 2: hash_def → already on server (skip!)
  Chunk 3: hash_ghi → NEW → upload
  Chunk 4: hash_jkl → NEW → upload

Result: Only uploaded 8 MB instead of 16 MB!
```

**Benefits:**
- **Deduplication:** Same chunk across different users = stored only once
- **Efficient sync:** Change one line in a file → only 1 chunk changes → upload only that chunk
- **Bandwidth savings:** Massive, especially for similar files

### Sync Protocol
```
1. Client edits file → detects change (file watcher)
2. Re-chunk the file → compute new chunk hashes
3. Compare with previous version → find changed chunks
4. Upload only changed chunks
5. Update file metadata (new chunk list, version++)
6. Sync Service notifies other devices via WebSocket/long-poll
7. Other devices download only the new/changed chunks
8. Reconstruct file from chunks
```

### Conflict Resolution
- If two devices edit the same file offline → both try to sync → CONFLICT
- Strategy: Keep both versions, let user resolve
- Or: Last-write-wins (simpler, less safe)
- Dropbox approach: Create a "conflicted copy" file

### Data Model
```
Files:    file_id, user_id, filename, path, latest_version, is_deleted
Versions: version_id, file_id, chunk_list[hash1, hash2, ...], timestamp, size
Chunks:   chunk_hash (PK), storage_location, ref_count
Shares:   file_id, shared_with_user_id, permission (view/edit)
```

---

## 6. Design a Distributed Web Crawler

### Requirements
- Crawl billions of web pages
- Be polite (respect robots.txt, rate limit per domain)
- Detect and handle duplicates
- Handle dynamic content (JavaScript-rendered pages)
- Store and index crawled content

### High-Level Design
```
[Seed URLs] → [URL Frontier (Priority Queue)] → [Fetcher Workers (distributed)]
                        ↑                              ↓
                  [URL Filter]                  [HTML Parser]
                  (dedup, robots.txt)                ↓
                        ↑                    [Content Store (S3)]
                  [URL Extractor] ←──────── [Link Extractor]
                                                    ↓
                                            [Indexer → Search Engine]
```

### Key Decisions

**URL Frontier (the heart of the crawler):**
- Prioritized queue: Important URLs (high PageRank, frequently updated) crawled first
- Politeness queue: Separate queue per domain — only one concurrent request per domain
- Bloom filter: Check if URL already crawled before adding to frontier

**Duplicate detection (two levels):**
1. **URL dedup:** Normalize URLs, use Bloom filter to check if already seen
2. **Content dedup:** Hash page content (SimHash for near-duplicate detection)

**Politeness:**
- Parse robots.txt for each domain — respect Disallow rules
- Rate limit: Max 1 request per domain per second (or follow Crawl-delay directive)
- Distribute domains across workers — each worker handles a set of domains

**Scale:**
- Distribute fetcher workers across many machines
- Partition URL frontier by domain (consistent hashing)
- Use DNS cache (DNS lookups are slow; cache resolved IPs)
- Handle failures: retry with backoff, skip permanently failing URLs after N retries

---

## 7. Design Distributed Cloud Storage (S3)

### Requirements
- Store objects (files) of any size (bytes to terabytes)
- PUT/GET/DELETE objects by key
- 99.999999999% (11 nines) durability
- High availability (99.99%)
- Versioning, access control
- Scale: Exabytes of storage

### High-Level Design
```
Client → [API Gateway (REST)] → [Metadata Service] → [Metadata DB (distributed)]
                              → [Data Service] → [Storage Nodes (distributed)]
```

### Key Decisions

**Data storage:**
- Split objects into chunks (large objects → many chunks)
- Replicate each chunk across multiple nodes AND data centers
- Use erasure coding for storage efficiency: instead of 3 full copies (3x storage), use Reed-Solomon coding (e.g., 6 data + 3 parity blocks = 1.5x storage, tolerates 3 failures)

**Metadata:**
- Metadata DB maps: bucket/key → [chunk locations]
- Distributed metadata store (like DynamoDB or custom sharded DB)
- This is the most critical component — must be highly available and consistent

**Durability (11 nines):**
- Replicate across 3+ data centers in different geographic regions
- Periodic integrity checks (read and verify checksums)
- Repair any corruption automatically (replace from healthy replica)
- Erasure coding means even if some chunks are lost, data is recoverable

**Consistency:**
- Strong consistency for object metadata (latest PUT is immediately visible)
- S3 achieved strong read-after-write consistency in 2020

**Large object upload:**
- Multipart upload: Split file into parts, upload in parallel, server assembles
- Resume interrupted uploads (upload individual parts)
- Checksum per part + checksum for assembled object

---

## 8. Design a Ticket Booking System (BookMyShow)

### Requirements
- Browse events/movies, select showtime
- View seat map, select seats
- Book and pay within a time window
- Prevent double-booking (same seat sold twice)
- Handle high concurrency (popular events)
- Scale: Millions of concurrent users for hot events

### High-Level Design
```
Client → [CDN (catalog pages)] → static content
Client → [API Gateway] → [Catalog Service] → [Event DB]
                       → [Booking Service] → [Booking DB]
                       → [Payment Service] → [Payment Gateway]
                       → [Notification Service]
```

### The Core Challenge: Seat Locking Under High Concurrency

```
1. User views seat map → GET available seats (from cache or DB)
2. User selects seats → TEMPORARY HOLD (lock for 5-10 minutes)
3. User completes payment → CONFIRM booking → seats permanently booked
4. If payment fails/timeout → RELEASE hold → seats available again
```

### Key Decisions
- **Temporary hold:** When a user selects seats, mark them as "HELD" with an expiration time
  ```sql
  UPDATE seats SET status = 'HELD', held_by = user_id, held_until = NOW() + INTERVAL '10 minutes'
  WHERE event_id = X AND seat_id IN (A1, A2) AND status = 'AVAILABLE';
  -- Check rows affected: if < expected, some seats were taken!
  ```
- **Optimistic locking:** Use version numbers or status checks in WHERE clause
- **Queue for hot events:** For extremely popular events (concert tickets), put users in a virtual queue. Admit N users at a time to the booking page.
- **Idempotent booking:** Booking ID as idempotency key — prevent double-charge on payment retry

### Handling Hot Events (the "Taylor Swift" problem)
- **Virtual waiting room:** Users get a position in queue, admitted gradually
- **Pre-allocated inventory:** Partition seats across multiple servers
- **Read from cache:** Seat availability served from Redis (write-through from DB)
- **Database optimization:** Minimize lock duration, use row-level locks, batch operations

---

## 9. Design a Distributed Locking Service

### Requirements
- Acquire/release locks on named resources
- Locks have TTL (auto-release on crash)
- Strong consistency (at most one holder)
- Fencing tokens for safety
- High availability, partition tolerant

### High-Level Design
```
Client → [Lock Service API] → [Consensus Group (Raft/Paxos)]
                                  Node A (Leader)
                                  Node B (Follower)
                                  Node C (Follower)
```

### Key Decisions
- **Consensus-based:** Use Raft/Paxos to replicate lock state across nodes. Leader handles lock requests.
- **Fencing tokens:** Monotonically increasing token issued with each lock acquisition. Resources reject operations with old tokens.
- **TTL/Lease:** Each lock has a lease duration. If holder crashes, lease expires, lock is released.
- **Session-based:** Clients maintain sessions with heartbeats. If session dies (no heartbeat), all locks held by that session are released.
- **Watch/Wait:** Clients can watch a lock and get notified when it's released (avoid polling)

### Implementation (ZooKeeper-style)
```
Acquire lock "order-123":
  1. Create ephemeral sequential znode: /locks/order-123/lock-00000001
  2. Get all children of /locks/order-123/
  3. If my znode has the lowest sequence → I have the lock!
  4. If not → watch the znode just before mine → wait for notification
  5. When that znode is deleted → re-check if I'm now lowest → repeat

Release lock:
  1. Delete my znode
  → Next waiter gets notified → acquires lock
```

**Why ephemeral znodes?** If the lock holder crashes, its session expires, ZooKeeper auto-deletes the ephemeral znode → lock is automatically released. No stuck locks!

---

## 10. Design a Food Delivery App (DoorDash)

### Requirements
- Users browse restaurants, place orders
- Match order with delivery driver
- Real-time order and driver tracking
- ETAs for preparation, pickup, delivery
- Scale: 30M users, 1M drivers, millions of orders/day

### High-Level Design
```
User App → [API Gateway] → [Restaurant Service] → [Restaurant DB + Elasticsearch]
                         → [Order Service] → [Order DB + Kafka]
                         → [Matching Service] → [Driver Location (Redis Geo)]
                         → [Tracking Service (WebSocket)] → real-time updates
Driver App → [Location Service] → [Redis Geo Index]
Restaurant App → [Order Management] → updates order status
```

### Key Decisions
- **Restaurant discovery:** Elasticsearch with geo-distance filter + menu search
- **Driver matching:** Similar to Uber — geospatial index, find nearest available drivers, optimize for delivery time
- **Order lifecycle:** Created → Accepted (restaurant) → Preparing → Ready for pickup → Driver assigned → Picked up → Delivered
- **ETA computation:** Prep time (restaurant estimates) + travel time (routing service) + buffer
- **Batching:** Match one driver to multiple orders from nearby restaurants heading in the same direction (optimization problem)
- **Real-time tracking:** WebSocket push of driver location to user. Driver sends GPS every 4 seconds.

---

## Summary: Patterns Across All Problems

| Pattern | Used In |
|---------|---------|
| Consistent hashing | KV Store, Cache, Crawler, Message Queue |
| Geospatial indexing | Uber, Food Delivery, Maps, Yelp |
| Fan-out on write/read | Twitter, Instagram, WhatsApp |
| Event sourcing/CDC | Payment, E-commerce, Analytics |
| WebSockets | Chat, Collaborative editing, Tracking |
| Chunking + dedup | Dropbox, S3, Video streaming |
| Consensus (Raft/Paxos) | Distributed Lock, KV Store, Message Queue |
| Saga pattern | E-commerce, Payment, Booking |
| Bloom filters | Web Crawler, Cache, KV Store |
| Priority queues | Job Scheduler, Notification, Crawler |
| SFU/MCU | Zoom, video conferencing |
| Adaptive bitrate | Netflix, YouTube, Spotify |
