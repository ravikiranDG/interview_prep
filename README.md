# 📘 System Design Interview Prep — Complete Guide

> A comprehensive study guide covering all core system design topics, organized for interview preparation.

---

## Table of Contents

### 🔬 Deep Dives (NEW!)
| File | Topics |
|------|--------|
| [Core Concepts Deep Dive Index](core-concepts/00-Index.md) | Each core concept in its own 15-20 page document with real-world examples, interview Q&A, and mental models |
| — [Scalability](core-concepts/01-Scalability.md) | Vertical vs horizontal scaling, Amdahl's Law, real-world scaling stories |
| — [Availability](core-concepts/02-Availability.md) | Nines table, SLA/SLO/SLI, error budgets, series vs parallel math |
| — [Reliability](core-concepts/03-Reliability.md) | MTBF/MTTR, chaos engineering, data integrity, idempotency |
| — [Single Point of Failure](core-concepts/04-SPOF.md) | Common SPOFs, hidden SPOFs, split-brain, SPOF audit checklist |
| — [Latency vs Throughput vs Bandwidth](core-concepts/05-Latency-Throughput-Bandwidth.md) | Percentiles, Jeff Dean's latency numbers, back-of-envelope math |
| — [Consistent Hashing](core-concepts/06-Consistent-Hashing.md) | Hash ring, virtual nodes, Cassandra/DynamoDB examples |
| — [CAP Theorem](core-concepts/07-CAP-Theorem.md) | CP vs AP, PACELC, consistency spectrum, conflict resolution |
| — [Failover](core-concepts/08-Failover.md) | Active-passive vs active-active, split-brain prevention, fencing tokens |
| — [Fault Tolerance](core-concepts/09-Fault-Tolerance.md) | Circuit breaker, bulkheading, retry patterns, graceful degradation |

| File | Topics |
|------|--------|
| [Networking Deep Dive Index](networking-fundamentals/00-Index.md) | OSI/TCP-IP, DNS, HTTP/HTTPS, TCP vs UDP, Proxies, Load Balancing |
| [API Deep Dive Index](api-fundamentals/00-Index.md) | REST Design, GraphQL, gRPC, WebSockets/SSE, API Gateway, Idempotency/Rate Limiting/Webhooks |
| [Database Deep Dive Index](database-fundamentals/00-Index.md) | ACID/Isolation, SQL vs NoSQL, Indexing/Sharding/Replication, Bloom Filters |
| [Distributed Systems Deep Dive Index](distributed-systems/00-Index.md) | Consensus/Raft, Service Discovery, Heartbeats, Distributed Locking, Gossip, Circuit Breaker, DR, Tracing, CDC |
| [Caching Deep Dive Index](caching-fundamentals/00-Index.md) | Caching Strategies, Eviction, Distributed Cache (Redis), CDN |

### Fundamentals
| # | File | Topics |
|---|------|--------|
| 01 | [Core Concepts](01-Core-Concepts.md) | Scalability, Availability, Reliability, SPOF, Latency/Throughput/Bandwidth, Consistent Hashing, CAP Theorem, Failover, Fault Tolerance |
| 02 | [Networking Fundamentals](02-Networking-Fundamentals.md) | OSI Model, IP Addresses, DNS, Proxy vs Reverse Proxy, HTTP/HTTPS, TCP vs UDP, Load Balancing, Checksums |
| 03 | [API Fundamentals](03-API-Fundamentals.md) | APIs, API Gateway, REST vs GraphQL, WebSockets, Webhooks, Idempotency, Rate Limiting, API Design |
| 04 | [Database Fundamentals](04-Database-Fundamentals.md) | ACID, SQL vs NoSQL, Indexes, Sharding, Replication, Scaling, DB Types, Bloom Filters, DB Architectures |
| 05 | [Caching Fundamentals](05-Caching-Fundamentals.md) | Caching 101, Strategies, Eviction Policies, Distributed Caching, CDN |
| 06 | [Async Communication](06-Async-Communication.md) | Pub/Sub, Message Queues, Change Data Capture (CDC) |
| 07 | [Distributed Systems & Microservices](07-Distributed-Systems-Microservices.md) | Heartbeats, Service Discovery, Consensus, Distributed Locking, Gossip Protocol, Circuit Breaker, Disaster Recovery, Distributed Tracing |
| 08 | [Architectural Patterns](08-Architectural-Patterns.md) | Client-Server, Microservices, Serverless, Event-Driven, Peer-to-Peer |
| 09 | [System Design Tradeoffs](09-System-Design-Tradeoffs.md) | Vertical vs Horizontal Scaling, Strong vs Eventual Consistency, Push vs Pull, REST vs RPC, and many more |

### Interview Strategy & Problems
| # | File | Topics |
|---|------|--------|
| 10 | [How to Answer SD Interview Questions](10-How-To-Answer-SD-Interview.md) | Framework, structure, tips for acing the interview |
| 11 | [Interview Problems — Easy](11-Interview-Problems-Easy.md) | URL Shortener, Autocomplete, Load Balancer, CDN, KV Store, Cache, Auth System, etc. |
| 12 | [Interview Problems — Medium](12-Interview-Problems-Medium.md) | WhatsApp, Spotify, Instagram, Twitter, Netflix, YouTube, Kafka, etc. |
| 13 | [Interview Problems — Hard](13-Interview-Problems-Hard.md) | Uber, Google Docs, Google Maps, Zoom, Dropbox, Web Crawler, S3, etc. |

---

## How to Use This Guide

1. **Start with Core Concepts (01-09)** — Build your foundation. Each file is self-contained.
2. **Learn the Interview Framework (10)** — Understand how to structure your answers.
3. **Practice Problems by Difficulty (11-13)** — Each problem includes a structured approach.
4. **Review Tradeoffs (09)** — Interviewers love asking "why X over Y?"

## Key Interview Mantras

- **There is no perfect system** — every design is a set of tradeoffs.
- **Start simple, then scale** — don't jump to complex solutions.
- **Clarify requirements first** — functional AND non-functional.
- **Numbers matter** — back-of-the-envelope estimates show maturity.
- **Think out loud** — the interviewer wants to see your thought process.
