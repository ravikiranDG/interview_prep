# 📊 SQL vs NoSQL & Database Types — Deep Dive

## SQL (Relational) Databases

**Data model:** Tables with fixed schemas, rows and columns, relationships via foreign keys.
**Query language:** SQL — declarative, powerful, standardized.
**Examples:** PostgreSQL, MySQL, Oracle, SQL Server, SQLite.

### Strengths
- **ACID transactions** — data integrity guaranteed
- **Complex queries** — JOINs, aggregations, subqueries, window functions
- **Mature ecosystem** — decades of optimization, tooling, expertise
- **Schema enforcement** — the database validates data structure

### When to Use SQL
- **Structured data with clear relationships** (users → orders → items)
- **Complex queries needed** (reports, analytics, multi-table JOINs)
- **ACID transactions** (banking, inventory, booking)
- **Data integrity is paramount** (schema enforcement, foreign keys, constraints)

---

## NoSQL Databases — Four Families

### 1. Document Stores (MongoDB, CouchDB, Firestore)
```json
{
  "_id": "user_42",
  "name": "Alice",
  "address": { "city": "NYC", "zip": "10001" },
  "orders": [
    { "id": "order_1", "items": ["Laptop", "Mouse"], "total": 1299 }
  ]
}
```

**Characteristics:** Flexible schema (schemaless JSON), nested documents, no JOINs (denormalize instead).
**Best for:** Content management, user profiles, catalogs, applications where the data model evolves rapidly.
**When to choose:** Your data is naturally document-shaped, you need schema flexibility, you read/write whole documents at a time.

### 2. Key-Value Stores (Redis, DynamoDB, Memcached)
```
key: "session:abc123"  →  value: { user_id: 42, expires: "2024-01-15" }
key: "user:42:name"    →  value: "Alice"
```

**Characteristics:** Simplest data model. O(1) lookups by key. No complex queries.
**Best for:** Caching, session storage, shopping carts, real-time leaderboards, feature flags.
**When to choose:** Your access pattern is always "get by key" or "set by key."

### 3. Wide-Column Stores (Cassandra, HBase, ScyllaDB)
```
Row Key: "user_42"
  Column Family: "profile"
    name: "Alice"
    email: "alice@example.com"
  Column Family: "activity"  
    2024-01-15T10:30: "logged_in"
    2024-01-15T10:35: "viewed_page"
    2024-01-15T10:40: "purchased_item"
```

**Characteristics:** Columns can vary per row. Optimized for write-heavy workloads. Excellent at time-series data.
**Best for:** Time-series data, IoT, event logging, audit trails, messaging metadata.
**When to choose:** You need massive write throughput, time-series access patterns, horizontal scaling.

### 4. Graph Databases (Neo4j, Amazon Neptune, JanusGraph)
```
(Alice)-[:FRIENDS_WITH]->(Bob)
(Alice)-[:PURCHASED]->(Laptop)
(Bob)-[:REVIEWED]->(Laptop)
(Alice)-[:LIVES_IN]->(NYC)
```

**Characteristics:** Nodes and edges. Queries traverse relationships. O(1) relationship traversal regardless of dataset size.
**Best for:** Social networks, recommendation engines, fraud detection, knowledge graphs.
**When to choose:** Your queries are primarily about relationships and traversals ("friends of friends who bought X").

---

## SQL vs NoSQL Decision Framework

| Factor | Choose SQL | Choose NoSQL |
|--------|-----------|-------------|
| **Data structure** | Well-defined, relational | Flexible, varies per record |
| **Query patterns** | Complex, ad-hoc queries | Simple, known access patterns |
| **Consistency** | Strong ACID needed | Eventual consistency OK |
| **Scale** | Moderate (vertical + read replicas) | Massive (horizontal, built-in) |
| **Schema changes** | Infrequent, planned | Frequent, evolving |
| **Transactions** | Multi-table transactions | Single-document/key operations |
| **Team expertise** | SQL skills available | NoSQL experience available |

### Polyglot Persistence — Use Both!

Most real systems use multiple database types:

```
User Authentication  → PostgreSQL (ACID for credentials)
Session Management   → Redis (fast ephemeral storage)
Product Catalog      → MongoDB (flexible schema for varied products)
Product Search       → Elasticsearch (full-text search)
Activity Feed        → Cassandra (high write throughput)
Social Graph         → Neo4j (relationship queries)
File Metadata        → DynamoDB (scalable key-value)
Files themselves     → S3 (object storage)
Analytics            → ClickHouse/BigQuery (OLAP, columnar)
```

---

## Indexing — Making Reads Fast

### B-Tree Index (Most Common)
Balanced tree structure. O(log n) lookups.

```
                    [50]
                   /    \
              [20,30]   [70,80]
             /  |  \    /  |  \
         [10] [25] [35] [60] [75] [90]
```

**Best for:** Range queries (`WHERE age BETWEEN 20 AND 30`), equality (`WHERE id = 42`), sorting (`ORDER BY created_at`).

### Hash Index
Direct hash of key to location. O(1) lookups.
**Best for:** Equality only (`WHERE id = 42`). Cannot do range queries.

### Composite Index
Index on multiple columns: `CREATE INDEX idx ON orders(user_id, created_at)`

**Leftmost prefix rule:**
```
Index on (A, B, C) supports:
  ✅ WHERE A = 1
  ✅ WHERE A = 1 AND B = 2
  ✅ WHERE A = 1 AND B = 2 AND C = 3
  ❌ WHERE B = 2                    (doesn't start with A)
  ❌ WHERE A = 1 AND C = 3          (skips B)
```

### When NOT to Index
- Small tables (full scan is fast enough)
- Columns with low cardinality (boolean, status with 3 values)
- Write-heavy tables (each write updates all indexes)
- Columns rarely used in WHERE, JOIN, ORDER BY

---

## Sharding — Scaling Writes

### Hash-Based Sharding
```
shard = hash(user_id) % num_shards

User 42 → hash(42) = 7829 → 7829 % 4 = 1 → Shard 1
User 43 → hash(43) = 2341 → 2341 % 4 = 1 → Shard 1
User 44 → hash(44) = 5672 → 5672 % 4 = 0 → Shard 0
```

**Pros:** Even distribution. **Cons:** Range queries need all shards. Use consistent hashing to avoid massive reshuffling when adding shards.

### Range-Based Sharding
```
Users 1-1M      → Shard 1
Users 1M-2M     → Shard 2
Users 2M-3M     → Shard 3
```

**Pros:** Range queries efficient. **Cons:** Hotspots (new users all go to the last shard).

### Choosing a Shard Key
The shard key is the MOST important decision. A good shard key:
- Distributes data evenly (no hot shards)
- Aligns with common query patterns (avoid cross-shard queries)
- Has high cardinality (many distinct values)
- Rarely changes (changing shard key = moving data)

---

## Replication — Scaling Reads & Durability

### Single-Leader (Primary-Replica)
```
Writes → [Primary] ──replication──→ [Replica 1] ← Reads
                                  → [Replica 2] ← Reads
```

### Quorum Reads/Writes
```
N=3 replicas, W=2 (write to 2), R=2 (read from 2)
W + R > N ensures at least one node has the latest data

Write "X=42" → writes to Node 1 ✓, Node 2 ✓ (W=2 satisfied)
Read "X"     → reads from Node 2 (X=42) ✓, Node 3 (X=old) → return newest = 42
```

---

## 🎤 Interview Questions & Expected Answers

### Q1: "When would you choose NoSQL over SQL?"

**Expected answer:**
> "I'd choose NoSQL when:
>
> 1. **Scale demands it.** If I need massive write throughput (millions of writes/sec) or petabytes of data, databases like Cassandra or DynamoDB are designed for horizontal scaling from the ground up.
>
> 2. **Data model is flexible.** If each record has a different structure (like a product catalog where electronics have different attributes than clothing), a document store like MongoDB is more natural than trying to normalize everything into rigid tables.
>
> 3. **Simple access patterns.** If I'm always reading/writing by a primary key (caching, session storage), a key-value store like Redis or DynamoDB is perfect.
>
> 4. **Relationship-heavy queries.** If I need to traverse social graphs (friends of friends), a graph database like Neo4j is orders of magnitude faster than SQL JOINs on large datasets.
>
> I'd choose SQL when I need ACID transactions, complex queries with JOINs, or when data integrity enforced by the database is critical."

### Q2: "How would you design the database for a large e-commerce platform?"

**Expected answer:**
> "I'd use polyglot persistence — different databases for different needs:
>
> - **PostgreSQL** for users, orders, payments. ACID transactions ensure financial data integrity. Sharded by user_id for scale.
>
> - **Elasticsearch** for product search. Full-text search with faceted filtering (brand, price range, rating). Synced from PostgreSQL via CDC (Debezium).
>
> - **Redis** for shopping cart (fast, ephemeral for guests, persistent for logged-in users), session storage, and caching hot product pages.
>
> - **Cassandra or DynamoDB** for activity tracking, click streams, product views. High write throughput, time-series access pattern.
>
> - **S3** for product images and static assets, served through CDN.
>
> **Indexing strategy for PostgreSQL:**
> - `orders`: Index on (user_id, created_at) for 'my recent orders'
> - `products`: Index on category_id, price for filtered browsing
> - `inventory`: Index on product_id with partial index WHERE count > 0
>
> **Sharding strategy:**
> - Users and orders: Shard by user_id (user's data is colocated)
> - Products: Shard by product_id
> - Challenge: 'all orders for a product' crosses shards → use a separate analytics/search index"

### Q3: "Explain database replication and its tradeoffs."

**Expected answer:**
> "Replication maintains copies of data across multiple machines. Three approaches:
>
> **Single-leader:** One primary handles writes, replicas handle reads. Simplest model. Tradeoff: replication lag means replicas may serve stale data. If primary dies, a replica must be promoted (possible data loss if async replication).
>
> **Multi-leader:** Multiple nodes accept writes, replicate to each other. Used for multi-region deployments. Tradeoff: write conflicts when the same record is modified in two regions simultaneously. Needs conflict resolution (last-write-wins, custom merge logic).
>
> **Leaderless (quorum):** Any node accepts reads and writes. Uses quorum: W+R > N to guarantee overlap. Tradeoff: more complex client logic, eventual consistency is the norm, need anti-entropy mechanisms to repair inconsistencies.
>
> **Sync vs async replication:**
> - Synchronous: zero data loss, but write latency increases (must wait for replica ACK). One slow replica slows all writes.
> - Asynchronous: low write latency, but possible data loss if primary fails before replication completes.
> - Semi-synchronous (common compromise): one replica is sync, others are async. Guarantees at least one replica has the latest data."
