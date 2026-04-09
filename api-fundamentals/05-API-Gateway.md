# 🚪 API Gateway — Deep Dive

## What Is an API Gateway?

An API Gateway is a single entry point for all client requests in a microservices architecture. It handles cross-cutting concerns (authentication, rate limiting, routing) so individual services don't have to.

```
Without API Gateway:
  Mobile App → User Service (auth, rate limit, logging)
  Mobile App → Order Service (auth, rate limit, logging)
  Mobile App → Payment Service (auth, rate limit, logging)
  (Every service duplicates cross-cutting concerns!)

With API Gateway:
  Mobile App → [API Gateway] → User Service
                             → Order Service  
                             → Payment Service
  (Cross-cutting concerns handled once, at the gateway)
```

---

## What an API Gateway Does

| Feature | Description | Why It Matters |
|---------|-------------|----------------|
| **Request routing** | Routes `/api/users/*` to User Service, `/api/orders/*` to Order Service | Services are decoupled from URL structure |
| **Authentication** | Validates JWT tokens, API keys, OAuth tokens | Services receive pre-authenticated requests |
| **Rate limiting** | Throttles requests per client/IP/API key | Protects backend from abuse/overload |
| **Load balancing** | Distributes across service instances | High availability for each service |
| **SSL termination** | Handles HTTPS; backends use plain HTTP | Simplifies backend configuration |
| **Request/Response transformation** | Modify headers, body format, aggregate responses | Backend API independence |
| **Caching** | Cache frequent responses at the gateway | Reduces backend load |
| **Circuit breaking** | Stops forwarding to failing services | Prevents cascading failures |
| **Logging & metrics** | Centralized request logging, latency tracking | Observability |
| **CORS** | Handle cross-origin requests for browsers | Security |
| **Request validation** | Validate schema before forwarding | Reject bad requests early |
| **API composition** | Aggregate data from multiple services into one response | Reduces client complexity |

---

## API Gateway Patterns

### Backend for Frontend (BFF)

Different clients have different needs. A mobile app needs minimal data; a web dashboard needs rich data.

```
Mobile App  → [Mobile BFF Gateway]  → Backend Services
Web App     → [Web BFF Gateway]     → Backend Services
Partner API → [Partner API Gateway] → Backend Services
```

Each BFF is optimized for its client's needs: response shape, authentication method, rate limits.

**Used by:** Netflix (separate gateways for TV, mobile, web), SoundCloud.

### Gateway Aggregation

The gateway combines data from multiple services into a single response:

```
Client: GET /dashboard

Gateway:
  1. Call User Service → get user profile
  2. Call Order Service → get recent orders
  3. Call Notification Service → get unread count
  4. Combine all three → return single response
```

This reduces the number of round trips from the client (especially important for mobile on slow networks).

---

## Popular API Gateway Solutions

| Solution | Type | Best For |
|----------|------|----------|
| **Kong** | Open-source, plugin-based | Flexible, custom plugins, Kubernetes-native |
| **AWS API Gateway** | Managed (serverless) | AWS-native, Lambda integration, pay-per-request |
| **Nginx** | Reverse proxy + API gateway | High performance, widely known |
| **Envoy** | Service mesh sidecar + gateway | Kubernetes, service mesh (Istio) |
| **Traefik** | Cloud-native, auto-discovery | Docker/Kubernetes environments |
| **Zuul** | Netflix OSS | Spring Cloud / Java ecosystems |
| **Apigee** | Managed (Google) | Enterprise API management |

---

## API Gateway vs Load Balancer vs Reverse Proxy

| Feature | Load Balancer | Reverse Proxy | API Gateway |
|---------|--------------|---------------|-------------|
| Distributes traffic | ✅ | ✅ | ✅ |
| SSL termination | Some | ✅ | ✅ |
| Content-based routing | L7 only | ✅ | ✅ |
| Authentication | ❌ | Limited | ✅ |
| Rate limiting | Basic | Limited | ✅ |
| API composition | ❌ | ❌ | ✅ |
| Request transformation | ❌ | Limited | ✅ |
| Developer portal | ❌ | ❌ | ✅ |
| Analytics | Basic | Basic | ✅ Rich |

**In practice:** Load balancer → Reverse proxy → API Gateway is a spectrum of increasing features and complexity. An API Gateway is a reverse proxy with API-specific features added.

---

## 🎤 Interview Questions & Expected Answers

### Q1: "Why use an API Gateway in a microservices architecture?"

**Expected answer:**
> "An API Gateway serves as a single entry point that handles cross-cutting concerns centrally:
>
> 1. **Decouples clients from services:** Clients call one endpoint. The gateway routes internally. We can refactor, split, or merge services without changing client code.
>
> 2. **Centralized authentication:** Validate tokens once at the gateway, not in every service. Services receive pre-authenticated requests with user context in headers.
>
> 3. **Rate limiting:** Enforce limits at the edge before requests reach backend services.
>
> 4. **Protocol translation:** External clients use REST/JSON, but internal services might use gRPC. The gateway can translate.
>
> 5. **API composition:** Mobile clients on slow networks benefit from a single request that aggregates data from multiple services, instead of making 5 separate calls.
>
> 6. **Observability:** Centralized logging, metrics, and tracing for all API traffic.
>
> The tradeoff is that the gateway can become a bottleneck or single point of failure. Mitigation: make it horizontally scalable and redundant, keep gateway logic lightweight (no business logic), and use multiple gateways for different client types (BFF pattern)."

### Q2: "Isn't an API Gateway a single point of failure?"

**Expected answer:**
> "It can be, but we mitigate it:
>
> 1. **Multiple instances:** Run the gateway as a cluster of instances behind a network load balancer. If one instance fails, others continue.
>
> 2. **Auto-scaling:** Scale gateway instances based on traffic. Handle peak loads without downtime.
>
> 3. **Managed services:** AWS API Gateway, Google Cloud Endpoints are fully managed with built-in redundancy.
>
> 4. **Minimal logic:** Keep the gateway thin — only routing, auth, rate limiting. No business logic. This makes it fast and reliable.
>
> 5. **Multiple gateways (BFF):** Different gateways for different clients. One gateway's failure doesn't affect all clients.
>
> 6. **Health checks:** Load balancer health-checks gateway instances and removes unhealthy ones.
>
> So yes, it's a critical component, but with proper redundancy, it's no more of a SPOF than your load balancer."
