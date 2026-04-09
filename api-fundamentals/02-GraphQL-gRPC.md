# 🔷 GraphQL & gRPC — Deep Dive

## GraphQL

### What It Is
A query language for APIs where the **client specifies exactly what data it needs**. Developed by Facebook (2012), open-sourced 2015.

### The Problem GraphQL Solves

**REST over-fetching:**
```
GET /users/42 → Returns ALL 30 fields, but mobile app only needs name + avatar
```

**REST under-fetching (N+1):**
```
GET /users/42           → Get user data
GET /users/42/posts     → Get user's posts (second request!)
GET /posts/1/comments   → Get comments for post 1 (third request!)
GET /posts/2/comments   → Get comments for post 2 (fourth request!)
```

**GraphQL solution — single query:**
```graphql
query {
  user(id: 42) {
    name
    avatarUrl
    posts(first: 5) {
      title
      comments(first: 3) {
        text
        author { name }
      }
    }
  }
}
```
Returns exactly the requested data in ONE request.

### GraphQL Schema

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  body: String!
  author: User!
  comments: [Comment!]!
}

type Query {
  user(id: ID!): User
  posts(first: Int, after: String): PostConnection!
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}

type Subscription {
  messageReceived(channelId: ID!): Message!
}
```

### GraphQL Operations

**Query (read):**
```graphql
query GetUser {
  user(id: "42") {
    name
    email
  }
}
```

**Mutation (write):**
```graphql
mutation CreatePost {
  createPost(input: { title: "Hello", body: "World" }) {
    id
    title
  }
}
```

**Subscription (real-time):**
```graphql
subscription OnNewMessage {
  messageReceived(channelId: "general") {
    text
    author { name }
  }
}
```

### REST vs GraphQL Comparison

| Aspect | REST | GraphQL |
|--------|------|---------|
| **Endpoints** | Multiple (`/users`, `/posts`) | Single (`/graphql`) |
| **Data fetching** | Fixed response shape | Client specifies exact shape |
| **Over-fetching** | Common | Eliminated |
| **Under-fetching** | Common (N+1) | Eliminated (single query) |
| **Caching** | HTTP caching (easy, CDN-friendly) | Harder (all POST, need client-side caching) |
| **Versioning** | URL versioning (`/v1/`, `/v2/`) | Schema evolution (deprecate fields) |
| **Learning curve** | Lower | Higher |
| **Tooling** | Widespread | Growing (Apollo, Relay) |
| **File uploads** | Native HTTP multipart | Needs workarounds |
| **Best for** | Public APIs, CRUD, caching-heavy | Complex data relationships, mobile apps |

### GraphQL Challenges

**N+1 problem (at the resolver level):**
```
Query: users { posts { comments } }
→ Resolves 10 users → For each user, resolves posts → For each post, resolves comments
→ 1 + 10 + 100 = 111 database queries!
```

**Solution: DataLoader**
Batches and deduplicates database calls. Instead of 10 individual queries for posts, one batch query: `SELECT * FROM posts WHERE user_id IN (1,2,3,...10)`.

**Query complexity / abuse:**
A malicious client could send a deeply nested query that crashes the server.

**Solutions:**
- Query depth limiting (max 5 levels)
- Query cost analysis (each field has a cost, total must be < threshold)
- Timeout per query

---

## gRPC (Google Remote Procedure Call)

### What It Is
A high-performance RPC framework using Protocol Buffers (protobuf) for serialization and HTTP/2 for transport.

### How It Works

**1. Define the service in `.proto` file:**
```protobuf
syntax = "proto3";

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc ListUsers (ListUsersRequest) returns (stream User);  // server streaming
  rpc CreateUser (User) returns (User);
}

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
}

message GetUserRequest {
  int32 id = 1;
}
```

**2. Generate code:** `protoc` generates client and server stubs in any language.

**3. Call like a local function:**
```python
# Client code — looks like a local function call!
user = stub.GetUser(GetUserRequest(id=42))
print(user.name)  # "Alice"
```

### gRPC Communication Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Unary** | Client sends one request, server sends one response | Regular API calls |
| **Server streaming** | Client sends one request, server sends a stream of responses | Live feed, log tailing |
| **Client streaming** | Client sends a stream, server sends one response | File upload, data ingestion |
| **Bidirectional streaming** | Both sides send streams simultaneously | Chat, real-time sync |

### REST vs gRPC

| Aspect | REST (JSON) | gRPC (Protobuf) |
|--------|-------------|-----------------|
| **Serialization** | JSON (text, ~2x larger) | Protobuf (binary, compact) |
| **Speed** | Slower (parse JSON) | Faster (~7-10x) |
| **Contract** | OpenAPI (optional) | Required `.proto` file |
| **HTTP version** | 1.1 or 2 | HTTP/2 (required) |
| **Streaming** | Limited | Native bidirectional |
| **Browser support** | Native | Needs grpc-web proxy |
| **Debugging** | Easy (human-readable JSON, curl) | Harder (binary format) |
| **Best for** | Public APIs, web clients | Internal microservices, mobile, performance-critical |

### When to Use gRPC
- **Microservice-to-microservice:** High-volume internal calls where performance matters
- **Mobile clients:** Protobuf is smaller → less bandwidth
- **Streaming:** Real-time data feeds, bidirectional communication
- **Polyglot systems:** Proto files generate code for every language

### When NOT to Use gRPC
- **Public APIs:** Browser support is limited; developers expect REST/JSON
- **Simple CRUD:** Overkill if you don't need performance/streaming
- **Debugging:** Binary format makes it harder to debug with standard tools

---

## 🎤 Interview Questions & Expected Answers

### Q1: "When would you choose GraphQL over REST?"

**Expected answer:**
> "I'd choose GraphQL when:
>
> 1. **Multiple client types with different data needs.** A mobile app needs minimal data (name + thumbnail), while the web dashboard needs everything. With REST, you'd need separate endpoints or query parameters. GraphQL lets each client request exactly what it needs.
>
> 2. **Complex, deeply nested data.** If fetching a user's posts, each post's comments, and each comment's author requires 4+ REST calls, a single GraphQL query is far more efficient.
>
> 3. **Rapid frontend iteration.** Frontend teams can change what data they fetch without backend changes. No more waiting for a new API endpoint.
>
> I'd stick with REST when:
> - Building a public API (REST is more widely understood)
> - Heavy caching is needed (HTTP caching works great with REST, is harder with GraphQL)
> - Simple CRUD operations (GraphQL adds unnecessary complexity)
> - File uploads are common"

### Q2: "Why would you use gRPC instead of REST for internal service communication?"

**Expected answer:**
> "For internal microservice calls, gRPC offers significant advantages:
>
> 1. **Performance:** Protobuf is ~7-10x faster to serialize/deserialize than JSON, and the binary format is ~2-3x smaller. At thousands of calls per second between services, this adds up.
>
> 2. **Strong contracts:** The `.proto` file is the source of truth. Both client and server are generated from it, eliminating integration bugs. If a field type changes, it breaks at compile time, not at runtime.
>
> 3. **HTTP/2 multiplexing:** Multiple RPC calls over a single connection. No head-of-line blocking.
>
> 4. **Streaming:** Native support for server streaming, client streaming, and bidirectional streaming. Useful for real-time data feeds between services.
>
> 5. **Code generation:** Generate client libraries in any language automatically. In a polyglot microservices environment (Go, Java, Python), this is huge.
>
> The tradeoff is debugging difficulty (binary format) and the learning curve. But for high-throughput internal communication, the performance gains are worth it. Many companies use gRPC internally and REST externally."
