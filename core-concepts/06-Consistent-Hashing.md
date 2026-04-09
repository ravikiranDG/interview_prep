# 🔵 Consistent Hashing — Deep Dive

## What is Consistent Hashing?

Consistent hashing is a technique for distributing data across multiple nodes such that when nodes are added or removed, only a minimal amount of data needs to be redistributed.

---

## The Problem It Solves

### Naive Approach: Modulo Hashing

You have N cache servers and want to distribute keys among them:
```
server = hash(key) % N
```

**With 4 servers:**
```
hash("user:1") = 7   → 7 % 4 = 3 → Server 3
hash("user:2") = 12  → 12 % 4 = 0 → Server 0
hash("user:3") = 22  → 22 % 4 = 2 → Server 2
hash("user:4") = 9   → 9 % 4 = 1 → Server 1
```

**The disaster: What happens when a server is added (N=4 → N=5)?**
```
hash("user:1") = 7   → 7 % 5 = 2 → Server 2  (was 3 → MOVED!)
hash("user:2") = 12  → 12 % 5 = 2 → Server 2  (was 0 → MOVED!)
hash("user:3") = 22  → 22 % 5 = 2 → Server 2  (was 2 → stayed)
hash("user:4") = 9   → 9 % 5 = 4 → Server 4  (was 1 → MOVED!)
```

**~75% of ALL keys get remapped!** On a cache server, this means 75% cache misses simultaneously → thundering herd hitting the database → potential outage.

With N=100 servers, adding 1 server remaps ~99% of keys. This is catastrophic.

**Consistent hashing solves this:** When adding or removing a server, only **K/N keys** are remapped (where K = total keys, N = number of servers). That's proportionally fair and minimally disruptive.

---

## How Consistent Hashing Works

### Step 1: The Hash Ring

Imagine a circular ring representing the entire hash space (0 to 2^32 - 1).

```
                    0 / 2^32
                      |
                 ─────●─────
              /       |       \
           /          |          \
         /            |            \
        ●  Server A   |             ●  Server B
        |             |             |
        |             |             |
        ●  Server C   |             |
         \            |            /
           \          |          /
              \       |       /
                 ─────●─────
                   2^16 (midpoint)
```

### Step 2: Place Servers on the Ring

Hash each server's identifier (IP address, hostname) to get a position on the ring:
```
hash("server-A") → position 10
hash("server-B") → position 75
hash("server-C") → position 230
```

### Step 3: Place Keys on the Ring

Hash each key to get a position on the ring:
```
hash("user:alice") → position 50
hash("user:bob") → position 100
hash("user:charlie") → position 200
```

### Step 4: Map Keys to Servers

**Rule:** A key is assigned to the first server found by walking clockwise from the key's position.

```
Ring (simplified 0-255):

  0 ──── ServerA(10) ──── user:alice(50) ──── ServerB(75) ──── user:bob(100) ──── 
         user:charlie(200) ──── ServerC(230) ──── 255 ──→ wraps to 0

Key assignments:
  user:alice   (50) → walk clockwise → ServerB (75) ✓
  user:bob    (100) → walk clockwise → ServerC (230) ✓
  user:charlie(200) → walk clockwise → ServerC (230) ✓
```

### Step 5: Adding a Server

Add ServerD at position 150:
```
Before:
  user:bob(100) → ServerC(230)

After:
  user:bob(100) → ServerD(150) ← ONLY keys between 75 and 150 move to ServerD

  user:alice(50) → ServerB(75)      ← unchanged!
  user:charlie(200) → ServerC(230)  ← unchanged!
```

**Only keys in the arc between the new server and its counter-clockwise predecessor are remapped.** Everything else stays put.

### Step 6: Removing a Server

Remove ServerB(75):
```
Before:
  user:alice(50) → ServerB(75)

After:
  user:alice(50) → ServerD(150)  ← keys go to the NEXT clockwise server

  user:bob(100) → ServerD(150)       ← unchanged!
  user:charlie(200) → ServerC(230)   ← unchanged!
```

**Only the dead server's keys move to the next server clockwise.**

---

## The Problem with Basic Consistent Hashing: Non-Uniform Distribution

With just 3 servers on the ring, the distribution can be very uneven:

```
    ServerA(10) ─────────── ServerB(300) ───── ServerC(310)
    
    ServerA owns: 310 → 10 (most of the ring!)
    ServerB owns: 10 → 300 (a big chunk)
    ServerC owns: 300 → 310 (tiny slice!)
```

Server C gets almost no traffic while Server A gets the majority. This is terrible.

---

## Virtual Nodes (Vnodes) — The Solution

Instead of placing each server at ONE position, place it at MANY positions (virtual nodes):

```
Server A gets 150 virtual nodes: vA1, vA2, vA3, ..., vA150
Server B gets 150 virtual nodes: vB1, vB2, vB3, ..., vB150
Server C gets 150 virtual nodes: vC1, vC2, vC3, ..., vC150
```

Each virtual node is placed at a different position on the ring:
```
hash("ServerA-vnode-1") → position 5
hash("ServerA-vnode-2") → position 67
hash("ServerA-vnode-3") → position 134
...
hash("ServerB-vnode-1") → position 22
hash("ServerB-vnode-2") → position 89
...
```

Now the ring looks like:
```
  0 ─ A ── B ── A ── C ── B ── A ── C ── A ── B ── C ── B ── A ── C ── ...
```

**Benefits:**
1. **Even distribution:** With many virtual nodes, each server gets a roughly equal share of the ring.
2. **Heterogeneous servers:** A more powerful server can get more virtual nodes → handles more keys.
3. **Smooth rebalancing:** Adding a server distributes its virtual nodes across the ring → steals a small slice from EACH existing server, not one big chunk from one server.

**How many virtual nodes?** In practice:
- Cassandra default: 256 vnodes per physical node
- DynamoDB: varies based on capacity
- More vnodes = more even distribution but more metadata to manage

---

## Consistent Hashing with Replication

In distributed systems, you typically replicate data for durability and availability:

```
Replication factor = 3:
  hash("user:alice") → walks clockwise → ServerB → also replicate to ServerC and ServerD

    A ── B(primary) ── C(replica1) ── D(replica2) ── A ── ...
         ↑
    user:alice stored on B, C, and D
```

**Rule:** The key is stored on the first N distinct physical servers found clockwise (N = replication factor). "Distinct physical" is important — skip virtual nodes of the same physical server.

---

## Real-World Implementations

### Amazon DynamoDB (from the Dynamo paper, 2007)
- **How:** Consistent hashing with virtual nodes
- **Replication:** N replicas on consecutive nodes clockwise on the ring
- **Consistency:** Quorum reads/writes (W + R > N)
- **Why:** Need to partition and replicate data across hundreds of machines with minimal coordination

### Apache Cassandra
- **How:** Consistent hashing for data partitioning across the cluster
- **Virtual nodes:** 256 by default (configurable)
- **Ring management:** Each node is responsible for the range between its predecessor and itself
- **Token assignment:** Random or calculated tokens for vnodes

### Memcached (with client-side consistent hashing)
- **How:** The memcached servers don't know about each other. The CLIENT uses consistent hashing to determine which server to query.
- **Libraries:** libketama (the original consistent hashing library for memcached)

### CDN Routing
- **How:** Hash the URL to determine which edge server should cache the content
- **Benefit:** Same URL always goes to the same edge server → better cache hit ratio
- **When servers change:** Minimal cache disruption

### Load Balancing (Nginx, HAProxy)
- **How:** Hash the client IP or request key to consistently route to the same backend
- **Use case:** Session affinity without cookies. Same client always reaches same server.

---

## Alternatives to Consistent Hashing

### Rendezvous Hashing (Highest Random Weight)
- For each key, compute a score for every server: `score = hash(key + server_id)`
- Assign to the server with the highest score
- **Pros:** Simpler, no ring structure, handles heterogeneous weights naturally
- **Cons:** O(N) per lookup (must check all servers) vs O(log N) for consistent hashing
- **Use case:** Good when N is small (dozens of servers, not thousands)

### Jump Consistent Hashing (Google, 2014)
- A very fast, memory-efficient algorithm
- O(ln N) time, zero memory overhead
- **Limitation:** Only works with sequential server IDs (0, 1, 2, ...N). Can't easily remove arbitrary servers.
- **Use case:** When servers are numbered sequentially and rarely removed

### Maglev Hashing (Google, 2016)
- Designed for Google's load balancer
- Provides better load distribution than consistent hashing
- Uses a lookup table generated from server preferences
- **Use case:** High-performance load balancing at Google scale

---

## Implementation Sketch

### Data Structures
```
class ConsistentHashRing:
    ring: SortedMap<int, string>    // hash_value → server_id
    vnodes_per_server: int = 150
    
    add_server(server_id):
        for i in 0..vnodes_per_server:
            hash_val = hash(f"{server_id}-vnode-{i}")
            ring[hash_val] = server_id
    
    remove_server(server_id):
        for i in 0..vnodes_per_server:
            hash_val = hash(f"{server_id}-vnode-{i}")
            ring.remove(hash_val)
    
    get_server(key):
        hash_val = hash(key)
        // Find first entry >= hash_val (clockwise walk)
        entry = ring.ceiling(hash_val)
        if entry is null:
            entry = ring.first()    // wrap around
        return entry.value          // server_id
```

**Time complexity:**
- `add_server`: O(V log N) where V = vnodes, N = total ring entries
- `remove_server`: O(V log N)
- `get_server`: O(log N) — binary search in sorted map

---

## 🎤 Interview Questions & Expected Answers

### Q1: "Explain consistent hashing and why we need it."

**Expected answer:**
> "Consistent hashing is a technique for distributing data across multiple nodes (like cache servers or database shards) such that adding or removing a node only requires remapping a minimal number of keys.
>
> With naive modulo hashing (`hash % N`), changing N remaps almost all keys — this is catastrophic for caches because it causes a mass cache miss, overwhelming the database.
>
> In consistent hashing, servers and keys are both mapped onto a ring (hash space). Each key is assigned to the nearest server clockwise on the ring. When a server is added, only keys in the arc between the new server and its predecessor move. When a server is removed, only its keys move to the next server.
>
> To ensure even distribution, we use virtual nodes — each physical server has many positions on the ring. A server with 150 virtual nodes will get approximately 1/N of the keys even with non-uniform hashing.
>
> It's used by Cassandra for data partitioning, DynamoDB, memcached for cache distribution, CDNs for content routing, and load balancers for consistent request routing."

---

### Q2: "What problem do virtual nodes solve?"

**Expected answer:**
> "Virtual nodes solve the uneven distribution problem in basic consistent hashing.
>
> With just one point per server on the ring, the arc sizes between servers can be wildly different. One server might get 60% of the keys while another gets 5%. This gets worse with fewer servers.
>
> Virtual nodes give each physical server multiple positions on the ring — typically 100-256. These positions are spread around the ring, so each server's total coverage is approximately 1/N of the ring, regardless of the specific hash positions.
>
> Additional benefits:
> - **Heterogeneous servers:** A powerful server can have more virtual nodes, handling a proportionally larger share.
> - **Smoother rebalancing:** When a new server joins, it places its virtual nodes across the ring, stealing a small slice from each existing server. Without vnodes, it would steal one big chunk from one server.
> - **Better fault distribution:** When a server fails, its virtual nodes are spread across the ring, so its load is distributed evenly among the remaining servers."

---

### Q3: "You're designing a distributed cache with 10 cache servers. A new server is added. What happens to the cache?"

**Expected answer:**
> "With consistent hashing and virtual nodes:
>
> 1. The new server gets ~150 virtual node positions on the hash ring.
> 2. For each virtual node, keys that fall in the arc between that position and the previous server's position will now be assigned to the new server.
> 3. In total, approximately 1/11 (about 9%) of all keys will be remapped to the new server.
> 4. The other 91% of keys remain on their current servers — no disruption.
>
> For the ~9% of remapped keys:
> - The first request for those keys on the new server will be a cache miss.
> - The new server will fetch from the database and populate its cache.
> - Subsequent requests will be cache hits.
>
> Compare this to modulo hashing where adding a server would remap ~90% of keys — a near-total cache invalidation that could overwhelm the database.
>
> To further smooth the transition, we could use cache warming: before routing traffic to the new server, pre-load it with the keys it will be responsible for."

---

### Q4: "How would you handle a hot key in a consistent hashing scheme?"

**Expected answer:**
> "A hot key is a key that receives disproportionately more traffic than others — like a celebrity's profile page or a viral tweet. In consistent hashing, this key maps to one server, which gets overwhelmed.
>
> Solutions:
>
> 1. **Key replication with random suffix:** Instead of caching as `hot_key`, cache as `hot_key:0`, `hot_key:1`, ..., `hot_key:9`. Each maps to a different server. Read from a random replica. This distributes the load across 10 servers.
>
> 2. **Local caching:** Cache hot keys in each application server's local memory (L1 cache). Only fall through to the distributed cache (L2) on local miss. Very effective for read-heavy hot keys.
>
> 3. **Dedicated hot-key handling:** Detect hot keys in real-time (monitor QPS per key). Route them to a separate, more powerful cache tier.
>
> 4. **Consistent hashing with replicated reads:** Store the key on N servers (the primary plus N-1 clockwise neighbors). Read from any of them. Writes go to primary and propagate.
>
> The best approach depends on whether the hot key is read-heavy (replication works great) or write-heavy (more complex — need to aggregate writes)."

---

### Q5: "Consistent hashing vs rendezvous hashing — when would you use each?"

**Expected answer:**
> "Both solve the same problem — minimizing key remapping when nodes change. The difference is in implementation and performance:
>
> **Consistent hashing:**
> - Uses a ring data structure with virtual nodes
> - O(log N) per key lookup (binary search on ring)
> - O(V × log N) to add/remove a server (V = vnodes)
> - Memory: O(V × N) for the ring
> - Better for large N (hundreds/thousands of servers)
>
> **Rendezvous hashing:**
> - No ring. For each key, compute hash(key, server) for ALL servers, pick highest.
> - O(N) per key lookup (must check all servers)
> - O(1) to add/remove a server (no data structure to update)
> - Memory: O(N) — just the server list
> - Simpler implementation, no virtual nodes needed
> - Better for small N (dozens of servers)
>
> I'd use consistent hashing for large distributed systems (Cassandra, DynamoDB) where N is large and lookup speed matters. I'd use rendezvous hashing for smaller systems or when simplicity is valued and N is small enough that O(N) per lookup is acceptable."

---

## 🧠 Mental Model

```
Think of consistent hashing as a clock:

🕐 Servers are fixed markers on the clock face (12, 3, 6, 9)
🔑 Keys are random times (1:47, 5:23, 8:15, 11:02)
📌 Each key goes to the NEXT server marker clockwise

When you ADD a new marker (at 2):
  → Only keys between 12 and 2 move to the new marker
  → All other keys stay where they are

When you REMOVE a marker (at 6):
  → Keys that were assigned to 6 move to the NEXT marker (9)
  → All other keys stay where they are

Virtual nodes = each server gets MANY markers (not just one)
  → Ensures each server gets a fair share of the clock face
```
