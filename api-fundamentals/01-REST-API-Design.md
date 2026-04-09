# 🏗️ REST API Design — Deep Dive

## What is REST?

REST (Representational State Transfer) is an architectural style for building web APIs. It was defined by Roy Fielding in his 2000 PhD thesis. REST is NOT a protocol — it's a set of constraints that, when followed, produce scalable, maintainable APIs.

---

## The 6 REST Constraints

### 1. Client-Server Separation
Client handles presentation; server handles data and logic. They evolve independently.

### 2. Statelessness
Every request contains ALL information needed to process it. The server stores no client context between requests. Session state lives on the CLIENT (or in an external store like Redis).

**Why it matters:** Stateless servers can be horizontally scaled trivially — any server can handle any request.

### 3. Cacheability
Responses must define themselves as cacheable or non-cacheable. Clients and intermediaries (CDNs, proxies) can cache responses to improve performance.

### 4. Uniform Interface
The API follows consistent conventions: resource identification (URLs), resource manipulation through representations (JSON/XML), self-descriptive messages (headers), and HATEOAS (hypermedia links).

### 5. Layered System
The client can't tell whether it's connected to the end server or an intermediary (LB, CDN, proxy). Each layer only knows about the next.

### 6. Code on Demand (Optional)
Server can send executable code to the client (JavaScript). Rarely relevant for APIs.

---

## Designing Great REST APIs

### Resource Naming

Resources are NOUNS, not verbs. URLs identify resources; HTTP methods define actions.

```
✅ GOOD:
  GET    /users              → List all users
  GET    /users/42           → Get user 42
  POST   /users              → Create a new user
  PUT    /users/42           → Replace user 42
  PATCH  /users/42           → Partially update user 42
  DELETE /users/42           → Delete user 42

❌ BAD:
  GET    /getUsers           → Verb in URL
  POST   /createUser         → Verb in URL
  GET    /deleteUser/42      → Using GET for a destructive action!
  POST   /users/42/update    → Verb in URL, use PATCH instead
```

### Nested Resources (Relationships)

```
GET  /users/42/posts         → All posts by user 42
GET  /users/42/posts/7       → Post 7 by user 42
POST /users/42/posts         → Create a post for user 42

GET  /posts/7/comments       → All comments on post 7
POST /posts/7/comments       → Add a comment to post 7
```

**Don't nest too deeply:** `/users/42/posts/7/comments/3/replies/1` is too much. Flatten when possible: `/comments/3` or `/replies/1`.

### Pagination

Never return unbounded lists. Always paginate.

**Offset-based pagination:**
```
GET /posts?offset=0&limit=20    → Posts 1-20
GET /posts?offset=20&limit=20   → Posts 21-40
```
- Simple but has problems: inserting/deleting items shifts offsets; large offsets are slow (DB must skip rows).

**Cursor-based pagination (preferred):**
```
GET /posts?limit=20
→ { data: [...], next_cursor: "eyJpZCI6MTAwfQ==" }

GET /posts?cursor=eyJpZCI6MTAwfQ==&limit=20
→ { data: [...], next_cursor: "eyJpZCI6MTIwfQ==" }
```
- Stable even when items are added/deleted
- Performant for large datasets (uses indexed column, typically `id` or `created_at`)
- Used by Twitter, Facebook, Slack APIs

### Filtering, Sorting, Searching

```
GET /products?category=electronics&brand=apple&sort=-price&search=iphone
                                                      ↑
                                              "-" prefix = descending
```

### Versioning

```
URL path (most common):    /api/v1/users
Header:                    Accept: application/vnd.myapi.v1+json
Query param:               /api/users?version=1
```

**URL path versioning is clearest and most widely used.** Easy to route at the load balancer level.

### Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body contains invalid fields.",
    "details": [
      { "field": "email", "message": "Must be a valid email address" },
      { "field": "age", "message": "Must be a positive integer" }
    ],
    "request_id": "req_abc123"
  }
}
```

**Always include:**
- Machine-readable error code
- Human-readable message
- Request ID for debugging
- Field-level details for validation errors

### HATEOAS (Hypermedia)

Responses include links to related actions/resources:
```json
{
  "id": 42,
  "name": "Alice",
  "links": {
    "self": "/users/42",
    "posts": "/users/42/posts",
    "followers": "/users/42/followers"
  }
}
```

Rarely implemented fully in practice, but including `self` and pagination links is common.

---

## REST API Security

| Concern | Solution |
|---------|----------|
| **Authentication** | JWT tokens, OAuth 2.0, API keys |
| **Authorization** | Role-based access control (RBAC), resource-level permissions |
| **Transport security** | HTTPS everywhere |
| **Input validation** | Validate all input server-side (never trust the client) |
| **Rate limiting** | Prevent abuse (429 Too Many Requests) |
| **CORS** | Control which domains can call your API from browsers |
| **SQL injection** | Parameterized queries (never string concatenation) |
| **Data exposure** | Return only necessary fields; don't expose internal IDs |

---

## 🎤 Interview Questions & Expected Answers

### Q1: "Design the API for a Twitter-like social media platform."

**Expected answer:**
> ```
> Authentication:
>   POST   /auth/login         { email, password }     → { access_token, refresh_token }
>   POST   /auth/refresh       { refresh_token }       → { access_token }
>
> Users:
>   GET    /users/:id                                  → User profile
>   PATCH  /users/:id          { bio, avatar_url }     → Updated profile
>   GET    /users/:id/followers ?cursor=X&limit=20     → Paginated followers
>   GET    /users/:id/following ?cursor=X&limit=20     → Paginated following
>   POST   /users/:id/follow                           → Follow user
>   DELETE /users/:id/follow                           → Unfollow user
>
> Tweets:
>   POST   /tweets             { text, media_ids[] }   → Created tweet
>   GET    /tweets/:id                                 → Single tweet
>   DELETE /tweets/:id                                 → Delete tweet
>   POST   /tweets/:id/like                            → Like tweet
>   DELETE /tweets/:id/like                            → Unlike tweet
>   POST   /tweets/:id/retweet                         → Retweet
>   GET    /tweets/:id/replies ?cursor=X&limit=20      → Replies to tweet
>
> Timeline:
>   GET    /timeline/home      ?cursor=X&limit=20      → Home feed (tweets from followed users)
>   GET    /timeline/user/:id  ?cursor=X&limit=20      → User's tweets
>
> Search:
>   GET    /search/tweets      ?q=keyword&cursor=X     → Search tweets
>   GET    /search/users       ?q=name&cursor=X        → Search users
> ```
>
> Key decisions:
> - Cursor-based pagination for all list endpoints
> - Idempotency: liking a tweet twice is a no-op (idempotent)
> - Rate limiting: 300 requests/15 minutes (like Twitter's actual limit)
> - Authentication: Bearer token in `Authorization` header
> - Versioning: `/api/v1/` prefix"

### Q2: "PUT vs PATCH — when would you use each?"

**Expected answer:**
> "**PUT** replaces the entire resource. You must send ALL fields. If you omit a field, it's set to null/default. PUT is idempotent — calling it twice with the same body produces the same result.
>
> **PATCH** updates only the specified fields. Other fields are untouched. PATCH is technically not idempotent (though many implementations make it so).
>
> **When to use PUT:** When the client has the complete resource and wants to replace it entirely. Common for simple resources where the client always has all the data.
>
> **When to use PATCH:** When the client wants to update specific fields without affecting others. Common for complex resources with many fields where the client only wants to change one or two.
>
> **In practice,** PATCH is more commonly used in modern APIs because it's more bandwidth-efficient and less error-prone (no risk of accidentally nulling out fields you forgot to include in a PUT)."

---

## 🧠 Mental Model

```
REST API = A well-organized library:

Resources = Books on shelves
  /users     = The "Users" shelf
  /users/42  = Book #42 on that shelf

HTTP Methods = Actions you can take:
  GET    = Read a book (doesn't change anything)
  POST   = Donate a new book (library assigns a shelf number)
  PUT    = Replace a book entirely (swap with a new edition)
  PATCH  = Add a sticky note to a book (modify part of it)
  DELETE = Remove a book from the shelf

Status Codes = Library responses:
  200 = "Here's your book"
  201 = "Your donation was accepted, it's now book #43"
  404 = "We don't have that book"
  401 = "You need a library card first"
  429 = "You've checked out too many books today"
```
