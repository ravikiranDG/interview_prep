# 💻 System Design Interview Problems — Medium

These problems require deeper thinking about scale, data modeling, and distributed systems tradeoffs.

---

## 1. Design WhatsApp (Messaging System)

### Requirements
- 1:1 messaging, group messaging (up to 256 members)
- Sent/delivered/read receipts
- Online/offline status
- Media sharing (images, videos)
- End-to-end encryption
- Scale: 2B users, 100B messages/day

### Estimation
- Messages: ~1.2M messages/sec
- Storage: 100B × 100 bytes avg = ~10 TB/day of text messages
- Media: Much larger — use object storage (S3)

### High-Level Design
```
Sender → [WebSocket Gateway] → [Message Service] → [Message Queue (Kafka)]
                                                         ↓
Receiver ← [WebSocket Gateway] ← [Push Service] ← [Message Consumer]
                                                         ↓
                                                   [Message Store (Cassandra)]
                                                   [Media Store (S3)]
```

### Key Decisions
- **Protocol:** WebSockets for real-time bidirectional messaging
- **Message flow:**
  1. Sender sends message via WebSocket
  2. Server stores message in DB
  3. If recipient is online → deliver via their WebSocket connection
  4. If offline → store for later delivery, send push notification
- **Message storage:** Cassandra (write-heavy, partitioned by conversation_id)
- **Group messaging:** Fan-out on write — when a message is sent to a group, create a copy for each member (or use a shared message store with per-user read pointers)
- **Media:** Upload to S3 → share URL in message → recipient downloads from S3/CDN
- **Read receipts:** Update message status (sent → delivered → read) — async, eventual consistency OK
- **E2E encryption:** Signal Protocol — server can't read messages, only forwards encrypted blobs
- **Ordering:** Sequence numbers per conversation (not global timestamps — clock skew!)

### Data Model
```
Messages:
  message_id (PK), conversation_id, sender_id, content (encrypted),
  type (text/image/video), timestamp, status (sent/delivered/read)

Conversations:
  conversation_id (PK), type (1:1/group), participants[], last_message_at

UserInbox (for offline delivery):
  user_id (PK), message_id, delivered (bool)
```

---

## 2. Design Spotify (Music Streaming)

### Requirements
- Stream music with minimal buffering
- Search songs, artists, albums
- Playlists (create, share, collaborative)
- Recommendations
- Scale: 500M users, 50M songs, 200M DAU

### High-Level Design
```
Client → [CDN (music files)] → cached songs
Client → [API Gateway] → [Search Service (Elasticsearch)]
                       → [Playlist Service (PostgreSQL)]
                       → [Recommendation Service (ML)]
                       → [Streaming Service]
```

### Key Decisions
- **Audio storage:** Songs stored as multiple quality levels (128kbps, 256kbps, 320kbps) in object storage (S3)
- **Streaming:** Adaptive bitrate — client switches quality based on network conditions
- **CDN:** Pre-cache popular songs at edge locations. Most listens are for the top 1% of songs.
- **Search:** Elasticsearch for fuzzy search on song titles, artist names, lyrics
- **Recommendations:** Collaborative filtering (users who liked X also liked Y) + content-based (audio features, genre)
- **Playlists:** PostgreSQL (relational — user has many playlists, playlist has many songs)
- **Offline mode:** Client downloads and caches songs locally (DRM protected)

---

## 3. Design Instagram (Photo Sharing)

### Requirements
- Upload photos/videos, apply filters
- Follow users, see a feed of followed users' posts
- Like, comment
- Stories (24-hour ephemeral content)
- Explore/discover page
- Scale: 1B users, 500M DAU, 100M photos/day

### High-Level Design
```
Client → [CDN] (serve images)
Client → [API Gateway] → [Post Service] → [Object Storage (S3)]
                       → [Feed Service] → [Feed Cache (Redis)]
                       → [User Service] → [User DB]
                       → [Notification Service] → [Push/Kafka]
```

### Key Decisions
- **Image storage:** Upload to S3, generate thumbnails (multiple sizes), serve via CDN
- **Feed generation — Hybrid fan-out:**
  - Regular users (< 10K followers): Fan-out on write — precompute feed for each follower
  - Celebrities (> 10K followers): Fan-out on read — merge at read time
- **Feed cache:** Pre-built feeds stored in Redis (sorted by timestamp)
- **Database:**
  - User/Follow: PostgreSQL (relational, complex queries)
  - Posts: Cassandra (high write throughput)
  - Feed: Redis (fast reads)
- **Timeline ranking:** Start with chronological, then add ML-based ranking (engagement prediction)

### Feed Generation Detail
```
Post created by User A:
  1. Store post in Posts DB
  2. Get list of User A's followers
  3. For each follower (< threshold):
     → Append post ID to their feed list in Redis
  4. For celebrity followers:
     → Do nothing now; merge at read time
  
User B opens feed:
  1. Get precomputed feed from Redis
  2. Merge with recent posts from celebrities they follow
  3. Rank and paginate
  4. Return with CDN URLs for images
```

---

## 4. Design a Notification Service

### Requirements
- Multi-channel: push notifications, SMS, email, in-app
- Template-based notifications
- User preferences (opt-in/opt-out per channel)
- Rate limiting per user
- Retry on failure
- Scale: Billions of notifications/day

### High-Level Design
```
Event Source → [Notification Service API] → [Priority Queue (Kafka)]
                                                  ↓
                                          [Notification Workers]
                                          /      |       \
                                   [Push]    [Email]    [SMS]
                                   (APNS/    (SES)    (Twilio)
                                    FCM)
```

### Key Decisions
- **Priority queues:** Separate queues for high priority (OTP, security alerts) and low priority (marketing, weekly digest)
- **Template engine:** "Hi {{name}}, your order {{orderId}} is shipped!" — templates stored in DB
- **User preferences:** Check before sending — respect opt-outs per channel
- **Rate limiting:** Max N notifications per user per hour (prevent spam)
- **Deduplication:** Idempotency key to prevent duplicate notifications
- **Retry with backoff:** Exponential backoff + DLQ for permanently failed notifications
- **Analytics:** Track delivery, open, click rates

---

## 5. Design a Distributed Job Scheduler

### Requirements
- Schedule jobs at specific times or intervals (cron-like)
- Execute jobs reliably (exactly-once semantics)
- Handle failures and retries
- Scale to millions of scheduled jobs
- Priority support

### High-Level Design
```
API → [Scheduler Service] → [Job Store (Database)]
                                    ↓
                          [Job Dispatcher (polls/event-driven)]
                                    ↓
                          [Job Queue (Kafka/SQS)]
                                    ↓
                          [Worker Pool (auto-scaling)]
```

### Key Decisions
- **Job storage:** Relational DB with indexes on `next_run_at`
- **Dispatching:** A dispatcher process polls for jobs where `next_run_at <= now()`. Use SELECT FOR UPDATE or distributed lock to prevent double-dispatch.
- **Exactly-once:** Idempotent job execution + deduplication in the queue
- **Failure handling:** Retry with exponential backoff, max retries, then DLQ
- **Sharding dispatcher:** Multiple dispatchers, each responsible for a time range or job ID range (consistent hashing)
- **Cron scheduling:** Parse cron expression → compute next_run_at → store in DB

---

## 6. Design Twitter

### Requirements
- Post tweets (280 chars), retweet, reply
- Follow/unfollow users
- Home timeline (tweets from people you follow)
- Search tweets
- Trending topics
- Scale: 500M users, 200M DAU, ~500M tweets/day

### Key Design (Focus: Timeline)

**The critical problem is timeline generation.**

**Approach: Hybrid fan-out (same as Instagram)**
```
Non-celebrity tweet:
  → Fan-out on write to all followers' cached timelines (Redis)

Celebrity tweet (>1M followers):
  → Stored only in Posts DB
  → Merged at read time when a follower requests their timeline
```

### Additional Components
- **Search:** Elasticsearch — index tweets on creation, support full-text search
- **Trending:** Count hashtags/topics using stream processing (Kafka Streams / Flink) with sliding windows. Rank by velocity (growth rate), not just volume.
- **Tweet storage:** Partition by tweet_id (for lookup) and secondary index by user_id (for user profile page)

---

## 7. Design Netflix / YouTube (Video Streaming)

### Requirements
- Upload and process videos
- Stream videos adaptively (different quality levels)
- Search and browse content
- Personalized recommendations
- Scale: 200M subscribers, millions of concurrent streams

### High-Level Design
```
Upload Path:
  Creator → [Upload Service] → [Object Storage (S3)]
                                      ↓
                              [Transcoding Pipeline]
                              (720p, 1080p, 4K, different codecs)
                                      ↓
                              [CDN (pre-positioned near users)]

Watch Path:
  Viewer → [CDN Edge] → video chunks (HLS/DASH adaptive streaming)
  Viewer → [API] → [Recommendation Service] → [Content DB]
```

### Key Decisions
- **Video transcoding:** Convert uploaded video to multiple resolutions and codecs. Massively parallel (split video into segments, transcode each in parallel). Use managed services (AWS Elastic Transcoder, MediaConvert).
- **Adaptive bitrate streaming (ABR):**
  - Video split into small chunks (2-10 seconds)
  - Available in multiple quality levels
  - Client downloads manifest file listing all chunks and qualities
  - Client dynamically switches quality based on bandwidth
  - Protocols: HLS (Apple), DASH (standard)
- **CDN strategy:** Pre-cache popular content at edge. Use predictive caching (if a show just released, pre-push to edge).
- **Recommendations:** Collaborative filtering + content-based + viewing history. Run ML models in batch, serve predictions from cache.

---

## 8. Design an E-commerce System (Amazon)

### Requirements
- Product catalog, search, browse
- Shopping cart, checkout
- Inventory management
- Order processing, payment
- Delivery tracking
- Scale: 300M customers, 12M products, 35 orders/sec (peak: 100x during sales)

### High-Level Design (Microservices)
```
Client → [API Gateway]
            → [Product Service] → [Product DB + Elasticsearch]
            → [Cart Service] → [Redis]
            → [Order Service] → [Order DB]
            → [Payment Service] → [Payment Gateway]
            → [Inventory Service] → [Inventory DB]
            → [Notification Service] → [Email/SMS/Push]
```

### Key Decisions
- **Product catalog:** PostgreSQL for structured data + Elasticsearch for search/filtering
- **Shopping cart:** Redis (fast, ephemeral for guests; persistent for logged-in users backed by DB)
- **Inventory:** Use pessimistic locking or atomic decrement to prevent overselling
  ```
  UPDATE inventory SET count = count - 1 WHERE product_id = X AND count > 0;
  ```
- **Order processing:** Saga pattern for distributed transaction
  1. Reserve inventory → 2. Process payment → 3. Create order → 4. Notify user
  If payment fails → compensate by releasing inventory
- **Flash sales:** Pre-allocate inventory in Redis, use token/queue system to limit concurrent checkouts

---

## 9. Design a Rate Limiter

### Requirements
- Limit requests per client per time window
- Multiple strategies (per user, per IP, per API key)
- Distributed (works across multiple API servers)
- Low latency overhead
- Return informative headers (remaining, reset)

### High-Level Design
```
Client → [API Gateway] → [Rate Limiter Middleware] → [Redis (counter store)] → [Backend Service]
                              ↓ (if rate exceeded)
                         HTTP 429 Too Many Requests
```

### Implementation: Sliding Window Counter in Redis
```lua
-- Redis Lua script (atomic)
local key = KEYS[1]
local window = ARGV[1]  -- e.g., 60 seconds
local limit = ARGV[2]   -- e.g., 100 requests
local now = ARGV[3]

-- Remove entries outside the window
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
-- Count entries in window
local count = redis.call('ZCARD', key)
if count < tonumber(limit) then
    redis.call('ZADD', key, now, now .. math.random())
    redis.call('EXPIRE', key, window)
    return 1  -- allowed
else
    return 0  -- rate limited
end
```

### Key Decisions
- **Algorithm:** Token bucket for most use cases (allows bursts, simple)
- **Storage:** Redis (centralized, atomic operations, fast)
- **Granularity:** Per user-ID, per IP, per API endpoint, or combinations
- **Race conditions:** Use Redis Lua scripts for atomic check-and-increment
- **Distributed:** All API servers talk to same Redis cluster

---

## 10. Design a Distributed Message Queue (Kafka)

### Requirements
- Publish messages to topics
- Consume messages with ordering guarantees (per partition)
- High throughput (millions of messages/sec)
- Durability (messages survive broker failures)
- Consumer groups (parallel consumption)

### High-Level Architecture
```
Producers → [Broker Cluster] → Consumers
                ↓
         [ZooKeeper/KRaft] (metadata, leader election)
```

### Key Concepts
```
Topic: "orders"
  Partition 0: [msg1, msg3, msg5, msg7]  → Consumer A
  Partition 1: [msg2, msg4, msg6, msg8]  → Consumer B
  Partition 2: [msg9, msg10, ...]        → Consumer C
```

### Key Decisions
- **Partitioning:** Messages are assigned to partitions by key hash. Same key → same partition → ordering guaranteed for that key.
- **Replication:** Each partition replicated to N brokers. One leader handles reads/writes, followers replicate.
- **Consumer groups:** Each partition is consumed by exactly one consumer in a group. Add consumers to parallelize (up to # partitions).
- **Offset management:** Consumers track their position (offset) in each partition. On crash, resume from last committed offset.
- **Retention:** Time-based (7 days) or size-based (100 GB). Messages are NOT deleted on consumption (unlike traditional queues).
- **Exactly-once:** Producer idempotency + transactional writes + consumer idempotent processing.
- **Storage:** Append-only log files on disk. Sequential writes are very fast (even on HDD). OS page cache for reads.

---

## 11. Design a Payment System

### Requirements
- Process payments (credit card, bank transfer, wallets)
- Idempotent transactions (no double charges)
- Support refunds
- Reconciliation with payment providers
- PCI compliance for card data
- Scale: Millions of transactions/day

### High-Level Design
```
Client → [API Gateway] → [Payment Service] → [Payment Gateway (Stripe/Adyen)]
                              ↓                        ↓
                       [Transaction DB]          [Bank/Card Network]
                              ↓
                       [Ledger Service] → [Ledger DB (double-entry)]
                              ↓
                       [Reconciliation Worker] (daily batch)
```

### Key Decisions
- **Idempotency:** Every payment request includes an idempotency key. Server deduplicates.
- **Double-entry bookkeeping:** Every transaction has a debit AND credit entry. Books must always balance.
  ```
  Payment of $100:
    DEBIT  customer_account  $100
    CREDIT merchant_account  $100
  ```
- **State machine:** Payment goes through states: Created → Processing → Succeeded/Failed → Settled
- **Retry logic:** Only retry on network errors/timeouts. NEVER retry on "card declined" (non-retryable).
- **Reconciliation:** Nightly batch job compares our records with payment provider's records. Flag discrepancies.
- **PCI compliance:** Never store raw card numbers. Use tokenization (Stripe handles this).

---

## 12. Design an Analytics Platform (Metrics & Logging)

### Requirements
- Ingest millions of events/sec (logs, metrics, clicks)
- Store for analysis and querying
- Real-time dashboards + historical analysis
- Alerting on thresholds

### High-Level Design
```
Sources → [Collection Agents] → [Kafka (ingestion buffer)]
                                       ↓
                              [Stream Processor (Flink)] → [Real-time Dashboard]
                                       ↓
                              [Data Warehouse (ClickHouse/BigQuery)] → [Historical Queries]
                                       ↓
                              [Alert Service] → [PagerDuty/Slack]
```

### Key Decisions
- **Ingestion:** Kafka as a buffer — handles bursty traffic, decouples producers from consumers
- **Stream processing:** Apache Flink/Kafka Streams for real-time aggregation (count, avg, percentiles over sliding windows)
- **Storage:** Columnar databases (ClickHouse, Druid) — optimized for aggregation queries on time-series data
- **Time-series optimization:** Partition by time, compress older data, auto-archive/delete old data
- **Alerting:** Define rules (e.g., "error rate > 5% for 5 minutes"), evaluate against streaming data, fire alerts
- **Log storage:** Elasticsearch + Kibana for full-text search on logs
