# CampPulse — Technical Documentation
**Section 2: Module Breakdown**

---

# Section 2: Module Breakdown

Each module is described by its responsibility, its owned data, its exposed interfaces, its dependencies, and its internal structure. No module reaches outside its boundary. All cross-module communication is explicit.

---

## 2.1 Auth Service

### Responsibility
Handles all authentication concerns — token issuance, validation, refresh, and revocation. This service is the single source of truth for whether a request is authenticated and who is making it. It does not handle what an authenticated user is allowed to do — that is the responsibility of each downstream service enforcing its own access rules.

### Owned Data
```
auth_sessions (PostgreSQL)
- id: UUID (PK)
- user_id: UUID (FK → users.id)
- refresh_token_hash: VARCHAR
- issued_at: TIMESTAMPTZ
- expires_at: TIMESTAMPTZ
- revoked: BOOLEAN
- device_fingerprint: VARCHAR
- created_at: TIMESTAMPTZ
```

Redis keys:
```
auth:blacklist:{jti}        → TTL = token expiry (revoked access tokens)
auth:refresh:{user_id}      → hashed refresh token (active session lookup)
```

### Exposed Interfaces
```
POST   /auth/register         → issue tokens on new account creation
POST   /auth/login            → issue access + refresh token pair
POST   /auth/refresh          → rotate refresh token, issue new access token
POST   /auth/logout           → revoke session, blacklist access token
GET    /auth/validate         → internal-only token validation endpoint
```

### Dependencies
- User Management Service (to confirm user exists on login)
- Redis (token blacklist and active session store)

### Internal Structure
```
api/services/auth/
├── router.py          # Route definitions
├── service.py         # Business logic — token lifecycle
├── schemas.py         # Pydantic request/response models
├── security.py        # JWT encoding/decoding, hashing utilities
├── dependencies.py    # FastAPI dependency injection — get_current_user
└── models.py          # SQLAlchemy ORM models
```

### Notes
- Access tokens: short-lived (15 minutes), signed JWT, carries user_id and role
- Refresh tokens: long-lived (7 days), stored as hash in Redis and DB
- Guest users receive no token — they access public endpoints directly
- `dependencies.py` exports `get_current_user` and `require_role(role)` — consumed by all other services via shared package

---

## 2.2 User Management Service

### Responsibility
Manages user profiles, role assignment, KYC state, and driver/resident verification. Owns the canonical user record. Auth Service confirms identity; this service defines who the user is and what role they hold within the platform.

### Owned Data
```
users (PostgreSQL)
- id: UUID (PK)
- email: VARCHAR (unique, nullable for guest accounts)
- phone: VARCHAR (nullable)
- full_name: VARCHAR
- role: ENUM ('guest', 'resident', 'driver', 'admin')
- kyc_status: ENUM ('pending', 'verified', 'rejected')
- camp_id: VARCHAR (nullable — Redemption City resident ID)
- zone: VARCHAR (nullable — residential zone within camp)
- is_active: BOOLEAN
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

driver_profiles (PostgreSQL)
- id: UUID (PK)
- user_id: UUID (FK → users.id, unique)
- vehicle_type: ENUM ('tricycle', 'shuttle', 'other')
- vehicle_id: VARCHAR
- is_available: BOOLEAN
- current_location: GEOMETRY(Point, 4326)  ← PostGIS
- last_seen: TIMESTAMPTZ
```

### Exposed Interfaces
```
REST:
GET    /users/me                   → authenticated user profile
PATCH  /users/me                   → update profile
GET    /users/:id                  → admin only
PATCH  /users/:id/role             → admin only — role assignment
PATCH  /users/:id/kyc              → admin only — KYC status update
GET    /users/drivers/available    → available drivers with live location

GraphQL (admin queries):
query {
  users(role: DRIVER, kycStatus: VERIFIED, zone: "Zone A") {
    id fullName phone kycStatus driverProfile { isAvailable currentLocation }
  }
}
```

### Dependencies
- Auth Service (get_current_user dependency)
- PostGIS (driver location storage and proximity queries)

### Internal Structure
```
api/services/user/
├── router.py
├── graphql/
│   ├── schema.py      # Strawberry GraphQL schema definition
│   └── resolvers.py   # Query resolvers
├── service.py
├── schemas.py
├── models.py
└── dependencies.py
```

---

## 2.3 Incident Management Service

### Responsibility
Manages the full lifecycle of civic incident reports — creation, categorisation, department routing, status transitions, community engagement (upvotes, comments), and duplicate detection. Every confirmed incident emits an event consumed by the Routing Service to update the live road graph.

### Owned Data
```
incidents (PostgreSQL + PostGIS)
- id: UUID (PK)
- reporter_id: UUID (nullable FK → users.id)
- type: ENUM ('flooding', 'pothole', 'streetlight', 'water_leak',
              'trash', 'security', 'congestion', 'other')
- description: TEXT
- photo_url: VARCHAR (GCP Cloud Storage URL)
- location: GEOMETRY(Point, 4326)       ← PostGIS
- address_label: VARCHAR
- severity: ENUM ('low', 'medium', 'high', 'critical')
- status: ENUM ('submitted', 'assigned', 'in_progress', 'resolved', 'closed')
- department: ENUM ('infrastructure', 'sanitation', 'security',
                    'utilities', 'emergency')
- assigned_to: UUID (nullable FK → users.id)
- upvote_count: INTEGER DEFAULT 0
- is_duplicate: BOOLEAN DEFAULT FALSE
- parent_incident_id: UUID (nullable FK → incidents.id)
- resolved_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

incident_upvotes (PostgreSQL)
- id: UUID (PK)
- incident_id: UUID (FK → incidents.id)
- user_id: UUID (FK → users.id)
- created_at: TIMESTAMPTZ
- UNIQUE(incident_id, user_id)

incident_comments (PostgreSQL)
- id: UUID (PK)
- incident_id: UUID (FK → incidents.id)
- user_id: UUID (FK → users.id)
- body: TEXT
- created_at: TIMESTAMPTZ
```

### Exposed Interfaces
```
REST:
POST   /incidents                        → submit new incident
GET    /incidents/:id                    → get single incident with status
PATCH  /incidents/:id/status             → admin — update status
PATCH  /incidents/:id/assign             → admin — assign to department/user
POST   /incidents/:id/upvote             → resident — upvote incident
POST   /incidents/:id/comments           → resident — add comment
GET    /incidents/nearby                 → incidents within radius (lat, lon, radius)
GET    /incidents/zone/:zone             → all incidents in a camp zone

GraphQL (admin queries):
query {
  incidents(status: IN_PROGRESS, department: INFRASTRUCTURE,
            dateRange: { from: "2026-05-01" }) {
    id type severity location upvoteCount assignedTo { fullName }
    comments { body createdAt user { fullName } }
  }
}
```

### Events Emitted (Redis Pub/Sub)
```
channel: incident.created     → payload: { incident_id, type, location, severity }
channel: incident.resolved    → payload: { incident_id, location }
channel: incident.status      → payload: { incident_id, status, updated_at }
```

### Dependencies
- Auth Service
- PostGIS (location storage and proximity queries)
- GCP Cloud Storage (photo upload URL generation)
- Redis (event emission)
- Notification Service (status change triggers)

### Duplicate Detection Logic
On every new incident submission, the service queries for existing open incidents of the same type within a 50-metre radius. If a match exists, the new report increments the parent incident's upvote count and is flagged as a duplicate, linking to the parent. This keeps the incident map clean while preserving community signal strength.

```python
# Proximity duplicate check — PostGIS query
SELECT id FROM incidents
WHERE status NOT IN ('resolved', 'closed')
  AND type = :incident_type
  AND ST_DWithin(
    location::geography,
    ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
    50  -- metres
  )
LIMIT 1;
```

### Internal Structure
```
api/services/incident/
├── router.py
├── graphql/
│   ├── schema.py
│   └── resolvers.py
├── service.py
├── duplicate.py       # Duplicate detection logic
├── routing.py         # Department auto-routing logic
├── schemas.py
├── models.py
└── storage.py         # GCP upload URL generation
```

---

## 2.4 Real-Time Location Service

### Responsibility
Manages all bidirectional WebSocket connections for live location data. Ingests location pings from residents, drivers, and guests. Streams route updates and zone status changes back to connected clients. Feeds raw ping data into the Congestion Detection Engine via Redis. Maintains active session registry in Redis.

### Owned Data (Redis only — all ephemeral)
```
location:user:{user_id}           → { lat, lon, zone, timestamp } TTL: 30s
location:active_sessions          → SET of active user_ids
ws:session:{connection_id}        → { user_id, role, connected_at } TTL: session
```

### WebSocket Contract
```
Connection:
WS /ws/location?token={jwt}       → authenticated users
WS /ws/location/guest             → anonymous guests (read-only stream)

Client → Server (ping):
{
  "type": "location_ping",
  "payload": {
    "lat": 6.9271,
    "lon": 3.3958,
    "accuracy": 10.5,        -- metres
    "speed": 2.1,            -- m/s, nullable
    "heading": 145.0,        -- degrees, nullable
    "timestamp": 1716912000
  }
}

Server → Client (route update):
{
  "type": "route_update",
  "payload": {
    "reason": "incident | congestion | clearing",
    "affected_segment": "segment_id",
    "new_route": "encoded_polyline_string",
    "eta_seconds": 240
  }
}

Server → Client (zone alert):
{
  "type": "zone_alert",
  "payload": {
    "zone": "Zone A",
    "status": "congested | clearing | clear",
    "severity": "low | medium | high",
    "suggested_alternatives": ["Zone B via Road 3", "Zone C via Main Gate"]
  }
}

Server → Client (incident nearby):
{
  "type": "incident_nearby",
  "payload": {
    "incident_id": "uuid",
    "type": "flooding",
    "distance_metres": 120,
    "severity": "high"
  }
}
```

### Ping Processing Pipeline
```
Client ping received
        ↓
Validate payload (Pydantic)
        ↓
Update location:user:{user_id} in Redis (TTL 30s)
        ↓
Determine zone from coordinates (PostGIS point-in-polygon)
        ↓
Publish to Redis channel: location.ping
        ↓
Congestion Detection Engine consumes asynchronously
```

### Dependencies
- Auth Service (token validation on connection)
- Redis (session registry, location store, pub/sub)
- Congestion Detection Engine (consumes published pings)
- Routing Service (produces route_update events for broadcast)
- PostGIS (zone determination)

### Internal Structure
```
api/services/realtime/
├── manager.py         # WebSocket connection manager — registry, broadcast
├── handler.py         # Incoming message routing and ping processing
├── broadcaster.py     # Outbound message construction and delivery
├── schemas.py         # WebSocket message schemas
└── subscriber.py      # Redis Pub/Sub listener — consumes route + zone events
```

---

## 2.5 Congestion Detection Engine

### Responsibility
The intelligence core of CampPulse's peak-period mobility capability. Consumes location pings from Redis, aggregates them per zone within sliding time windows, evaluates congestion thresholds, and manages the two-window detection-revalidation cycle. Publishes congestion state changes consumed by the Routing Service and Real-Time Location Service.

### Owned Data (Redis only — all ephemeral)
```
congestion:window:{zone_id}:{window_id}   → SORTED SET of pings, TTL: detection window
congestion:state:{zone_id}                → { status, severity, flagged_at } TTL: revalidation window
congestion:hotspots                       → HASH of pre-loaded venue schedules
```

### Algorithm: Two-Window Detection

**Detection Window (W1)**
- Duration: 90 seconds (configurable via constants package)
- On each ping received for a zone, increment the ping count in the zone's sorted set for the current window
- When window closes, evaluate: `ping_count >= CONGESTION_THRESHOLD`
- Default threshold: 50 pings per zone per window (configurable)
- If threshold crossed → zone flagged as `PENDING_VALIDATION`, publish to `congestion.flagged`

**Revalidation Window (W2)**
- Triggered immediately when a zone is flagged
- Duration: 60 seconds (configurable)
- Re-aggregates pings during this window
- If ping count remains above threshold → zone confirmed as `CONGESTED`, severity scored
- If ping count drops below threshold → flag cleared, zone status remains `CLEAR`
- Publish result to `congestion.confirmed` or `congestion.cleared`

```
Complexity Analysis:
- Ping ingestion: O(log N) per ping — Redis ZADD into sorted set
- Window evaluation: O(1) — Redis ZCARD on current window key
- Revalidation: O(log N) — same as ingestion
- Zone state lookup: O(1) — Redis HGET
- Space: O(W × Z) where W = pings per window, Z = active zones
```

**Severity Scoring**
```python
def score_severity(ping_count: int, threshold: int) -> str:
    ratio = ping_count / threshold
    if ratio >= 3.0:
        return "critical"
    elif ratio >= 2.0:
        return "high"
    elif ratio >= 1.5:
        return "medium"
    else:
        return "low"
```

**Predictive Detection (Baked-in Hotspots)**
Known high-traffic venues and their typical program schedules are pre-loaded into Redis as a hotspot registry. A background scheduler checks the registry every 5 minutes against the current time. When a program end-time is within 10 minutes, the system pre-emptively raises the congestion state of the associated zone to `ANTICIPATED`, triggering proactive rerouting before physical congestion manifests.

```python
# Hotspot schema (loaded from constants/hotspots.json)
{
  "venue_id": "main_auditorium",
  "zone": "Zone A",
  "location": { "lat": 6.9271, "lon": 3.3958 },
  "programs": [
    { "name": "Sunday Service", "end_time": "11:30", "days": ["sunday"] }
  ],
  "anticipation_window_minutes": 10
}
```

### Events Emitted (Redis Pub/Sub)
```
channel: congestion.flagged      → { zone_id, ping_count, window_id }
channel: congestion.confirmed    → { zone_id, severity, flagged_at }
channel: congestion.cleared      → { zone_id, cleared_at }
channel: congestion.anticipated  → { zone_id, venue_id, program_name, eta_minutes }
```

### Dependencies
- Redis (window storage, state management, pub/sub)
- Real-Time Location Service (consumes location.ping)
- Routing Service (consumes congestion events to update road graph)

### Internal Structure
```
api/services/congestion/
├── engine.py          # Main detection loop — window management
├── windows.py         # Detection and revalidation window logic
├── severity.py        # Severity scoring
├── hotspots.py        # Predictive detection — schedule watcher
├── publisher.py       # Redis Pub/Sub event emission
└── subscriber.py      # Consumes location.ping from Redis
```

---

## 2.6 Routing Service

### Responsibility
Calculates routes between two points within Redemption City, applies dynamic road restrictions based on active incidents and congestion state, encodes routes as compressed polylines for efficient transmission, and manages the cached route store for offline fallback. Listens to incident and congestion events to maintain a live road graph state.

### Owned Data
```
road_segments (PostgreSQL + PostGIS)
- id: UUID (PK)
- name: VARCHAR
- geom: GEOMETRY(LineString, 4326)    ← PostGIS
- is_restricted: BOOLEAN DEFAULT FALSE
- restriction_reason: VARCHAR (nullable)
- restricted_since: TIMESTAMPTZ (nullable)
- zone: VARCHAR
- speed_limit_kmh: INTEGER

route_cache (Redis)
- route:{origin_hash}:{destination_hash}  → encoded_polyline TTL: 5 minutes
- route:offline:{user_id}                 → SET of frequently requested route keys
```

### Exposed Interfaces
```
REST:
POST   /routes/calculate          → calculate route, returns encoded polyline
POST   /routes/reroute            → recalculate around new restriction
GET    /routes/segments/restricted → all currently restricted segments
PATCH  /routes/segments/:id/restrict   → admin — manually restrict a segment
PATCH  /routes/segments/:id/clear      → admin — clear restriction

WebSocket (consumed via Real-Time Location Service):
→ Publishes route_update events when road graph changes affect active navigating users
```

### Route Calculation Flow
```
Request: { origin: {lat, lon}, destination: {lat, lon}, mode: 'walking|tricycle' }
        ↓
Check route cache (Redis) → cache hit → return cached polyline immediately
        ↓ (cache miss)
Query PostGIS for road graph — exclude restricted segments
        ↓
Call Mapbox Directions API (or OpenRouteService) with waypoints
avoiding restricted segment midpoints
        ↓
Receive route geometry
        ↓
Encode geometry as polyline (Google Polyline Encoding Algorithm — Phase 1)
        ↓
Store in Redis cache (TTL 5 minutes)
        ↓
Return { encoded_polyline, distance_metres, eta_seconds, restricted_segments_avoided }
```

### Polyline Compression
Google Polyline Encoding Algorithm is the Phase 1 standard. It encodes a sequence of (lat, lon) coordinate pairs into a single ASCII string, reducing a typical route payload from ~4KB (raw coordinate array) to ~200–400 bytes — a 90%+ reduction in payload size.

```
Encoding steps per coordinate value:
1. Multiply by 1e5, round to integer
2. Left-shift by 1
3. If negative, invert all bits
4. Split into 5-bit chunks, right to left
5. OR each chunk with 0x20 if not the last chunk
6. Add 63 to each chunk
7. Convert to ASCII character

Complexity: O(N) where N = number of coordinate points in route
Space savings: ~90% reduction vs raw JSON coordinate array
```

If performance benchmarking reveals bottlenecks at scale, the encoding standard is a substitution point — Flexpolyline (HERE Maps) or custom binary encoding can replace Google's algorithm without changing the interface contract.

### Road Graph Update on Events
```python
# Subscribes to Redis channels:
# incident.created  → restrict affected segment
# incident.resolved → clear segment restriction
# congestion.confirmed → soft-restrict congested zone roads (deprioritise in routing)
# congestion.cleared   → restore zone roads

async def handle_incident_created(event: dict):
    segment = await find_nearest_segment(event["location"])
    if segment:
        await restrict_segment(segment.id, reason=event["type"])
        await invalidate_route_cache_for_segment(segment.id)
        await notify_active_navigators(segment.id)
```

### Dependencies
- PostGIS (road graph storage and spatial queries)
- Redis (route cache, event subscription)
- Mapbox / OpenRouteService (external routing engine)
- Real-Time Location Service (publishes route_update events)
- Incident Management Service (consumes incident events)
- Congestion Detection Engine (consumes congestion events)

### Internal Structure
```
api/services/routing/
├── router.py          # HTTP route definitions
├── service.py         # Route calculation orchestration
├── graph.py           # Road graph management — restrictions, updates
├── polyline.py        # Polyline encoding/decoding utilities
├── cache.py           # Redis cache management
├── subscriber.py      # Event consumption — incident + congestion channels
├── mapbox.py          # Mapbox API client (abstracted — swappable)
├── schemas.py
└── models.py
```

---

## 2.7 Notification Service

### Responsibility
Delivers push notifications, in-app alerts, and zone-wide broadcasts to relevant users. Stateless — it does not own persistent notification data beyond a delivery log. It listens to events from Incident Management and Congestion Detection and translates them into user-facing messages delivered through the appropriate channel.

### Owned Data
```
notification_log (PostgreSQL)
- id: UUID (PK)
- user_id: UUID (nullable — null for zone broadcasts)
- type: ENUM ('push', 'in_app', 'zone_broadcast')
- title: VARCHAR
- body: TEXT
- channel: VARCHAR (incident.status | congestion.confirmed | etc.)
- delivered: BOOLEAN
- created_at: TIMESTAMPTZ
```

### Exposed Interfaces
```
REST (internal only — not exposed via API Gateway):
POST   /notify/user          → send to specific user
POST   /notify/zone          → broadcast to all users in a zone
POST   /notify/role          → broadcast to all users of a role
```

### Event Subscriptions
```
incident.status      → notify reporter of status change
incident.created     → notify admin of new high-severity incident
congestion.confirmed → zone broadcast to affected users
congestion.cleared   → zone broadcast — route restored
congestion.anticipated → proactive alert to users in affected zone
```

### Internal Structure
```
api/services/notification/
├── service.py         # Notification orchestration
├── templates.py       # Message templates per event type
├── channels/
│   ├── push.py        # Push notification delivery (Expo Push API for React Native)
│   └── inapp.py       # In-app alert delivery via WebSocket
├── subscriber.py      # Redis event consumption
└── models.py
```

---

## 2.8 Admin Service

### Responsibility
Provides the admin dashboard's backend — aggregated views, analytics, bulk operations, and management actions. Does not duplicate business logic from other services. Instead it orchestrates calls to other services' APIs and exposes composite GraphQL queries optimised for dashboard consumption.

### Exposed Interfaces
```
GraphQL:
query {
  dashboardSummary {
    openIncidents { total byDepartment { department count } }
    activeCongestionZones { zone severity flaggedAt }
    responseMetrics { avgResolutionHours hotspots { zone count } }
    activeDrivers { total availableNow }
  }
  incidentHotspots(dateRange: { from: "2026-05-01" }, zone: "Zone A") {
    location incidentCount topTypes avgResolutionHours
  }
  equityMetrics {
    zoneAttentionScores { zone reportCount resolvedCount avgResolutionHours }
  }
}

mutation {
  bulkUpdateIncidentStatus(ids: [uuid], status: IN_PROGRESS) { updatedCount }
  assignIncident(id: uuid, userId: uuid, department: INFRASTRUCTURE) { incident { id status } }
}

REST:
GET    /admin/map/live          → all open incidents + active congestion zones for map render
GET    /admin/drivers/live      → all active driver locations
POST   /admin/segments/restrict → restrict road segment
POST   /admin/broadcast         → zone-wide public notification
```

### Dependencies
- All services via internal HTTP + GraphQL federation
- PostGIS (hotspot and equity metric spatial aggregations)
- Redis (live congestion state reads)

### Internal Structure
```
api/services/admin/
├── router.py
├── graphql/
│   ├── schema.py
│   └── resolvers.py   # Orchestrates calls to other services
├── analytics.py       # Hotspot, equity, and response metric calculations
├── map.py             # Live map data aggregation
└── schemas.py
```

---

## 2.9 API Gateway

### Responsibility
Single entry point for all external client traffic. Validates JWT tokens, enforces rate limits, routes requests to downstream services, and rejects unauthenticated requests to protected endpoints. Contains zero business logic.

### Configuration
```
Rate limits:
- Guest (unauthenticated): 60 requests/minute
- Resident/Driver: 300 requests/minute
- Admin: 600 requests/minute
- WebSocket connections: 1 per user session

Route table:
/auth/*          → Auth Service
/users/*         → User Management Service
/incidents/*     → Incident Management Service
/routes/*        → Routing Service
/ws/*            → Real-Time Location Service
/admin/*         → Admin Service (admin role required)
/notify/*        → Notification Service (internal only — blocked at gateway)
```

### Internal Structure
```
api/gateway/
├── main.py            # FastAPI app entry point — mounts all service routers
├── middleware/
│   ├── auth.py        # JWT validation middleware
│   ├── rate_limit.py  # Redis-backed rate limiting
│   └── logging.py     # Request/response logging
└── config.py          # Environment config, service URLs
```

---

## 2.10 Inter-Service Communication Summary

| From | To | Protocol | Trigger |
|---|---|---|---|
| API Gateway | All services | Internal HTTP | Every inbound request |
| Incident Svc | Redis | Pub/Sub publish | Incident created/resolved/updated |
| Routing Svc | Redis | Pub/Sub subscribe | Consumes incident + congestion events |
| Location Svc | Redis | Pub/Sub publish | Every location ping |
| Congestion Engine | Redis | Pub/Sub subscribe/publish | Consumes pings, publishes zone state |
| Notification Svc | Redis | Pub/Sub subscribe | Consumes all relevant events |
| Admin Svc | All services | Internal HTTP + GraphQL | Dashboard queries |
| Auth Svc | All services | Shared dependency injection | Token validation on every request |

---

*Next: Section 3 — Data Architecture*
