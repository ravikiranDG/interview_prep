# ✅ How to Answer a System Design Interview Question

This is arguably the most important section. Knowing the concepts is necessary, but knowing how to STRUCTURE your answer is what actually gets you the offer.

---

## The Framework (45-60 minutes)

### Step 1: Requirements Clarification (5 minutes)

**Never start designing immediately.** Ask questions to understand the scope.

**Functional requirements (what the system does):**
- What are the core features?
- Who are the users?
- What does the user journey look like?

**Non-functional requirements (how the system behaves):**
- Scale: How many users? How many requests per second?
- Latency: How fast should responses be?
- Availability: What's the uptime target?
- Consistency: Is strong consistency needed?
- Durability: Can we lose data?

**Example (designing Twitter):**
```
"Before I start, let me clarify the requirements:
- Core features: Post tweets, follow users, view timeline
- Scale: 500M users, 200M daily active, ~10K tweets/sec
- Read-heavy: 100x more reads than writes
- Latency: Timeline should load in <200ms
- Availability: 99.99% uptime
- Eventual consistency is acceptable for the timeline
Does this sound right?"
```

### Step 2: Back-of-the-Envelope Estimation (5 minutes)

Show you can think quantitatively. This helps drive design decisions.

**Key numbers to know:**
| Metric | Value |
|--------|-------|
| 1 day | ~100,000 seconds |
| Read:Write ratio | Typically 100:1 or 10:1 |
| 1 char | 1-2 bytes |
| 1 image | 200 KB - 1 MB |
| 1 video (1 min) | ~50 MB |
| Network speed (data center) | 1-10 Gbps |
| SSD random read | ~100 μs |
| Memory (RAM) read | ~100 ns |
| 1 server | ~10K-100K concurrent connections |

**Estimation template:**
```
Daily Active Users (DAU): 100M
Average actions per user per day: 10
Total requests per day: 1 billion
QPS (average): 1B / 100K = ~10,000 QPS
Peak QPS: 2-5x average = ~30,000 QPS

Storage per record: ~1 KB
New records per day: 100M
Storage per day: 100 GB
Storage for 5 years: ~180 TB

Bandwidth: 100 GB / 100K sec = ~1 MB/s (write), 100x for reads = ~100 MB/s
```

### Step 3: High-Level Design (10-15 minutes)

Draw the major components and how they interact. Start simple!

**Standard building blocks:**
```
Clients (Web/Mobile)
    ↓
CDN (static content)
    ↓
Load Balancer
    ↓
API Gateway (auth, rate limiting)
    ↓
Application Servers (stateless)
    ↓
Cache (Redis)
    ↓
Database (Primary + Replicas)
    ↓
Message Queue (async processing)
    ↓
Workers (background jobs)
    ↓
Object Storage (S3 for files/images)
    ↓
Search (Elasticsearch)
```

**Tips:**
- Walk through the main user flows
- Explain WHY you chose each component
- Keep it simple — you'll add detail in the next step
- Use proper boxes and arrows (even in text form)

### Step 4: Deep Dive (15-20 minutes)

Pick the most interesting/critical components and go deep. The interviewer may guide you.

**Things to deep dive into:**
- **Data model:** What are the tables/collections? What are the access patterns?
- **API design:** What endpoints? What request/response formats?
- **Database choice:** Why SQL vs NoSQL? How is data partitioned?
- **Caching strategy:** What to cache? Which eviction policy? How to handle invalidation?
- **Critical algorithms:** Ranking, feed generation, matching, etc.
- **Scaling bottlenecks:** What's the bottleneck? How to address it?

### Step 5: Scaling & Optimizations (5-10 minutes)

Address scale, reliability, and edge cases.

**Checklist:**
- [ ] Can the database handle the load? (Sharding, read replicas)
- [ ] Is there a single point of failure? (Add redundancy)
- [ ] What happens during traffic spikes? (Auto-scaling, queue-based load leveling)
- [ ] How do we handle data center failures? (Multi-region)
- [ ] What are the monitoring and alerting strategies?
- [ ] Are there any security concerns?
- [ ] How would you handle hot partitions / celebrity problem?

### Step 6: Wrap-Up (2-3 minutes)

Summarize your design and discuss tradeoffs you made.

```
"To summarize: We designed a system that handles 30K QPS using a microservices architecture
with Redis caching for fast reads and Kafka for async processing. The main tradeoffs I made:
1. Eventual consistency over strong consistency — acceptable for a social feed
2. Fan-out on write for most users, fan-out on read for celebrities
3. CDN for static content to reduce origin server load
If we had more time, I'd explore rate limiting, abuse detection, and content moderation."
```

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Jumping into design without requirements | Spend 5 min on requirements first |
| Over-engineering from the start | Start simple, scale when needed |
| Ignoring non-functional requirements | Always discuss scale, latency, availability |
| Not doing math | Back-of-envelope estimates show maturity |
| Only one approach | Discuss alternatives and tradeoffs |
| Not addressing failures | "What happens if X crashes?" |
| Being silent | Think out loud! The interviewer wants to see your process |
| Not knowing your own design | Be prepared for "Why X instead of Y?" |
| Trying to cover everything | Go deep on 2-3 areas rather than shallow on everything |

---

## Power Phrases for Interviews

Use these to sound structured and mature:

- "Let me start by clarifying the requirements..."
- "Let me do a quick back-of-the-envelope calculation..."
- "The tradeoff here is between X and Y. Given our requirements, I'd choose X because..."
- "This is a potential bottleneck. To address it, we could..."
- "This is a single point of failure. We can mitigate it by..."
- "Let me walk through the write path, then the read path..."
- "For consistency, we need to consider..."
- "This would work at our current scale, but at 10x we'd need to..."

---

## Quick Reference: Which Components to Mention

| Requirement | Reach for... |
|-------------|-------------|
| Low latency reads | Caching (Redis), CDN, denormalization |
| High write throughput | Message queue, write-behind cache, sharding |
| Full-text search | Elasticsearch |
| Real-time updates | WebSockets, Server-Sent Events |
| File storage | Object storage (S3) + CDN |
| User authentication | JWT, OAuth 2.0, API Gateway |
| Analytics | Kafka → Spark/Flink → Data Warehouse |
| Rate limiting | Token bucket at API Gateway |
| Notifications | Push notification service, email queue |
| Geolocation | Geospatial index (PostGIS, Redis Geo) |
| Recommendations | Graph DB, ML pipeline, collaborative filtering |
| Deduplication | Bloom filter, content hashing |
