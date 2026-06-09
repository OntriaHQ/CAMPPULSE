# CampPulse — Milestone Evaluation Answers

**Kingdom Hack 3.0 | Technical submission**

Answers below map **one-to-one** to the milestone evaluation prompts for **System Architecture Design**, **Database Schema Specification**, and **API Routing Contracts**. Each answer cites the internal engineering references that define the design.

**Primary references:**

| Doc | Path |
|---|---|
| System Overview | [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md) |
| Module Breakdown | [`CampPulse_TechDoc_S2_MODULE BREAKDOWN.md`](CampPulse_TechDoc_S2_MODULE%20BREAKDOWN.md) |
| Data Architecture | [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md) |
| API Design | [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md) |
| Monorepo Structure | [`CampPulse_TechDoc_S6_MONOREPO STRUCTURE.md`](CampPulse_TechDoc_S6_MONOREPO%20STRUCTURE.md) |
| Design Patterns | [`CampPulse_TechDoc_S7_DESIGN PATTERN.md`](CampPulse_TechDoc_S7_DESIGN%20PATTERN.md) |
| Abstraction Levels | [`CampPulse_TechDoc_S8_ABSTRACTION LEVELS.md`](CampPulse_TechDoc_S8_ABSTRACTION%20LEVELS.md) |
| Milestones & Checkpoints | [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) |
| Environment template | [`.env.example`](../.env.example) |
| Project README | [`../README.md`](../README.md) |

---

## 1. System Architecture Design

CampPulse is a camp-scale civic platform for **Redemption City**: navigation, incident reporting, peak-period congestion awareness, and emergency coordination. Four operational concerns share a live data layer — an incident updates the routing graph; congestion updates route calculations; emergency dispatch reads responder location and routing state.

> *See §1.2 System Responsibilities — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*  
> *Product scope — [`README.md`](../README.md)*

---

### Q1. Describe your tech stack (frontend, backend, database layers, hosting, integrations).

| Layer | Technology | Responsibility |
|---|---|---|
| **Mobile client** | React Native (Expo Router) | Resident and driver app — map, reporting, navigation, WebSocket streams |
| **Web client** | Vite + React | Guest QR navigation (no install) + admin dashboard |
| **Backend** | FastAPI (Python) | Modular monolith — nine service modules behind one API gateway |
| **Persistent store** | PostgreSQL + PostGIS | System of record — users, incidents, road graph, zones |
| **Ephemeral store** | Redis (Upstash in production) | Sessions, rate limits, route cache, pub/sub, live location |
| **Maps & routing** | Mapbox SDK + server-side directions | Map rendering; camp-specific road layer and waypoint manipulation |
| **Object storage** | Cloudflare R2 | Incident photo uploads via presigned URLs (S3-compatible API) |
| **Hosting** | Fly.io (prod); Docker Compose (local) | Backend, WebSockets, and local dev parity |
| **Monorepo tooling** | Turborepo + pnpm workspaces | Shared packages: `constants`, `shared-types`, `map-config` |

**Integrations and protocols**

| Integration / protocol | Role |
|---|---|
| **Mapbox** | Client map rendering; server-side route calculation with camp road graph |
| **Cloudflare R2** | Binary incident photos; presigned PUT URLs keep uploads off the API server |
| **OpenRouteService** | Fallback routing when Mapbox circuit breaker is open |
| **REST (HTTP/JSON)** | CRUD, auth, incident lifecycle, user management |
| **WebSocket** | Location pings, route updates, congestion alerts, incident broadcasts |
| **GraphQL** | Admin dashboard queries, analytics, multi-entity reads |
| **Redis Pub/Sub** | Internal events — `incident.created`, `congestion.confirmed`, etc. |

**R2 environment variables** (see [`.env.example`](../.env.example)):

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=camppulse-uploads
R2_PUBLIC_BASE_URL=https://uploads.camppulse.ng
```

> *See §1.3 High-Level Architecture, §1.5 Communication Protocols, §1.6 Deployment Topology — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*  
> *See monorepo layout — [`CampPulse_TechDoc_S6_MONOREPO STRUCTURE.md`](CampPulse_TechDoc_S6_MONOREPO%20STRUCTURE.md)*  
> *See local dev workflow — [`README.md`](../README.md)*  
> *See R2 circuit breaker — [`CampPulse_TechDoc_S7_DESIGN PATTERN.md`](CampPulse_TechDoc_S7_DESIGN%20PATTERN.md) §7.5*

---

### Q2. Explain your architectural bounds (e.g. Clean Architecture, MVC, Modular Monolith, Serverless).

CampPulse is a **modular monolith with microservice boundaries**: one deployable unit for the hackathon MVP, structured internally as if it were already a distributed system so services can split post-hackathon without a rewrite.

> *See §1.1 Architecture Philosophy — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*

**Guiding principles**

- **Build piece by piece** — each module is independently buildable, testable, and verifiable.
- **Fail fast** — unproven choices have explicit substitution points (Mapbox, congestion thresholds, polyline encoding).
- **Data owns behaviour** — business logic lives in the service that owns the data; no cross-service direct DB access.
- **Real-time is first-class** — location pings, congestion signals, route updates, and incident broadcasts shape every layer.

**Four abstraction levels**

```
Client → Gateway → Service → Domain → Data
```

| Level | Owns | Must NOT own |
|---|---|---|
| **Gateway** | Middleware, routing, rate limits, logging, JWT validation | Business logic, DB connections |
| **Service** | Routers, orchestration, event publishers/subscribers | Direct SQL, cross-service model imports |
| **Domain** | Schemas, validators, algorithms, domain rules | HTTP, Redis/DB clients |
| **Data** | PostgreSQL, PostGIS, Redis, Cloudflare R2, Mapbox client | Business logic, HTTP |

**Nine service modules:** Auth, User Management, Incident, Routing, Realtime Location, Congestion Detection, Notification, Admin, and API Gateway — each with a defined data boundary.

**Separation of concerns**

- **Client layer** — UI, local state, WebSocket connections; zero business logic.
- **API gateway** — rate limiting, auth dependencies, routing; traffic coordinator only.
- **Service layer** — domain logic; sync HTTP between services; async Redis Pub/Sub for events.
- **Shared data layer** — PostgreSQL + PostGIS (persistent) and Redis (ephemeral).
- **External integrations** — Mapbox, Cloudflare R2; abstracted behind Level 4 clients with circuit breakers.

**Build approach:** vertical slices per milestone (M0 foundation → M1 auth → M2 incidents → … → M7 demo hardening). Each milestone delivers demonstrable end-to-end capability before the next begins.

> *See §1.4 Separation of Concerns — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*  
> *See §8.1 Overview and per-level contracts — [`CampPulse_TechDoc_S8_ABSTRACTION LEVELS.md`](CampPulse_TechDoc_S8_ABSTRACTION%20LEVELS.md)*  
> *See Section 2 module boundaries — [`CampPulse_TechDoc_S2_MODULE BREAKDOWN.md`](CampPulse_TechDoc_S2_MODULE%20BREAKDOWN.md)*  
> *See milestone dependency map §9.10 — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md)*

---

### Q3. Outline how your services communicate securely.

**Authentication (JWT + refresh sessions)**

- Protected REST endpoints require `Authorization: Bearer <access_token>`.
- Access token: JWT, 15-minute expiry, payload `{ user_id, role, jti }`.
- Refresh token: opaque string, 7-day expiry, stored as hash in PostgreSQL + Redis.
- Role hierarchy: `guest < resident < driver < admin`; higher roles satisfy lower requirements.
- Logout blacklists the access token JTI in Redis (TTL matches token expiry).

> *See §5.3 Authentication — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See role hierarchy — [`packages/constants/src/roles.ts`](../packages/constants/src/roles.ts)*  
> *See M1 deliverables — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.3*

**Gateway middleware (M1 — Option B)**

The gateway runs **Logging + RateLimit** middleware only. There is no blocking `AuthMiddleware`; JWT is decoded inline in the rate limiter and in route dependencies (`get_current_user`, `require_role`, `optional_user`).

> *Aligns with Level 1 gateway contract — [`CampPulse_TechDoc_S8_ABSTRACTION LEVELS.md`](CampPulse_TechDoc_S8_ABSTRACTION%20LEVELS.md) §8.2*

**Rate limiting**

- Redis-backed sliding-window counter per user or IP.
- All responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Role`.
- Exceeded limits return `429 Too Many Requests` with `Retry-After`.

> *See §5.13 Rate Limiting Headers, §3.4.3 Rate Limiting — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md), [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

**WebSocket security**

- Authenticated connections: token validated on handshake; invalid token → connection rejected.
- Guest connections: accepted immediately; read-only stream (no ping ingestion).
- Heartbeat: client `ping` every 30 s; server `pong`.

> *See §5.10 WebSocket API — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

**Geofence enforcement**

- Camp boundary polygon stored in `camp_zones` (`zone_type = 'boundary'`).
- Location pings outside the boundary are silently dropped.
- Client-side boundary check runs before ping is sent (GeoJSON in `packages/map-config`).

> *See §3.6 Data Retention and Geofence Enforcement — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *See boundary source — [`packages/map-config/src/boundary.json`](../packages/map-config/src/boundary.json)*

**Internal service events**

- Services publish domain events over Redis Pub/Sub after Postgres writes.
- Subscribers update Redis state and push WebSocket messages; handlers are idempotent.

> *See §3.4.2 Pub/Sub channels — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

**Dual database wiring (M1)**

| Access path | Used for |
|---|---|
| **SQLAlchemy `get_session()`** | Service-layer CRUD (users, auth sessions) |
| **asyncpg pool** | `/health` endpoint only |

Both are created in the FastAPI lifespan handler alongside the Redis connection.

> *See M0 health check §9.2, M1 scope §9.3 — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md)*

**Production transport**

- HTTPS for REST and GraphQL; WSS for WebSocket.
- Fly.io anycast network for geographically distributed clients.
- R2 uploads use time-limited presigned URLs; objects served from `R2_PUBLIC_BASE_URL`.

> *See §1.6 Deployment Topology — [`CampPulse_TechDoc_S1_SYSTEM OVERVIEW.md`](CampPulse_TechDoc_S1_SYSTEM%20OVERVIEW.md)*

---

## 2. Database Schema Specification

CampPulse uses **PostgreSQL + PostGIS** as the system of record and **Redis** as the system of coordination. No data lives permanently in both layers.

> *See §3.1 Philosophy — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

---

### Q1. List main database tables, entities, or collections.

#### PostgreSQL tables

| Table | Milestone | Purpose |
|---|---|---|
| **`users`** | M1 | Account records — residents, drivers, admins |
| **`auth_sessions`** | M1 | Refresh token sessions |
| **`driver_profiles`** | M6 | Driver availability and live location |
| **`incidents`** | M2 | Civic report lifecycle |
| **`incident_upvotes`** | M2 | Community signal on reports |
| **`incident_comments`** | M2 | Threaded discussion on reports |
| **`road_segments`** | M3 | Routing graph (LineString geometries) |
| **`camp_zones`** | M2 | Zone polygons + camp boundary |
| **`notification_log`** | M6 | Notification delivery audit trail |
| **`congestion_events`** | M4 | Historical congestion (graduated from Redis) |

#### Redis entities (ephemeral — not Postgres tables)

| Key pattern | Type | Purpose |
|---|---|---|
| `auth:blacklist:{jti}` | String | Revoked access tokens |
| `auth:refresh:{user_id}` | String | Refresh token lookup |
| `location:user:{user_id}` | Hash | Active user location (30 s TTL) |
| `congestion:window:{zone_id}:{window_id}` | Sorted Set | Ping count in detection window |
| `congestion:state:{zone_id}` | Hash | Zone congestion status |
| `route:{origin_hash}:{destination_hash}` | String | Cached route polyline |
| `ratelimit:{user_id_or_ip}:{window_start}` | String | Rate limit counter |

#### External object store (Cloudflare R2)

Incident photos are **not** stored in PostgreSQL. The `incidents.photo_url` column holds the public R2 URL after upload.

> *See §3.2 PostgreSQL Schema, §3.4 Redis Data Architecture — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *See M1/M2 table deliverables — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.3, §9.4*

---

### Q2. Describe key field data types (e.g. UUID keys, indexes) and relationship constraints (1:many, many:many).

#### Extensions and enumerations

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- first in 002_users_auth migration
CREATE EXTENSION IF NOT EXISTS postgis;        -- M0 init.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- text search
```

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

> *See §3.2.1–§3.2.2 — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *M0 PostGIS bootstrap — [`infra/postgres/init.sql`](../infra/postgres/init.sql)*

#### Key fields — `users` (M1)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `email` | VARCHAR(255) UNIQUE | nullable for guest flows |
| `password_hash` | VARCHAR(255) | bcrypt |
| `role` | `user_role` NOT NULL | default `resident` |
| `kyc_status` | `kyc_status` NOT NULL | default `pending` |
| `camp_id`, `zone` | VARCHAR | Redemption City resident metadata |

Indexes: `idx_users_role`, `idx_users_zone`, `idx_users_kyc`.

#### Key fields — `auth_sessions` (M1)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `users(id)` ON DELETE CASCADE | |
| `refresh_token_hash` | VARCHAR(255) NOT NULL | |
| `expires_at` | TIMESTAMPTZ | 7-day lifetime |
| `revoked` | BOOLEAN | default FALSE |

Partial index: `idx_sessions_active ON (user_id, revoked) WHERE revoked = FALSE`.

#### Key fields — geospatial tables (M2–M6)

| Table | Spatial column | Type |
|---|---|---|
| `incidents` | `location` | `GEOMETRY(Point, 4326) NOT NULL` |
| `driver_profiles` | `current_location` | `GEOMETRY(Point, 4326)` |
| `road_segments` | `geom` | `GEOMETRY(LineString, 4326) NOT NULL` |
| `camp_zones` | `boundary` | `GEOMETRY(Polygon, 4326) NOT NULL` |

GIST indexes on all spatial columns for O(log N) proximity and point-in-polygon queries.

> *See §3.2.3–§3.2.12 — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

#### Relationship constraints

```
users ──1:1── driver_profiles          (UNIQUE user_id)
users ──1:N── auth_sessions
users ──1:N── incidents                (as reporter_id)
users ──1:N── incidents                (as assigned_to)
users ──1:N── incident_upvotes, incident_comments

incidents ──self-ref 1:N── incidents   (parent_incident_id — duplicate linking)
incidents ──1:N── incident_upvotes
incidents ──1:N── incident_comments

incident_upvotes ──N:1── incidents, users   UNIQUE(incident_id, user_id)
```

Foreign key behaviours:

- `ON DELETE CASCADE` — sessions, upvotes, comments when parent removed.
- `ON DELETE SET NULL` — `incidents.reporter_id` when reporter account deleted.

> *See table definitions §3.2 — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

#### Additional indexes

| Index | Table | Purpose |
|---|---|---|
| `idx_incident_active` | `incidents` | Active incidents by `(type, zone, status)` |
| `idx_incident_department` | `incidents` | Department dashboard queue |
| `idx_driver_available` | `driver_profiles` | Partial index on available drivers |
| `idx_segment_restricted` | `road_segments` | Active road restrictions |

> *See §3.2 index definitions — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*

---

### Q3. Explain how transaction consistency or query performance is guaranteed.

#### Transaction consistency

**ACID (PostgreSQL)**

- Incident lifecycle writes (create, status transition, assign, resolve) run in transactions with valid-state enforcement.
- Auth session rotation on refresh invalidates the previous refresh token atomically.
- Duplicate detection and upvote increment on duplicate submission are transactional.

**Eventual consistency (Redis Pub/Sub)**

- After a Postgres write, services publish events (`incident.created`, `incident.resolved`, `congestion.confirmed`).
- Subscribers update Redis state and push WebSocket messages.
- Handlers are idempotent; self-healing on the next event if a message is missed.

**Privacy constraint**

Individual location pings are never written to PostgreSQL — Redis only, 30-second TTL.

> *See §3.5 Data Flow, §3.6 Data Retention — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *See status transition rules — [`CampPulse_TechDoc_S2_MODULE BREAKDOWN.md`](CampPulse_TechDoc_S2_MODULE%20BREAKDOWN.md)*  
> *See Pub/Sub risk mitigation §9.11 — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md)*

#### Query performance

**PostGIS spatial queries (GIST-backed)**

| Operation | Function | Use case |
|---|---|---|
| Zone lookup | `ST_Within(point, boundary)` | Auto-detect zone on incident submit |
| Duplicate detection | `ST_DWithin(location, point, 50)` | Merge reports within 50 m |
| Nearest driver | `ST_DWithin` + `ST_Distance ORDER BY` | Emergency dispatch within 2 km |
| Hotspot analytics | `ST_Collect`, `ST_Centroid`, grouped aggregates | Admin dashboard |

Complexity: O(log N) with GIST indexes on all geometry columns.

**Redis performance patterns**

- Route cache: MD5-hashed origin/destination keys, 5-minute TTL; cache hit target < 10 ms.
- Congestion windows: sorted sets with TTL aligned to detection window (90 s).
- Zone determination cache: 3-decimal grid, 5-minute TTL; target > 90% hit rate in steady state.

> *See §3.3 PostGIS Spatial Queries, §3.4 Redis Data Architecture — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *See M3 cache rubric, M4 zone cache rubric — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md) §9.5, §9.6*

#### Migration strategy

- **Tool:** Alembic; additive changes; every migration has `downgrade()`.
- **M0:** PostGIS via `infra/postgres/init.sql`; empty Alembic baseline.
- **M1:** `002_users_auth` — `uuid-ossp` first, then `users` + `auth_sessions`.
- **Run:** `pnpm db:migrate` → `docker compose exec api alembic upgrade head`.

> *See §3.7 Database Migration Strategy — [`CampPulse_TechDoc_S3_DATA ARCHITECTURE.md`](CampPulse_TechDoc_S3_DATA%20ARCHITECTURE.md)*  
> *Alembic config — [`apps/api/alembic.ini`](../apps/api/alembic.ini)*

---

## 3. API Routing Contracts

All REST endpoints are prefixed `/api/v1/`. Versioning, envelopes, and error codes are consistent from day one.

> *See §5.1 Design Principles, §5.2 Base URL — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

**Base URLs**

```
Production REST:   https://api.camppulse.ng/api/v1
Development REST:  http://localhost:8000/api/v1
WebSocket:         wss://api.camppulse.ng/ws
GraphQL:           https://api.camppulse.ng/graphql
Health:            http://localhost:8000/health
```

---

### Q1. Outline crucial REST endpoints (e.g. POST /api/v1/payments, GET /api/v1/projects) with request body layouts.

#### M1 — Auth & users *(current milestone)*

**POST `/api/v1/auth/register`** — no auth

```json
{
  "email": "user@example.com",
  "password": "min_8_chars",
  "full_name": "Adaeze Okonkwo",
  "phone": "+2348012345678",
  "role": "resident",
  "camp_id": "RC-2024-00142",
  "zone": "Zone A"
}
```

**POST `/api/v1/auth/login`** — no auth

```json
{ "email": "user@example.com", "password": "password" }
```

**POST `/api/v1/auth/refresh`** — no auth

```json
{ "refresh_token": "opaque_string" }
```

**POST `/api/v1/auth/logout`** — Resident+ — empty body → `204`

**GET `/api/v1/users/me`** — Resident+ — no body

**GET `/api/v1/users/_rbac-check`** — Admin, dev only (`ENVIRONMENT=development`)

> *See §5.6–§5.7 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *See M1 checkpoint §9.3 — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md)*

#### M2 — Incidents

| Method | Route | Auth | Request |
|---|---|---|---|
| POST | `/incidents` | None | `multipart/form-data`: `type`, `lat`, `lon`, `description?`, `severity?`, `photo?` |
| GET | `/incidents/:id` | None | — |
| GET | `/incidents/nearby` | None | Query: `lat`, `lon`, `radius_metres`, `page`, `page_size` |
| GET | `/incidents/zone/:zone` | Resident+ | Query: `status`, `type`, `page`, `page_size` |
| POST | `/incidents/:id/upvote` | Resident+ | — |
| POST | `/incidents/:id/comments` | Resident+ | `{ "body": "..." }` |
| PATCH | `/incidents/:id/status` | Admin | `{ "status": "in_progress", "note": "Team dispatched" }` |
| PATCH | `/incidents/:id/assign` | Admin | `{ "assigned_to": "uuid", "department": "infrastructure" }` |

> *See §5.8 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

#### M3 — Routing

**POST `/api/v1/routes/calculate`** — no auth

```json
{
  "origin": { "lat": 6.9271, "lon": 3.3958 },
  "destination": { "lat": 6.9310, "lon": 3.4001 },
  "mode": "walking"
}
```

| Method | Route | Auth |
|---|---|---|
| POST | `/routes/reroute` | None |
| GET | `/routes/segments/restricted` | Resident+ |
| PATCH | `/routes/segments/:id/restrict` | Admin |
| PATCH | `/routes/segments/:id/clear` | Admin |

> *See §5.9 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

#### M4 — WebSocket (non-REST but primary real-time contract)

```
wss://api.camppulse.ng/ws/location?token={access_token}   # authenticated
wss://api.camppulse.ng/ws/location/guest                  # read-only guest
```

Client message example:

```json
{
  "type": "location_ping",
  "payload": { "lat": 6.9271, "lon": 3.3958, "accuracy": 10.5, "timestamp": 1716912000 }
}
```

> *See §5.10 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

#### M5 — GraphQL (admin reads/mutations)

`POST /graphql` — Admin auth — queries: `dashboardSummary`, `incidents(filter)`, `incidentHotspots`, `equityMetrics`; mutations: `updateIncidentStatus`, `bulkUpdateIncidentStatus`, `sendZoneBroadcast`.

> *See §5.11 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

#### M6 — Users & dispatch

| Method | Route | Auth | Request |
|---|---|---|---|
| GET | `/users/drivers/available` | Resident+ | Query: `lat`, `lon`, `radius_metres` |
| PATCH | `/users/:id/role` | Admin | `{ "role": "driver" }` |
| PATCH | `/users/:id/kyc` | Admin | `{ "kyc_status": "verified" }` |

> *See §5.7 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

---

### Q2. Specify response payloads, error codes, and request methods.

#### Standard success envelope

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

- `meta.request_id` from logging middleware (`core/responses.py` → `success_response()`).
- Paginated lists add `meta.pagination` (`page`, `page_size`, `total`, `total_pages`, `has_next`, `has_prev`).

> *See §5.4 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

#### Example response payloads

**Register / login (`201` / `200`)**

```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "role": "resident", "kyc_status": "pending" },
    "tokens": { "access_token": "eyJ...", "refresh_token": "opaque", "expires_in": 900 }
  }
}
```

**Refresh (`200`)** — flat tokens under `data` (no nested `tokens` object):

```json
{
  "success": true,
  "data": { "access_token": "eyJ...", "refresh_token": "new_opaque", "expires_in": 900 }
}
```

**Incident created (`201`)**

```json
{
  "success": true,
  "data": {
    "incident_id": "uuid",
    "is_duplicate": false,
    "status": "submitted",
    "department": "infrastructure",
    "photo_url": "https://uploads.camppulse.ng/incidents/uuid/photo.jpg"
  }
}
```

**Route calculated (`200`)**

```json
{
  "success": true,
  "data": {
    "encoded_polyline": "abcdefgh...",
    "distance_metres": 820,
    "eta_seconds": 600,
    "restricted_segments_avoided": 1,
    "cached": false
  }
}
```

#### Error envelope

```json
{
  "success": false,
  "error": {
    "code": "INCIDENT_NOT_FOUND",
    "message": "No incident found with the provided ID.",
    "field": null
  },
  "meta": { "timestamp": 1716912000, "request_id": "uuid" }
}
```

Validation errors add `error.fields[]` with per-field messages.

#### HTTP status codes

| Code | Usage |
|---|---|
| 200 | Successful GET, PATCH |
| 201 | Successful POST — resource created |
| 204 | Successful DELETE or logout |
| 400 | Validation error |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, duplicate upvote) |
| 422 | Business rule failure (geofence, closed incident) |
| 429 | Rate limit exceeded |
| 503 | Upstream unavailable (circuit breaker open) |

> *See §5.4–§5.5 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

#### Error code registry (selected)

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Schema failure |
| `INVALID_CREDENTIALS` | 401 | Login mismatch |
| `INVALID_TOKEN` | 401 | JWT expired or blacklisted |
| `INSUFFICIENT_ROLE` | 403 | RBAC failure |
| `EMAIL_TAKEN` | 409 | Duplicate registration |
| `LOCATION_OUTSIDE_BOUNDARY` | 422 | Outside camp geofence |
| `NO_ROUTE_FOUND` | 422 | Routing failure |
| `RATE_LIMITED` | 429 | Burst exceeded |
| `UPSTREAM_UNAVAILABLE` | 503 | Mapbox / R2 / ORS circuit open |

> *See §5.12 Error Code Registry — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

#### Rate limit response headers

```
X-RateLimit-Limit:     300
X-RateLimit-Remaining: 247
X-RateLimit-Reset:     1716912060
X-RateLimit-Role:      resident
```

On exceed: `429` + `Retry-After: 23`

> *See §5.13 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

---

### Q3. Describe request authentication (JWT, Session tokens, OAuth, API Keys).

CampPulse uses **JWT access tokens + opaque refresh sessions**. OAuth and API keys are not in scope for the MVP.

#### Token model

| Token | Type | Lifetime | Storage |
|---|---|---|---|
| **Access token** | JWT (`HS256`) | 15 minutes | Client memory / secure storage |
| **Refresh token** | Opaque string | 7 days | Hash in `auth_sessions` (Postgres) + Redis |

**JWT payload:** `{ user_id, role, jti }` — `jti` used for logout blacklist.

**Guest access:** no token required on public endpoints (incident submit, route calculate, guest WebSocket); reduced payloads where applicable.

> *See §5.3 Authentication — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*  
> *Env: `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` — [`.env.example`](../.env.example)*

#### Request header

```
Authorization: Bearer <access_token>
```

#### Role hierarchy and enforcement

```
guest < resident < driver < admin
```

| Dependency | Behaviour |
|---|---|
| `get_current_user` | Valid, non-blacklisted JWT required; returns user context |
| `require_role(role)` | Minimum role enforced; `403 INSUFFICIENT_ROLE` if too low |
| `optional_user` | Returns `None` when unauthenticated without rejecting (M2 guest endpoints) |

Python mirror: `core/roles.py`; TypeScript mirror: [`packages/constants/src/roles.ts`](../packages/constants/src/roles.ts).

**Dev RBAC smoke route:** `GET /api/v1/users/_rbac-check` with `require_role("admin")`, gated by `ENVIRONMENT=development`.

> *See M1 success rubric §9.3 — [`CampPulse_TechDoc_S9_MILESTONES AND CHECKPOINTS.md`](CampPulse_TechDoc_S9_MILESTONES%20AND%20CHECKPOINTS.md)*

#### Session lifecycle

1. **Register / login** → access + refresh token pair returned.
2. **Protected request** → gateway rate limiter decodes JWT; route dependency validates role.
3. **Refresh** → old refresh token invalidated; new pair issued.
4. **Logout** → JTI blacklisted in Redis; refresh session revoked.

**Deferred:** `GET /auth/validate`

#### WebSocket authentication

- Authenticated: `?token={access_token}` on handshake; rejected if invalid.
- Guest: `/ws/location/guest` — no token; read-only (cannot send `location_ping`).

> *See §5.10 WebSocket API — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

#### GraphQL authentication

All admin GraphQL operations require a valid Admin JWT in the `Authorization` header.

> *See §5.11 — [`CampPulse_TechDoc_S5_API DESIGN.md`](CampPulse_TechDoc_S5_API%20DESIGN.md)*

---

*CampPulse Technical Documentation — Milestone Evaluation Answers v1.1 (Cloudflare R2, question-mapped)*
