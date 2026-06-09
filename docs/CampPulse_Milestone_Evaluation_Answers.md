# CampPulse — Milestone Evaluation Answers

**Kingdom Hack 3.0 | Technical submission**

This document answers the milestone evaluation criteria for **System Architecture Design**, **Database Schema Specification**, and **API Routing Contracts**. Each section cites the internal engineering references that define the design.

**Primary references:**

| Doc | Path |
|---|---|
| System Overview | [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md) |
| Module Breakdown | [`CampPulse_TechDoc_S2_MODULE BREAKDOWN.md`](CampPulse_TechDoc_S2_MODULE%20BREAKDOWN.md) |
| Data Architecture | [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md) |
| API Design | [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md) |
| Monorepo Structure | [`CampPulse_TechDoc_S6_MONOREPO STRUCTURE.md`](CampPulse_TechDoc_S6_MONOREPO%20STRUCTURE.md) |
| Abstraction Levels | [`CampPulse_TechDoc_S8_ABSTRACTION LEVELS.md`](CampPulse_TechDoc_S8_ABSTRACTION%20LEVELS.md) |
| Milestones & Checkpoints | [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) |
| Project README | [`../README.md`](../README.md) |

---

## 1. System Architecture Design

### 1.1 What CampPulse Is

CampPulse is a camp-scale civic platform for **Redemption City**: navigation, incident reporting, peak-period congestion awareness, and emergency coordination in one unified system.

> *"Camp navigation and incident management for Redemption City."*  
> — [`README.md`](../README.md)

The system coordinates four operational concerns that share a live data layer — an incident updates the routing graph; congestion updates route calculations; emergency dispatch reads responder location and routing state.

> *See §1.2 System Responsibilities — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*

---

### 1.2 Tech Stack

| Layer | Technology | Responsibility |
|---|---|---|
| **Mobile client** | React Native (Expo Router) | Resident and driver app — map, reporting, navigation, WebSocket streams |
| **Web client** | Vite + React | Guest QR navigation (no install) + admin dashboard |
| **Backend** | FastAPI (Python) | Modular monolith — nine service modules behind one API gateway |
| **Persistent store** | PostgreSQL + PostGIS | System of record — users, incidents, road graph, zones |
| **Ephemeral store** | Redis (Upstash in production) | Sessions, rate limits, route cache, pub/sub, live location |
| **Maps & routing** | Mapbox SDK + server-side directions | Map rendering; camp-specific road layer and waypoint manipulation |
| **Object storage** | GCP Cloud Storage | Incident photo uploads via signed URLs |
| **Hosting** | Fly.io (prod); Docker Compose (local) | Backend, WebSockets, and local dev parity |
| **Monorepo tooling** | Turborepo + pnpm workspaces | Shared packages: `constants`, `shared-types`, `map-config` |

> *See §1.3 High-Level Architecture, §1.6 Deployment Topology, §1.7 Monorepo Structure — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*  
> *See monorepo layout and package roles — [`CampPulse_TechDoc_S6_MONOREPO STRUCTURE.md`](CampPulse_TechDoc_S6_MONOREPO%20STRUCTURE.md)*  
> *See local dev workflow — [`README.md`](../README.md)*

---

### 1.3 Architectural Bounds

CampPulse follows a **modular monolith with microservice boundaries**: one deployable unit for the hackathon MVP, structured internally as if it were already a distributed system so services can be split post-hackathon without a rewrite.

> *See §1.1 Architecture Philosophy — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*

**Guiding principles:**

- **Build piece by piece** — each module is independently buildable, testable, and verifiable.
- **Fail fast** — unproven choices (polyline encoding, congestion thresholds, Mapbox layer behaviour) have explicit substitution points.
- **Data owns behaviour** — business logic lives in the service that owns the data; no cross-service direct DB access.
- **Real-time is first-class** — location pings, congestion signals, route updates, and incident broadcasts shape every layer.

> *See §1.1 Architecture Philosophy — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*

**Layered design (four abstraction levels):**

```
Client → Gateway → Service → Domain → Data
```

| Level | Owns | Must NOT own |
|---|---|---|
| **Gateway** | Middleware, routing, rate limits, logging, JWT validation | Business logic, DB connections |
| **Service** | Routers, orchestration, event publishers/subscribers | Direct SQL, cross-service model imports |
| **Domain** | Schemas, validators, algorithms, domain rules | HTTP, Redis/DB clients |
| **Data** | PostgreSQL, PostGIS, Redis, GCP Storage, Mapbox client | Business logic, HTTP |

> *See §8.1 Overview and per-level contracts — [`CampPulse_TechDoc_S8_ABSTRACTION LEVELS.md`](CampPulse_TechDoc_S8_ABSTRACTION%20LEVELS.md)*

**Nine service modules** (each with a defined data boundary):

Auth, User Management, Incident, Routing, Realtime Location, Congestion Detection, Notification, Admin, and API Gateway.

> *See Section 2 — [`CampPulse_TechDoc_S2_MODULE BREAKDOWN.md`](CampPulse_TechDoc_S2_MODULE%20BREAKDOWN.md)*

**Separation of concerns across the stack:**

- **Client layer** — renders UI, manages local state and WebSocket connections; zero business logic.
- **API gateway** — rate limiting, auth, routing; traffic coordinator only.
- **Service layer** — domain logic; sync HTTP between services; async Redis Pub/Sub for events.
- **Shared data layer** — PostgreSQL + PostGIS (persistent) and Redis (ephemeral); each service owns its schema namespace.
- **External integrations** — Mapbox, GCP Cloud Storage; abstracted behind Level 4 clients.

> *See §1.4 Separation of Concerns — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*

---

### 1.4 Communication Protocols

| Protocol | Used for | Reference |
|---|---|---|
| **REST (HTTP/JSON)** | CRUD, auth, incident lifecycle, user management | [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md) §5.1 |
| **WebSocket** | Location pings, route updates, congestion alerts, incident broadcasts | [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md) §5.10 |
| **GraphQL** | Admin dashboard queries, analytics, multi-entity reads | [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md) §5.11 |
| **Redis Pub/Sub** | Internal event propagation — `incident.created`, `congestion.confirmed`, etc. | [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md) §3.4.2 |

> *See §1.5 Communication Protocols — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*

---

### 1.5 Secure Service Communication

**Authentication and authorisation**

- Protected REST endpoints require `Authorization: Bearer <access_token>`.
- Access token: JWT, 15-minute expiry, payload `{ user_id, role, jti }`.
- Refresh token: opaque string, 7-day expiry, stored as hash in PostgreSQL + Redis.
- Role hierarchy: `guest < resident < driver < admin`; higher roles satisfy lower requirements.
- Logout blacklists the access token JTI in Redis (TTL matches token expiry).

> *See §5.3 Authentication — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See role hierarchy in shared constants — [`packages/constants/src/roles.ts`](../packages/constants/src/roles.ts)*  
> *See M1 deliverables (token lifecycle, blacklist, dependencies) — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.3*

**Gateway middleware stack (M1 decision — Option B)**

The gateway runs **Logging + RateLimit** middleware only. There is no blocking `AuthMiddleware`; JWT is decoded inline in the rate limiter and in route dependencies (`get_current_user`, `require_role`, `optional_user`).

> *M1 implementation plan; aligns with Level 1 gateway contract in [`CampPulse_TechDoc_S8_ABSTRACTION LEVELS.md`](CampPulse_TechDoc_S8_ABSTRACTION%20LEVELS.md) §8.2*

**Rate limiting**

- Redis-backed sliding-window counter per user or IP.
- All responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Role`.
- Exceeded limits return `429 Too Many Requests` with `Retry-After`.

> *See §5.13 Rate Limiting Headers and §3.4.3 Rate Limiting — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md), [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

**WebSocket security**

- Authenticated connections: token validated on handshake; invalid token → connection rejected.
- Guest connections: accepted immediately; read-only stream (no ping ingestion).
- Heartbeat: client `ping` every 30 s; server `pong`.

> *See §5.10 WebSocket API — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

**Geofence enforcement**

- Camp boundary polygon stored in `camp_zones` (`zone_type = 'boundary'`).
- Location pings outside the boundary are silently dropped — not stored, not processed.
- Client-side boundary check runs before ping is sent (GeoJSON bundled in `packages/map-config`).

> *See §3.6 Data Retention and Geofence Enforcement — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *See boundary source — [`packages/map-config/src/boundary.json`](../packages/map-config/src/boundary.json)*

**Dual database wiring (M1)**

| Access path | Used for |
|---|---|
| **SQLAlchemy `get_session()`** | Service-layer CRUD (users, auth sessions) |
| **asyncpg pool** | `/health` endpoint only |

Both engine and pool are created in the FastAPI lifespan handler alongside the existing Redis connection.

> *M1 implementation plan; health check pattern in M0 — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.2*

**Production transport**

- HTTPS for REST and GraphQL; WSS for WebSocket.
- Fly.io anycast network for geographically distributed clients.

> *See §1.6 Deployment Topology — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*

---

### 1.6 Build Milestone Context

Work proceeds as vertical slices — each milestone delivers demonstrable end-to-end capability.

| Milestone | Scope | Doc reference |
|---|---|---|
| **M0** | Monorepo, Docker, PostGIS + Redis, health check | §9.2 |
| **M1** | Auth + users — register, login, refresh, logout, `/users/me`, RBAC | §9.3 |
| **M2** | Incident reporting core | §9.4 |
| **M3** | Map and navigation foundation | §9.5 |
| **M4** | Real-time location + congestion detection | §9.6 |
| **M5** | Admin dashboard (GraphQL) | §9.7 |
| **M6** | Emergency dispatch + notifications | §9.8 |
| **M7** | Demo hardening | §9.9 |

> *See full milestone dependency map — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.10*

---

## 2. Database Schema Specification

### 2.1 Data Layer Philosophy

CampPulse uses two data layers with distinct roles:

| Layer | Technology | Role |
|---|---|---|
| **System of record** | PostgreSQL + PostGIS | Persistent, relational, geospatially aware; ACID guarantees |
| **System of coordination** | Redis | Ephemeral, in-memory, pub/sub; real-time state and caching |

No data lives permanently in both layers. Redis holds working state (aggregation windows, session data, route cache, congestion flags). When state matures into a durable record, it graduates to PostgreSQL. Redis is never treated as a database.

> *See §3.1 Philosophy — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

---

### 2.2 Extensions and Enumerations

**PostgreSQL extensions**

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation (first statement in 002_users_auth migration)
CREATE EXTENSION IF NOT EXISTS postgis;        -- Geospatial types and functions (M0 init.sql)
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- Trigram indexing for text search
```

> *See §3.2.1 Extensions — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *M0 PostGIS bootstrap — [`infra/postgres/init.sql`](../infra/postgres/init.sql)*

**Shared enumerations**

| Enum | Values |
|---|---|
| `user_role` | `guest`, `resident`, `driver`, `admin` |
| `kyc_status` | `pending`, `verified`, `rejected` |
| `vehicle_type` | `tricycle`, `shuttle`, `other` |
| `incident_type` | `flooding`, `pothole`, `streetlight`, `water_leak`, `trash`, `security`, `congestion`, `other` |
| `incident_severity` | `low`, `medium`, `high`, `critical` |
| `incident_status` | `submitted`, `assigned`, `in_progress`, `resolved`, `closed` |
| `department` | `infrastructure`, `sanitation`, `security`, `utilities`, `emergency` |
| `notification_type` | `push`, `in_app`, `zone_broadcast` |

> *See §3.2.2 Enumerations — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *TypeScript mirror — [`packages/constants/src/roles.ts`](../packages/constants/src/roles.ts)*

---

### 2.3 Main Tables

#### M1 scope (auth foundation)

**`users`** — account records

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `email` | VARCHAR(255) UNIQUE | nullable for guest flows |
| `phone` | VARCHAR(20) | optional |
| `full_name` | VARCHAR(255) NOT NULL | |
| `password_hash` | VARCHAR(255) | bcrypt; never plaintext |
| `role` | `user_role` NOT NULL | default `resident` |
| `kyc_status` | `kyc_status` NOT NULL | default `pending` |
| `camp_id` | VARCHAR(100) | Redemption City resident ID |
| `zone` | VARCHAR(100) | camp zone assignment |
| `is_active` | BOOLEAN | default TRUE |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Indexes: `idx_users_role`, `idx_users_zone`, `idx_users_kyc`.

**`auth_sessions`** — refresh token sessions

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `users(id)` ON DELETE CASCADE | |
| `refresh_token_hash` | VARCHAR(255) NOT NULL | hashed opaque token |
| `device_fingerprint` | VARCHAR(255) | optional |
| `issued_at`, `expires_at` | TIMESTAMPTZ | 7-day refresh lifetime |
| `revoked` | BOOLEAN | default FALSE |

Indexes: `idx_sessions_user`, partial `idx_sessions_active` on `(user_id, revoked) WHERE revoked = FALSE`.

> *See §3.2.3 Users, §3.2.5 Auth Sessions — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *M1 migration deliverable — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.3*

#### Full blueprint (M2–M6)

| Table | Purpose | Key relationships |
|---|---|---|
| **`driver_profiles`** | Driver availability and live location | 1:1 with `users`; GIST index on `current_location` |
| **`incidents`** | Civic report lifecycle | FK `reporter_id`, `assigned_to` → `users`; self-ref `parent_incident_id` for duplicates |
| **`incident_upvotes`** | Community signal on reports | UNIQUE(`incident_id`, `user_id`) |
| **`incident_comments`** | Threaded discussion | FK → `incidents`, `users` |
| **`road_segments`** | Routing graph | `geom` LineString; partial index on active restrictions |
| **`camp_zones`** | Zone polygons + camp boundary | point-in-polygon for auto-zone detection |
| **`notification_log`** | Delivery audit trail | FK `user_id` → `users` (nullable) |
| **`congestion_events`** | Historical congestion (graduated from Redis) | computed `duration_seconds` column |

> *See §3.2.4–§3.2.12 — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

---

### 2.4 Relationship Constraints

```
users ──1:1── driver_profiles
users ──1:N── auth_sessions
users ──1:N── incidents (as reporter)
users ──1:N── incidents (as assignee)
users ──1:N── incident_upvotes, incident_comments

incidents ──self-ref── incidents (parent_incident_id → duplicate linking)
incidents ──1:N── incident_upvotes, incident_comments
```

Foreign key behaviours:

- `ON DELETE CASCADE` — sessions, upvotes, comments when parent user/incident removed.
- `ON DELETE SET NULL` — `incidents.reporter_id` when reporter account deleted.

> *See table definitions §3.2.3–§3.2.12 — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

---

### 2.5 Indexes and Query Performance

**Spatial indexes (GIST)**

| Table | Column | Query pattern |
|---|---|---|
| `driver_profiles` | `current_location` | Nearest available driver within radius |
| `incidents` | `location` | Duplicate detection (50 m), nearby fetch |
| `road_segments` | `geom` | Nearest segment to incident for restriction |
| `camp_zones` | `boundary` | Point-in-polygon zone determination |

**Composite / partial indexes**

- `idx_incident_active` on `(type, zone, status) WHERE status NOT IN ('resolved','closed')` — active incident dashboards.
- `idx_incident_department` on `(department, status, created_at DESC)` — department queue views.
- `idx_driver_available` on `is_available WHERE is_available = TRUE` — dispatch queries.
- `idx_segment_restricted` on `(is_restricted, zone) WHERE is_restricted = TRUE` — routing graph updates.

> *See §3.2 index definitions and §3.3 PostGIS Spatial Queries — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

**Representative spatial operations**

| Operation | Function | Complexity (with GIST) |
|---|---|---|
| Zone lookup | `ST_Within(point, boundary)` | O(log N) |
| Duplicate detection | `ST_DWithin(location, point, 50)` | O(log N) |
| Nearest driver | `ST_DWithin` + `ST_Distance` ORDER BY distance | O(log N) |
| Hotspot analytics | `ST_Collect`, `ST_Centroid`, grouped aggregates | Index-backed scans |

> *See §3.3 PostGIS Spatial Queries — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

---

### 2.6 Transaction Consistency

**ACID (PostgreSQL)**

- Incident lifecycle writes (create, status transition, assign, resolve) run in transactions with valid-state enforcement.
- Auth session rotation on refresh invalidates the previous refresh token atomically.
- Duplicate detection and upvote increment on duplicate submission are transactional.

> *See incident lifecycle data flow §3.5 — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *See status transition rules — [`CampPulse_TechDoc_S2_MODULE BREAKDOWN.md`](CampPulse_TechDoc_S2_MODULE%20BREAKDOWN.md)*

**Eventual consistency (Redis Pub/Sub)**

- After a Postgres write, services publish events (`incident.created`, `incident.resolved`, `congestion.confirmed`).
- Subscribers (Routing, Notification, Congestion) update Redis state and push WebSocket messages.
- Handlers are idempotent; self-healing on the next event if a message is missed.

> *See §3.4.2 Pub/Sub channels and §3.5 Data Flow — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *See risk register (Pub/Sub message loss) — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.11*

**Privacy constraint**

Individual location pings are never written to PostgreSQL. They live exclusively in Redis with a 30-second TTL.

> *See §3.6 Data Retention — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

---

### 2.7 Redis Schema (Ephemeral Layer)

**Key naming:** `{service}:{entity}:{identifier}:{sub_key}`

| Key pattern | Type | TTL | Purpose |
|---|---|---|---|
| `auth:blacklist:{jti}` | String | matches JWT expiry | Revoked access tokens |
| `auth:refresh:{user_id}` | String | 7 days | Refresh token lookup |
| `location:user:{user_id}` | Hash | 30 s | Active user location |
| `congestion:window:{zone_id}:{window_id}` | Sorted Set | 90 s | Ping count in detection window |
| `congestion:state:{zone_id}` | Hash | 60 s / 24 h | Zone congestion status |
| `route:{origin_hash}:{destination_hash}` | String | 5 min | Cached route polyline |
| `ratelimit:{user_id_or_ip}:{window_start}` | String | 60 s | Rate limit counter |

> *See §3.4 Redis Data Architecture — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *Congestion thresholds — [`packages/constants/congestion.json`](../packages/constants/congestion.json)*

---

### 2.8 Migration Strategy

- **Tool:** Alembic (FastAPI standard).
- **Convention:** one migration file per schema change; additive where possible; every migration has `downgrade()`.
- **M0:** empty initial revision; PostGIS enabled via `infra/postgres/init.sql`.
- **M1:** `002_users_auth` — `uuid-ossp` extension first, then `users` and `auth_sessions`.
- **Run command:** root `pnpm db:migrate` → `docker compose exec api alembic upgrade head`.

> *See §3.7 Database Migration Strategy — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *Alembic config — [`apps/api/alembic.ini`](../apps/api/alembic.ini)*

---

## 3. API Routing Contracts

### 3.1 Design Principles

- **REST** for commands and simple resource operations.
- **GraphQL** for complex admin reads (variable query shape, no over-fetching).
- **WebSocket** for continuous bidirectional streams.
- **Consistent envelopes** — same success and error structure across REST, GraphQL, and WebSocket error frames.
- **Versioning from day one** — all REST endpoints prefixed `/api/v1/`.

> *See §5.1 Design Principles — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

---

### 3.2 Base URLs

```
Production REST:   https://api.camppulse.ng/api/v1
Development REST:  http://localhost:8000/api/v1
WebSocket:         wss://api.camppulse.ng/ws
GraphQL:           https://api.camppulse.ng/graphql
Health (no prefix): http://localhost:8000/health
```

> *See §5.2 Base URL and Versioning — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *M0 health check — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.2*

---

### 3.3 Standard Response Envelope

**Success**

```json
{
  "success": true,
  "data": { },
  "meta": {
    "timestamp": 1716912000,
    "request_id": "uuid"
  }
}
```

- `meta.request_id` is populated by the logging middleware from the inbound request context.
- Implemented in `core/responses.py` via `success_response()`.

> *See §5.4 Standard Response Envelope — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

**Paginated success** — adds `meta.pagination` with `page`, `page_size`, `total`, `total_pages`, `has_next`, `has_prev`.

> *See §5.4 Paginated Success — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

**Error**

```json
{
  "success": false,
  "error": {
    "code": "INCIDENT_NOT_FOUND",
    "message": "No incident found with the provided ID.",
    "field": null
  },
  "meta": {
    "timestamp": 1716912000,
    "request_id": "uuid"
  }
}
```

**Validation error** — `error.fields[]` with per-field messages.

> *See §5.4 Error and Validation Error — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

---

### 3.4 HTTP Status Code Convention

| Code | Usage |
|---|---|
| 200 | Successful GET, PATCH |
| 201 | Successful POST — resource created |
| 204 | Successful DELETE or logout — no body |
| 400 | Validation error or malformed request |
| 401 | Missing or invalid authentication token |
| 403 | Authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Conflict — duplicate resource |
| 422 | Passes validation but fails business rules |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Upstream dependency unavailable |

> *See §5.5 HTTP Status Code Convention — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

---

### 3.5 Authentication Gates

**Header:** `Authorization: Bearer <access_token>`

**Role hierarchy:** `guest < resident < driver < admin`

**FastAPI dependencies:**

| Dependency | Behaviour |
|---|---|
| `get_current_user` | Requires valid, non-blacklisted JWT; returns user context |
| `require_role(role)` | Enforces minimum role; `403 INSUFFICIENT_ROLE` if too low |
| `optional_user` | Returns `None` for unauthenticated requests without rejecting (ships in M1 for M2 guest endpoints) |

**Dev-only RBAC verification:** `GET /api/v1/users/_rbac-check` with `require_role("admin")`, gated by `ENVIRONMENT=development`.

> *See §5.3 Authentication — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API DESIGN.md)*  
> *See M1 deliverables and checkpoint scenarios — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.3*  
> *Python role mirror — `core/roles.py` (M1 plan)*

**Deferred:** `GET /auth/validate`

---

### 3.6 M1 Endpoints — Auth & Users

#### POST `/api/v1/auth/register`

| | |
|---|---|
| **Auth** | None |
| **Request** | `{ email, password, full_name, phone?, role, camp_id?, zone? }` |
| **Response** | `201` — `{ user: { id, email, full_name, role, kyc_status }, tokens: { access_token, refresh_token, expires_in } }` |
| **Errors** | `EMAIL_TAKEN`, `INVALID_ROLE`, `VALIDATION_ERROR` |

#### POST `/api/v1/auth/login`

| | |
|---|---|
| **Auth** | None |
| **Request** | `{ email, password }` |
| **Response** | `200` — `{ user: { id, role, kyc_status }, tokens: { access_token, refresh_token, expires_in } }` |
| **Errors** | `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED` |

#### POST `/api/v1/auth/refresh`

| | |
|---|---|
| **Auth** | None (refresh token in body) |
| **Request** | `{ refresh_token }` |
| **Response** | `200` — flat tokens under `data`: `{ access_token, refresh_token, expires_in }` (no nested `tokens` object) |
| **Errors** | `INVALID_REFRESH_TOKEN`, `SESSION_EXPIRED` |

> *Register/login wrap tokens in `data.tokens`; refresh returns flat token fields under `data` — documented M1 shape distinction.*

#### POST `/api/v1/auth/logout`

| | |
|---|---|
| **Auth** | Resident+ |
| **Request** | Empty body |
| **Response** | `204` No content |
| **Behaviour** | Blacklists current access token JTI in Redis; deletes refresh token |

#### GET `/api/v1/users/me`

| | |
|---|---|
| **Auth** | Resident+ |
| **Response** | `200` — full user profile (`id`, `email`, `full_name`, `phone`, `role`, `kyc_status`, `camp_id`, `zone`, `created_at`) |
| **Errors** | `401` missing/invalid/blacklisted token |

#### GET `/api/v1/users/_rbac-check` *(development only)*

| | |
|---|---|
| **Auth** | Admin (`require_role("admin")`) |
| **Gate** | `ENVIRONMENT=development` |
| **Purpose** | Integration test and manual smoke verification of RBAC |

> *See §5.6 Auth Service Endpoints, §5.7 User Management — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See M1 smoke test — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.3*

---

### 3.7 M2 Endpoints — Incident Management

| Method | Route | Auth | Summary |
|---|---|---|---|
| POST | `/incidents` | None (guest OK) | Multipart submit; duplicate detection; zone + department auto-routing |
| GET | `/incidents/:id` | None | Full incident detail with comments |
| GET | `/incidents/nearby` | None | Paginated spatial query; `lat`, `lon`, `radius_metres` |
| GET | `/incidents/zone/:zone` | Resident+ | Filtered zone list |
| POST | `/incidents/:id/upvote` | Resident+ | Increment upvote count |
| POST | `/incidents/:id/comments` | Resident+ | Add comment |
| PATCH | `/incidents/:id/status` | Admin | Status transition with optional note |
| PATCH | `/incidents/:id/assign` | Admin | Assign to user + department |

**POST `/incidents` request fields (multipart/form-data):**

```
type        string (required) — incident_type enum
description string (optional)
lat         float (required)
lon         float (required)
severity    string (optional, default "low")
photo       file (optional, jpeg/png, max 5MB)
```

**Key error codes:** `LOCATION_OUTSIDE_BOUNDARY`, `INVALID_INCIDENT_TYPE`, `PHOTO_TOO_LARGE`, `ALREADY_UPVOTED`, `INCIDENT_CLOSED`

> *See §5.8 Incident Management Endpoints — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See M2 deliverables and checkpoint — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.4*

---

### 3.8 M3 Endpoints — Routing

| Method | Route | Auth | Summary |
|---|---|---|---|
| POST | `/routes/calculate` | None | Origin + destination → encoded polyline, distance, ETA |
| POST | `/routes/reroute` | None | Recalculate avoiding known segment IDs |
| GET | `/routes/segments/restricted` | Resident+ | List currently restricted segments |
| PATCH | `/routes/segments/:id/restrict` | Admin | Mark segment restricted |
| PATCH | `/routes/segments/:id/clear` | Admin | Clear restriction |

**POST `/routes/calculate` request:**

```json
{
  "origin": { "lat": 6.9271, "lon": 3.3958 },
  "destination": { "lat": 6.9310, "lon": 3.4001 },
  "mode": "walking"
}
```

**Response fields:** `encoded_polyline`, `distance_metres`, `eta_seconds`, `restricted_segments_avoided`, `congestion_zones_avoided`, `cached`, `cached_at`

**Key error codes:** `ORIGIN_OUTSIDE_BOUNDARY`, `DESTINATION_OUTSIDE_BOUNDARY`, `NO_ROUTE_FOUND`

> *See §5.9 Routing Service Endpoints — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See M3 deliverables — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.5*

---

### 3.9 M4 — WebSocket API

**Connection endpoints:**

```
Authenticated:  wss://api.camppulse.ng/ws/location?token={access_token}
Guest:          wss://api.camppulse.ng/ws/location/guest
```

**Client → Server message types:**

| Type | Payload | Auth |
|---|---|---|
| `location_ping` | `{ lat, lon, accuracy, speed, heading, timestamp }` | Authenticated only |
| `navigation_start` | `{ destination, mode, encoded_polyline }` | Authenticated |
| `navigation_end` | `{}` | Authenticated |

**Server → Client message types:**

| Type | When sent |
|---|---|
| `route_update` | Active navigator's route affected by incident or congestion |
| `zone_alert` | Congestion confirmed in user's zone |
| `incident_nearby` | High-severity incident within 300 m |
| `zone_clearing` | Congestion cleared |
| `error` | Invalid ping, out-of-boundary, etc. |

> *See §5.10 WebSocket API — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See M4 deliverables — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.6*

---

### 3.10 M5 — GraphQL API

**Endpoint:** `POST /graphql` (Admin auth required)

**Key queries:**

| Query | Returns |
|---|---|
| `dashboardSummary` | Open incidents, active congestion zones, response metrics, active drivers |
| `incidents(filter)` | Paginated incident list with full filter support |
| `incidentHotspots(dateRange, zone)` | Spatial aggregation for hotspot map |
| `equityMetrics(dateRange)` | Per-zone attention scores |
| `activeCongestionZones` | Live congestion state |
| `restrictedSegments` | Current road restrictions |

**Key mutations:**

| Mutation | Action |
|---|---|
| `updateIncidentStatus` | Single incident status change |
| `assignIncident` | Assign to user + department |
| `bulkUpdateIncidentStatus` | Batch status update |
| `markIncidentDuplicate` | Link duplicate to parent |
| `restrictSegment` / `clearSegment` | Road graph management |
| `updateUserRole` / `updateKycStatus` | User admin |
| `sendZoneBroadcast` | Push in-app message to zone |

> *See §5.11 GraphQL Schema — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See M5 deliverables — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.7*

---

### 3.11 M6 — User & Dispatch Endpoints

| Method | Route | Auth | Summary |
|---|---|---|---|
| GET | `/users/drivers/available` | Resident+ | Nearest available drivers; query `lat`, `lon`, `radius_metres` (default 2000) |
| PATCH | `/users/:id/role` | Admin | Change user role |
| PATCH | `/users/:id/kyc` | Admin | Update KYC status |

Critical-severity incident submission triggers emergency dispatch: PostGIS proximity query → route calculation → driver notification → ETA in response.

> *See §5.7 User Management — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See M6 deliverables — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.8*

---

### 3.12 Error Code Registry

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Payload failed schema validation |
| `INVALID_CREDENTIALS` | 401 | Email/password mismatch |
| `MISSING_TOKEN` | 401 | Authorization header absent |
| `INVALID_TOKEN` | 401 | JWT malformed, expired, or blacklisted |
| `INSUFFICIENT_ROLE` | 403 | Role too low for endpoint |
| `ACCOUNT_DISABLED` | 403 | User deactivated |
| `USER_NOT_FOUND` | 404 | No user with provided ID |
| `INCIDENT_NOT_FOUND` | 404 | No incident with provided ID |
| `SEGMENT_NOT_FOUND` | 404 | No road segment with provided ID |
| `EMAIL_TAKEN` | 409 | Email already registered |
| `ALREADY_UPVOTED` | 409 | Duplicate upvote |
| `INCIDENT_CLOSED` | 422 | Action not permitted on closed incident |
| `LOCATION_OUTSIDE_BOUNDARY` | 422 | Coordinates outside camp geofence |
| `NO_ROUTE_FOUND` | 422 | Routing engine found no valid path |
| `ORIGIN_OUTSIDE_BOUNDARY` | 422 | Route origin outside geofence |
| `DESTINATION_OUTSIDE_BOUNDARY` | 422 | Route destination outside geofence |
| `PHOTO_TOO_LARGE` | 400 | Photo exceeds 5MB |
| `INVALID_INCIDENT_TYPE` | 400 | Unrecognised incident type |
| `INVALID_ROLE` | 400 | Unrecognised role value |
| `SESSION_EXPIRED` | 401 | Refresh token expired |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token not found or reused |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `UPSTREAM_UNAVAILABLE` | 503 | External dependency unreachable |

> *See §5.12 Error Code Registry — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

---

### 3.13 Rate Limiting Headers

All responses include:

```
X-RateLimit-Limit:     300
X-RateLimit-Remaining: 247
X-RateLimit-Reset:     1716912060
X-RateLimit-Role:      resident
```

When exceeded:

```
HTTP 429 Too Many Requests
Retry-After: 23
```

M1 verification: pytest burst test at 61 requests confirms `429`; smoke test checks headers only.

> *See §5.13 Rate Limiting Headers — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See M1 success rubric — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.3*

---

### 3.14 End-to-End API Event Flow (Incident → Route Update)

```
POST /incidents
  → PostgreSQL write
  → Redis publish incident.created
  → Routing Svc: restrict nearest road segment (PostGIS)
  → Invalidate route cache keys in Redis
  → WebSocket route_update to active navigators
  → Notification Svc: admin push + zone broadcast
```

> *See §3.5 Data Flow: End-to-End Incident Lifecycle — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

---

*CampPulse Technical Documentation — Milestone Evaluation Answers v1.0*
