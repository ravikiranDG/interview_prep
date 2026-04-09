# 🗄️ Database Fundamentals

Databases are the backbone of every system. Understanding database concepts deeply will help you make the right storage choices in any design.

---

## 1. ACID Transactions

ACID is a set of properties that guarantee database transactions are processed reliably.

**A — Atomicity:** A transaction is all-or-nothing. If any part fails, the entire transaction is rolled back.
```
Transfer $100 from Alice to Bob:
  1. Deduct $100 from Alice   ← If this succeeds...
  2. Add $100 to Bob          ← ...but this fails...
  → ROLLBACK: Alice gets her $100 back. No money disappears.
```

**C — Consistency:** A transaction brings the database from one valid state to another. All constraints, triggers, and rules are satisfied.
```
Constraint: account balance >= 0
If Alice has $50 and tries to transfer $100 → REJECTED (violates constraint)
```

**I — Isolation:** Concurrent transactions don't interfere with each other. Each transaction sees a consistent snapshot.

**Isolation levels (from weak to strong):**
| Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|-------|-----------|-------------------|-------------|
| Read Uncommitted | ✓ | ✓ | ✓ |
| Read Committed | ✗ | ✓ | ✓ |
| Repeatable Read | ✗ | ✗ | ✓ |
| Serializable | ✗ | ✗ | ✗ |

- Higher isolation = more correctness but lower performance
- Most databases default to Read Committed or Repeatable Read

**D — Durability:** Once a transaction is committed, it survives system crashes. Data is written to non-volatile storage (disk) and often replicated.

**Interview tip:** When designing systems that handle money, inventory, or bookings, emphasize ACID guarantees. For social media feeds or analytics, you can relax these.

---

## 2. SQL vs NoSQL

### SQL (Relational Databases)
- **Data model:** Tables with rows and columns, fixed schema
- **Query language:** SQL (Structured Query Language)
- **Relationships:** JOIN operations across tables
- **ACID:** Strong transactional guarantees
- **Examples:** PostgreSQL, MySQL, Oracle, SQL Server

**Best for:**
- Structured data with clear relationships
- Complex queries and JOINs
- Transactions (banking, e-commerce)
- Data integrity is paramount

### NoSQL (Non-Relational Databases)
Several categories:

**Document Store:** Stores JSON/BSON documents. Flexible schema.
- Examples: MongoDB, CouchDB
- Best for: User profiles, content management, catalogs

**Key-Value Store:** Simple key → value lookup. Blazing fast.
- Examples: Redis, DynamoDB, Memcached
- Best for: Caching, session storage, shopping carts

**Wide-Column Store:** Rows with dynamic columns. Optimized for write-heavy workloads.
- Examples: Cassandra, HBase, ScyllaDB
- Best for: Time-series data, IoT, event logging

**Graph Database:** Nodes and edges. Optimized for relationship queries.
- Examples: Neo4j, Amazon Neptune
- Best for: Social networks, recommendation engines, fraud detection

### Comparison

| Aspect | SQL | NoSQL |
|--------|-----|-------|
| Schema | Fixed (rigid) | Flexible (schemaless) |
| Scaling | Vertical (primarily) | Horizontal (built for it) |
| Transactions | Strong ACID | Varies (eventual consistency common) |
| Joins | Native support | Usually no joins (denormalize) |
| Query language | Standard SQL | Database-specific APIs |
| Best for | Complex relationships | High throughput, flexible data |

**Decision framework:**
- Need ACID + complex queries → SQL
- Need horizontal scale + flexibility → NoSQL
- Many reads, few writes → SQL with read replicas
- Massive writes → NoSQL (Cassandra, DynamoDB)
- Need both → Polyglot persistence (use different DBs for different services)

---

## 3. Database Indexes

**What it is:** A data structure that speeds up read queries at the cost of slower writes and extra storage.

**Without an index:** Database scans every row (O(n)) — called a "full table scan."
**With an index:** Database jumps directly to matching rows (O(log n)) — like a book's table of contents.

**How indexes work (B-Tree, the most common):**
```
                    [50]
                   /    \
              [20,30]   [70,80]
             /  |  \    /  |  \
         [10] [25] [35] [60] [75] [90]
              ↓     ↓     ↓     ↓
           [row]  [row]  [row]  [row]
```
- Balanced tree structure
- Each node stores sorted keys and pointers
- O(log n) lookup, insert, delete

**Types of indexes:**

| Type | Description | Use Case |
|------|-------------|----------|
| **Primary Index** | On primary key, automatically created | Row lookup by ID |
| **Secondary Index** | On non-primary columns | Filter/search by any column |
| **Composite Index** | On multiple columns | Queries filtering on multiple columns |
| **Unique Index** | Ensures no duplicate values | Email, username fields |
| **Full-Text Index** | For text search | Search functionality |
| **Partial Index** | Index only rows matching a condition | Active users only |

**Index tradeoffs:**
- ✅ Dramatically faster reads (especially for WHERE, JOIN, ORDER BY)
- ❌ Slower writes (index must be updated on every INSERT/UPDATE/DELETE)
- ❌ Extra storage space
- ❌ Too many indexes → write performance degrades significantly

**Composite index ordering matters:**
```sql
CREATE INDEX idx_user_city ON users(country, city);
-- ✅ Works for: WHERE country = 'US'
-- ✅ Works for: WHERE country = 'US' AND city = 'NYC'
-- ❌ Does NOT work for: WHERE city = 'NYC'  (leftmost prefix rule)
```

---

## 4. Database Sharding

**What it is:** Splitting a large database into smaller, faster, more manageable pieces called "shards," each running on a separate server.

**Why shard?**
- Single database can't handle the load (reads, writes, or storage)
- Vertical scaling has hit its limit
- Need to distribute data geographically

**Sharding strategies:**

### Range-based Sharding
- Shard based on value ranges: Users A-M → Shard 1, N-Z → Shard 2
- Pros: Range queries are efficient, simple to implement
- Cons: Hotspots (some ranges may get more traffic)

### Hash-based Sharding
- `shard = hash(shard_key) % num_shards`
- Pros: Even distribution of data
- Cons: Range queries require hitting all shards; adding/removing shards is painful (use consistent hashing!)

### Geographic Sharding
- Data partitioned by region: US data → US shard, EU data → EU shard
- Pros: Data locality, compliance (GDPR), lower latency
- Cons: Cross-region queries are expensive

### Directory-based Sharding
- A lookup table maps each key to its shard
- Pros: Flexible, can rebalance easily
- Cons: Lookup service becomes a SPOF and bottleneck

**Choosing a shard key:**
The shard key determines how data is distributed. A good shard key:
- Distributes data evenly (no hotspots)
- Aligns with common query patterns
- Rarely changes

**Sharding challenges:**
1. **Cross-shard queries:** JOINs across shards are expensive and complex
2. **Rebalancing:** Moving data when adding new shards
3. **Distributed transactions:** ACID across shards is very hard
4. **Unique constraints:** Ensuring uniqueness across shards
5. **Operational complexity:** More servers to manage, monitor, backup

**Celebrity problem / Hot partition:**
- If user "Taylor Swift" is on Shard 3, that shard gets hammered
- Solution: Further split hot partitions, or use a dedicated shard for hot keys

---

## 5. Data Replication

**What it is:** Maintaining copies of data on multiple machines for durability, availability, and read performance.

**Replication strategies:**

### Single-Leader (Primary-Replica)
```
Write → [Primary] → replicates to → [Replica 1]
Read  → [Replica 1] or [Replica 2]      [Replica 2]
```
- All writes go to primary
- Replicas serve reads
- Simple, most common approach
- Risk: Replication lag → stale reads

### Multi-Leader
```
Write → [Leader A] ↔ [Leader B] ← Write
```
- Multiple nodes accept writes
- Leaders replicate to each other
- Use case: Multi-datacenter deployment
- Challenge: Write conflicts (same record updated on both leaders)

### Leaderless (Quorum)
```
Write → [Node 1, Node 2, Node 3]  (write to W nodes)
Read  → [Node 1, Node 2, Node 3]  (read from R nodes)
```
- No leader — any node can accept reads and writes
- Quorum: W + R > N ensures overlap (at least one node has latest data)
- Examples: Cassandra, DynamoDB
- Trade: tune W and R for consistency vs latency

**Synchronous vs Asynchronous replication:**
| Type | Behavior | Tradeoff |
|------|----------|----------|
| Synchronous | Write waits for replica confirmation | Strong consistency, higher latency |
| Asynchronous | Write returns immediately, replica updated later | Lower latency, risk of data loss |
| Semi-synchronous | Write waits for at least one replica | Balance of both |

---

## 6. Database Scaling

**Vertical Scaling:** Bigger machine (more CPU, RAM, SSD)
- Simple but has limits
- Good first step before going distributed

**Read Scaling:**
1. **Read replicas:** Multiple copies serve read traffic
2. **Caching layer:** Redis/Memcached in front of DB
3. **CDN:** Cache static content at the edge

**Write Scaling:**
1. **Sharding:** Distribute writes across multiple shards
2. **Async writes:** Write to a queue, process in background
3. **Batch writes:** Group multiple writes into one operation

**Connection Pooling:** Reuse database connections instead of creating new ones per request. Tools: PgBouncer (PostgreSQL), ProxySQL (MySQL).

**Denormalization:** Duplicate data to avoid expensive JOINs at read time. Trade storage for speed.

---

## 7. Database Types (Beyond SQL vs NoSQL)

| Type | Examples | Optimized For |
|------|----------|---------------|
| **Relational (OLTP)** | PostgreSQL, MySQL | Transactions, normalized data |
| **Analytical (OLAP)** | Snowflake, BigQuery, Redshift | Analytics, aggregations on huge datasets |
| **Document** | MongoDB, CouchDB | Flexible JSON documents |
| **Key-Value** | Redis, DynamoDB | Simple lookups, caching |
| **Wide-Column** | Cassandra, HBase | Time-series, high write throughput |
| **Graph** | Neo4j, Neptune | Relationships, social graphs |
| **Time-Series** | InfluxDB, TimescaleDB | Metrics, IoT, monitoring |
| **Search Engine** | Elasticsearch, Solr | Full-text search, log analysis |
| **Vector** | Pinecone, Weaviate | AI embeddings, similarity search |
| **In-Memory** | Redis, Memcached | Ultra-low latency, caching |
| **Object Store** | S3, GCS, Azure Blob | Unstructured data (files, images, videos) |
| **Message Queue (as DB)** | Kafka | Event log, streaming |
| **Spatial** | PostGIS, MongoDB | Geospatial queries |
| **Ledger** | Amazon QLDB | Immutable, auditable transaction log |
| **Embedded** | SQLite, RocksDB | Local/mobile apps, embedded systems |

**Polyglot persistence:** Use the right database for each use case within the same system.
```
User profiles     → PostgreSQL (relational, ACID)
Session data      → Redis (fast, ephemeral)
Product search    → Elasticsearch (full-text search)
Activity feed     → Cassandra (high write throughput)
Recommendations   → Neo4j (graph relationships)
File storage      → S3 (object storage)
```

---

## 8. Bloom Filters

**What it is:** A space-efficient probabilistic data structure that tells you:
- "Definitely NOT in the set" (100% accurate)
- "PROBABLY in the set" (small chance of false positive)

**How it works:**
1. Create a bit array of size m, initialized to all 0s
2. Use k hash functions
3. **Insert:** Hash the element k times, set those bit positions to 1
4. **Query:** Hash the element k times, check if ALL bit positions are 1
   - If any bit is 0 → DEFINITELY NOT in the set
   - If all bits are 1 → PROBABLY in the set (might be a false positive)

```
Insert "hello":  hash1("hello")=2, hash2("hello")=5, hash3("hello")=9
Bit array:   [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0]
                     ↑           ↑              ↑

Query "world": hash1("world")=2, hash2("world")=7, hash3("world")=9
Check:         Position 2=1 ✓, Position 7=0 ✗ → DEFINITELY NOT present
```

**Tradeoffs:**
- ✅ Very space-efficient (much smaller than storing actual elements)
- ✅ O(k) lookup time (constant, very fast)
- ❌ False positives possible
- ❌ Cannot delete elements (use Counting Bloom Filters for that)
- ❌ Cannot enumerate stored elements

**Where Bloom Filters are used:**
- **Database queries:** Check if a key exists before doing an expensive disk read (Cassandra, HBase, LevelDB all use Bloom Filters)
- **Web crawlers:** Check if a URL has already been visited
- **CDN/Cache:** Check if content is cached before fetching from origin
- **Spam detection:** Quickly check if an email is from a known spammer
- **Username availability:** Quick check before querying the database

---

## 9. Database Architectures

### Active-Passive
- One active node handles all traffic
- Passive node receives replicated data
- On failure, passive takes over (failover)
- Simple but wasteful (passive is idle)

### Active-Active
- Multiple nodes handle traffic simultaneously
- Better resource utilization and performance
- Challenge: Conflict resolution when same data modified on multiple nodes
- Strategies: Last-write-wins, vector clocks, CRDTs (Conflict-free Replicated Data Types)

### Multi-Master Replication
- Every node can accept writes
- Changes propagate to all other nodes
- Conflict resolution is the hardest part
- Used in multi-region deployments

### Leader-Follower with Automatic Failover
- Most common production setup
- Leader handles writes, followers handle reads
- If leader fails, one follower is promoted (automatic failover)
- Tools: PostgreSQL with Patroni, MySQL Group Replication

**Interview tip:** For most systems, start with a single primary + read replicas. Only introduce multi-master or active-active when you need multi-region writes or extreme write throughput.
