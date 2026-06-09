# CampPulse — Technical Documentation
**Section 3: Data Architecture**

---

# Section 3: Data Architecture

## 3.1 Philosophy

CampPulse operates across two data layers with fundamentally different characteristics:

**PostgreSQL + PostGIS** — persistent, relational, geospatially aware. Owns everything that must survive a restart, needs ACID guarantees, or requires spatial querying. This is the system of record.

**Redis (Upstash)** — ephemeral, in-memory, pub/sub capable. Owns everything that must be fast, temporary, or event-driven. This is the system of coordination.

No data lives in both layers permanently. Redis holds working state — aggregation windows, session data, route cache, congestion flags. When that state matures into a durable record (a resolved incident, a closed session, a confirmed congestion event log), it graduates to PostgreSQL. Redis is never treated as a database. PostgreSQL is never used for real-time coordination.

---

## 3.2 PostgreSQL Schema

### 3.2.1 Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS postgis;        -- Geospatial types and functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- Trigram indexing for text search
```

### 3.2.2 Enumerations
```sql
CREATE TYPE user_role AS ENUM ('guest', 'resident', 'driver', 'admin');
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE vehicle_type AS ENUM ('tricycle', 'shuttle', 'other');
CREATE TYPE incident_type AS ENUM (
  'flooding', 'pothole', 'streetlight', 'water_leak',
  'trash', 'security', 'congestion', 'other'
);
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM (
  'submitted', 'assigned', 'in_progress', 'resolved', 'closed'
);
CREATE TYPE department AS ENUM (
  'infrastructure', 'sanitation', 'security', 'utilities', 'emergency'
);
CREATE TYPE notification_type AS ENUM ('push', 'in_app', 'zone_broadcast');
```

### 3.2.3 Users
```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) UNIQUE,
  phone             VARCHAR(20),
  full_name         VARCHAR(255) NOT NULL,
  password_hash     VARCHAR(255),
  role              user_role NOT NULL DEFAULT 'resident',
  kyc_status        kyc_status NOT NULL DEFAULT 'pending',
  camp_id           VARCHAR(100),
  zone              VARCHAR(100),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_zone ON users(zone);
CREATE INDEX idx_users_kyc ON users(kyc_status);
```

### 3.2.4 Driver Profiles
```sql
CREATE TABLE driver_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type      vehicle_type NOT NULL DEFAULT 'tricycle',
  vehicle_id        VARCHAR(100),
  is_available      BOOLEAN NOT NULL DEFAULT FALSE,
  current_location  GEOMETRY(Point, 4326),
  last_seen         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for proximity queries
CREATE INDEX idx_driver_location ON driver_profiles USING GIST(current_location);
CREATE INDEX idx_driver_available ON driver_profiles(is_available)
  WHERE is_available = TRUE;
```

### 3.2.5 Auth Sessions
```sql
CREATE TABLE auth_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash    VARCHAR(255) NOT NULL,
  device_fingerprint    VARCHAR(255),
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL,
  revoked               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_sessions_active ON auth_sessions(user_id, revoked)
  WHERE revoked = FALSE;
```

### 3.2.6 Incidents
```sql
CREATE TABLE incidents (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  type                  incident_type NOT NULL,
  description           TEXT,
  photo_url             VARCHAR(500),
  location              GEOMETRY(Point, 4326) NOT NULL,
  address_label         VARCHAR(255),
  zone                  VARCHAR(100),
  severity              incident_severity NOT NULL DEFAULT 'low',
  status                incident_status NOT NULL DEFAULT 'submitted',
  department            department,
  assigned_to           UUID REFERENCES users(id) ON DELETE SET NULL,
  upvote_count          INTEGER NOT NULL DEFAULT 0,
  is_duplicate          BOOLEAN NOT NULL DEFAULT FALSE,
  parent_incident_id    UUID REFERENCES incidents(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index — proximity queries and duplicate detection
CREATE INDEX idx_incident_location ON incidents USING GIST(location);

-- Composite index — active incident queries by type and zone
CREATE INDEX idx_incident_active ON incidents(type, zone, status)
  WHERE status NOT IN ('resolved', 'closed');

-- Index for department dashboard queries
CREATE INDEX idx_incident_department ON incidents(department, status, created_at DESC);

-- Index for reporter lookup
CREATE INDEX idx_incident_reporter ON incidents(reporter_id, created_at DESC);
```

### 3.2.7 Incident Upvotes
```sql
CREATE TABLE incident_upvotes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(incident_id, user_id)
);

CREATE INDEX idx_upvotes_incident ON incident_upvotes(incident_id);
```

### 3.2.8 Incident Comments
```sql
CREATE TABLE incident_comments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id   UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_incident ON incident_comments(incident_id, created_at ASC);
```

### 3.2.9 Road Segments
```sql
CREATE TABLE road_segments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR(255),
  geom                  GEOMETRY(LineString, 4326) NOT NULL,
  zone                  VARCHAR(100),
  speed_limit_kmh       INTEGER DEFAULT 20,
  is_restricted         BOOLEAN NOT NULL DEFAULT FALSE,
  restriction_reason    VARCHAR(255),
  restricted_since      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index — routing graph queries
CREATE INDEX idx_segment_geom ON road_segments USING GIST(geom);

-- Partial index — active restrictions only
CREATE INDEX idx_segment_restricted ON road_segments(is_restricted, zone)
  WHERE is_restricted = TRUE;
```

### 3.2.10 Camp Zones
```sql
CREATE TABLE camp_zones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL UNIQUE,
  boundary      GEOMETRY(Polygon, 4326) NOT NULL,
  zone_type     VARCHAR(50),   -- residential, commercial, worship, emergency
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index — point-in-polygon zone determination
CREATE INDEX idx_zone_boundary ON camp_zones USING GIST(boundary);
```

### 3.2.11 Notification Log
```sql
CREATE TABLE notification_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  type          notification_type NOT NULL,
  title         VARCHAR(255) NOT NULL,
  body          TEXT NOT NULL,
  channel       VARCHAR(100),
  delivered     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_user ON notification_log(user_id, created_at DESC);
```

### 3.2.12 Congestion Event Log
```sql
-- Graduated from Redis once a congestion event is confirmed and resolved
CREATE TABLE congestion_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone            VARCHAR(100) NOT NULL,
  severity        VARCHAR(20) NOT NULL,
  peak_ping_count INTEGER,
  flagged_at      TIMESTAMPTZ NOT NULL,
  confirmed_at    TIMESTAMPTZ,
  cleared_at      TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (cleared_at - confirmed_at))::INTEGER
  ) STORED
);

CREATE INDEX idx_congestion_zone ON congestion_events(zone, flagged_at DESC);
```

---

## 3.3 PostGIS Spatial Queries

### Zone Determination (point-in-polygon)
```sql
-- Determine which zone a coordinate falls in
SELECT name FROM camp_zones
WHERE ST_Within(
  ST_SetSRID(ST_Point(:lon, :lat), 4326),
  boundary
)
LIMIT 1;

-- Complexity: O(log N) with GIST index — N = number of zones
```

### Incident Proximity (duplicate detection + nearby fetch)
```sql
-- Find open incidents of same type within 50 metres
SELECT id, type, status, upvote_count
FROM incidents
WHERE status NOT IN ('resolved', 'closed')
  AND type = :incident_type
  AND ST_DWithin(
    location::geography,
    ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
    50
  )
ORDER BY ST_Distance(
  location::geography,
  ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography
) ASC
LIMIT 1;

-- Complexity: O(log N) with GIST index — N = total open incidents
```

### Nearest Available Driver (emergency dispatch)
```sql
-- Find nearest available driver within 2km
SELECT
  dp.id,
  u.full_name,
  ST_Distance(
    dp.current_location::geography,
    ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography
  ) AS distance_metres
FROM driver_profiles dp
JOIN users u ON u.id = dp.user_id
WHERE dp.is_available = TRUE
  AND ST_DWithin(
    dp.current_location::geography,
    ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
    2000
  )
ORDER BY distance_metres ASC
LIMIT 5;

-- Complexity: O(log N) with GIST index — N = available drivers
```

### Road Segment Restriction (routing graph update)
```sql
-- Find road segment nearest to incident location
SELECT id, name, zone
FROM road_segments
WHERE ST_DWithin(
  geom::geography,
  ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
  30  -- within 30 metres of incident
)
ORDER BY ST_Distance(
  geom::geography,
  ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography
) ASC
LIMIT 1;
```

### Hotspot Analytics (admin dashboard)
```sql
-- Incident density per zone for hotspot map
SELECT
  zone,
  COUNT(*) AS incident_count,
  COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved_count,
  AVG(
    EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
  ) FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_hours,
  ST_AsGeoJSON(ST_Centroid(ST_Collect(location))) AS centroid
FROM incidents
WHERE created_at >= :date_from
GROUP BY zone
ORDER BY incident_count DESC;
```

---

## 3.4 Redis Data Architecture

### 3.4.1 Key Naming Convention
```
{service}:{entity}:{identifier}:{sub_key}

Examples:
auth:blacklist:{jti}
auth:refresh:{user_id}
location:user:{user_id}
location:active_sessions
congestion:window:{zone_id}:{window_id}
congestion:state:{zone_id}
route:{origin_hash}:{destination_hash}
route:offline:{user_id}
ws:session:{connection_id}
```

### 3.4.2 Data Structures Per Use Case

**Active User Location**
```
Key:    location:user:{user_id}
Type:   Hash
Fields: lat, lon, zone, accuracy, speed, heading, timestamp
TTL:    30 seconds (auto-expires if user stops pinging)

SET location:user:abc123
  lat       6.9271
  lon       3.3958
  zone      "Zone A"
  accuracy  10.5
  timestamp 1716912000
EX 30
```

**Active WebSocket Sessions**
```
Key:    location:active_sessions
Type:   Set
Value:  user_id strings
TTL:    None — managed explicitly on connect/disconnect

SADD location:active_sessions "user_id_1" "user_id_2"
SREM location:active_sessions "user_id_1"   ← on disconnect
```

**Congestion Detection Window**
```
Key:    congestion:window:{zone_id}:{window_id}
Type:   Sorted Set
Score:  Unix timestamp of ping
Member: "{user_id}:{timestamp}"
TTL:    Detection window duration (90 seconds)

ZADD congestion:window:zone_a:w_1716912000 1716912005 "user123:1716912005"
ZCARD congestion:window:zone_a:w_1716912000   ← ping count
```

**Congestion Zone State**
```
Key:    congestion:state:{zone_id}
Type:   Hash
Fields: status, severity, flagged_at, confirmed_at, ping_count
TTL:    Revalidation window duration (60 seconds) when PENDING
        24 hours when CONGESTED (for analytics reads)
        Deleted immediately on CLEARED

HSET congestion:state:zone_a
  status      "congested"
  severity    "high"
  flagged_at  1716912000
  ping_count  87
```

**Route Cache**
```
Key:    route:{origin_hash}:{destination_hash}
Type:   String
Value:  JSON — { encoded_polyline, distance_metres, eta_seconds, cached_at }
TTL:    5 minutes (invalidated early on road graph change)

-- Origin/destination hash: MD5 of "{lat:.4f},{lon:.4f}"
-- Keeps key length predictable regardless of coordinate precision
```

**Offline Route Store (per user)**
```
Key:    route:offline:{user_id}
Type:   Set
Value:  Route cache keys (origin_hash:destination_hash strings)
TTL:    7 days

-- Tracks which routes a user has requested enough times
-- to warrant pre-caching for offline fallback
-- Promotion threshold: same route requested 3+ times
```

**Redis Pub/Sub Channels**
```
Channel                   Publisher               Subscribers
─────────────────────────────────────────────────────────────────
location.ping             Location Svc            Congestion Engine
incident.created          Incident Svc            Routing Svc, Notification Svc
incident.resolved         Incident Svc            Routing Svc, Notification Svc
incident.status           Incident Svc            Notification Svc
congestion.flagged        Congestion Engine       Routing Svc
congestion.confirmed      Congestion Engine       Routing Svc, Notification Svc, Location Svc
congestion.cleared        Congestion Engine       Routing Svc, Notification Svc, Location Svc
congestion.anticipated    Congestion Engine       Notification Svc, Location Svc
```

### 3.4.3 Rate Limiting (Redis-backed)
```
Key:    ratelimit:{user_id_or_ip}:{window_start}
Type:   String (counter)
TTL:    Rate limit window (60 seconds)

-- Sliding window counter pattern
-- Increment on each request, reject if count exceeds role limit
-- TTL auto-expires the window

INCR ratelimit:user123:1716912000
EXPIRE ratelimit:user123:1716912000 60
```

---

## 3.5 Data Flow: End-to-End Incident Lifecycle

```
1. Resident submits incident
   └─ Incident Svc writes to PostgreSQL
   └─ Incident Svc publishes to incident.created (Redis)

2. Routing Svc consumes incident.created
   └─ PostGIS query finds nearest road segment
   └─ Segment marked restricted in PostgreSQL
   └─ Route cache keys for affected segment invalidated in Redis

3. Location Svc consumes route cache invalidation
   └─ All active navigators in affected zone receive route_update via WebSocket
   └─ Clients decode new polyline and re-render route

4. Notification Svc consumes incident.created
   └─ Admin notified of new high-severity incident (push)
   └─ Zone broadcast to residents in affected area (in-app)

5. Admin assigns incident via dashboard
   └─ Incident Svc updates status → publishes incident.status

6. Notification Svc consumes incident.status
   └─ Reporter notified of status change (push + in-app)

7. Incident resolved — admin marks closed
   └─ Incident Svc updates status, sets resolved_at
   └─ Publishes incident.resolved

8. Routing Svc consumes incident.resolved
   └─ Segment restriction cleared in PostgreSQL
   └─ Affected route caches invalidated
   └─ Active navigators receive updated route via WebSocket

9. Congestion engine graduates resolved event
   └─ Congestion event log written to PostgreSQL (if applicable)
   └─ Redis congestion state key deleted
```

---

## 3.6 Data Retention and Geofence Enforcement

**Location data** — user location pings are never written to PostgreSQL. They live exclusively in Redis with a 30-second TTL. If a user stops pinging, their location record auto-expires. No persistent location history is stored at the individual user level.

**Geofence enforcement** — the camp boundary polygon is stored in the `camp_zones` table as a single row with `zone_type = 'boundary'`. Every location ping received by the Location Service is validated against this boundary before processing:

```python
async def is_within_camp(lat: float, lon: float) -> bool:
    result = await db.fetchval("""
        SELECT EXISTS (
            SELECT 1 FROM camp_zones
            WHERE zone_type = 'boundary'
            AND ST_Within(
                ST_SetSRID(ST_Point($1, $2), 4326),
                boundary
            )
        )
    """, lon, lat)
    return result

# Pings from outside the boundary are silently dropped — not stored, not processed
```

**Offline boundary check** — the boundary coordinates are also bundled as a static GeoJSON file in the `packages/map-config` package and shipped with the mobile app. The client-side geofence check runs before the ping is even sent, preserving battery and bandwidth for users who have left the camp.

---

## 3.7 Database Migration Strategy

Migrations are managed with **Alembic** (FastAPI standard). Each service owns its migration files under its own directory:

```
api/services/{service}/migrations/
├── env.py
├── script.py.mako
└── versions/
    └── 001_initial_schema.py
```

Migration conventions:
- Every schema change is a new migration file — no editing existing migrations
- Migrations are additive where possible — no destructive changes in MVP
- Every migration has a corresponding `downgrade()` function
- Migrations run automatically on service startup in development; manually gated in production via CI step

---

*Next: Section 4 — Algorithm Specifications*
