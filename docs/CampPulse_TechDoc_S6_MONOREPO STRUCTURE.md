# CampPulse — Technical Documentation
**Section 6: Monorepo Structure**

---

# Section 6: Monorepo Structure

## 6.1 Philosophy

The monorepo exists to enforce a single source of truth across the entire CampPulse codebase — shared types, shared constants, shared configuration — while keeping each application and service independently buildable and deployable. Every boundary that matters architecturally is reflected in the folder structure. If a developer cannot tell where a piece of logic belongs from the folder layout alone, the structure has failed.

Turborepo manages the task pipeline. pnpm manages workspaces. Python services inside `apps/api` use their own dependency management (pip + virtualenv per service) but are coordinated by Turborepo at the task level.

---

## 6.2 Root Structure

```
camppulse/
│
├── apps/
│   ├── mobile/                  # React Native — resident and driver app
│   ├── web/                     # React — guest QR nav + admin dashboard
│   └── api/                     # FastAPI — modular monolith backend
│
├── packages/
│   ├── shared-types/            # Canonical type definitions (TypeScript + Pydantic)
│   ├── map-config/              # Mapbox styles, camp boundary, hotspot registry
│   └── constants/               # Shared enums, thresholds, role definitions
│
├── infra/
│   ├── fly.toml                 # Fly.io deployment configuration
│   ├── docker-compose.yml       # Local development environment
│   ├── docker-compose.test.yml  # Test environment
│   └── nginx/
│       └── nginx.conf           # Reverse proxy config (local dev)
│
├── scripts/
│   ├── seed.py                  # Database seeding script
│   ├── field-map.py             # Field run coordinate capture utility
│   └── smoke-test.sh            # Smoke test runner
│
├── turbo.json                   # Turborepo pipeline configuration
├── pnpm-workspace.yaml          # pnpm workspace declaration
├── .env.example                 # Environment variable template
├── .gitignore
└── README.md
```

---

## 6.3 Turborepo Pipeline Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false,
      "dependsOn": ["db:migrate"]
    }
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 6.4 apps/api — Backend Structure

The API is a modular monolith. All nine services live inside one FastAPI application, each mounted as an independent router. Services are isolated by directory, own their models and schemas, and communicate internally via function calls (same process) or Redis pub/sub (async decoupling). The gateway mounts all routers and applies global middleware.

```
apps/api/
│
├── main.py                      # Application entry point
├── requirements.txt             # Top-level dependencies
├── Dockerfile
├── .env.example
├── alembic.ini                  # Alembic root config
│
├── gateway/
│   ├── main.py                  # Router mounting, middleware registration
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── auth.py              # JWT validation middleware
│   │   ├── rate_limit.py        # Redis-backed sliding window rate limiter
│   │   └── logging.py           # Structured request/response logging
│   └── config.py                # Environment config, feature flags
│
├── core/
│   ├── __init__.py
│   ├── database.py              # Async PostgreSQL connection pool (asyncpg)
│   ├── redis.py                 # Upstash Redis client (aioredis)
│   ├── exceptions.py            # Global exception handlers + error envelope
│   ├── dependencies.py          # Shared FastAPI dependencies (get_db, get_redis)
│   └── circuit_breaker.py       # Circuit breaker implementation
│
├── services/
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── security.py
│   │   ├── schemas.py
│   │   ├── models.py
│   │   ├── dependencies.py      # get_current_user, require_role
│   │   └── migrations/
│   │       ├── env.py
│   │       └── versions/
│   │           └── 001_auth_initial.py
│   │
│   ├── user/
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   ├── models.py
│   │   ├── graphql/
│   │   │   ├── schema.py
│   │   │   └── resolvers.py
│   │   └── migrations/
│   │       └── versions/
│   │           └── 001_user_initial.py
│   │
│   ├── incident/
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── duplicate.py
│   │   ├── routing.py           # Department auto-routing logic
│   │   ├── storage.py           # GCP upload URL generation
│   │   ├── schemas.py
│   │   ├── models.py
│   │   ├── graphql/
│   │   │   ├── schema.py
│   │   │   └── resolvers.py
│   │   └── migrations/
│   │       └── versions/
│   │           └── 001_incident_initial.py
│   │
│   ├── realtime/
│   │   ├── __init__.py
│   │   ├── manager.py           # WebSocket connection manager
│   │   ├── handler.py           # Incoming message routing
│   │   ├── broadcaster.py       # Outbound message construction
│   │   ├── subscriber.py        # Redis pub/sub listener
│   │   └── schemas.py           # WebSocket message schemas
│   │
│   ├── congestion/
│   │   ├── __init__.py
│   │   ├── engine.py            # Main detection loop
│   │   ├── windows.py           # W1 + W2 window logic
│   │   ├── severity.py          # Severity scoring
│   │   ├── hotspots.py          # Predictive detection scheduler
│   │   ├── publisher.py         # Redis pub/sub event emission
│   │   └── subscriber.py        # Consumes location.ping
│   │
│   ├── routing/
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── graph.py             # Road graph management
│   │   ├── polyline.py          # Encoding/decoding utilities
│   │   ├── cache.py             # Redis cache management
│   │   ├── subscriber.py        # Consumes incident + congestion events
│   │   ├── mapbox.py            # Mapbox API client (abstracted)
│   │   ├── schemas.py
│   │   ├── models.py
│   │   └── migrations/
│   │       └── versions/
│   │           └── 001_routing_initial.py
│   │
│   ├── notification/
│   │   ├── __init__.py
│   │   ├── service.py
│   │   ├── templates.py
│   │   ├── subscriber.py
│   │   ├── models.py
│   │   ├── migrations/
│   │   │   └── versions/
│   │   │       └── 001_notification_initial.py
│   │   └── channels/
│   │       ├── push.py          # Expo Push API
│   │       └── inapp.py         # In-app via WebSocket
│   │
│   └── admin/
│       ├── __init__.py
│       ├── router.py
│       ├── analytics.py
│       ├── map.py
│       ├── schemas.py
│       └── graphql/
│           ├── schema.py
│           └── resolvers.py
│
└── tests/
    ├── conftest.py              # Pytest fixtures — test DB, Redis, auth tokens
    ├── unit/
    │   ├── test_polyline.py
    │   ├── test_congestion_windows.py
    │   ├── test_severity_scoring.py
    │   ├── test_duplicate_detection.py
    │   ├── test_dispatch.py
    │   └── test_zone_determination.py
    ├── integration/
    │   ├── test_auth_flow.py
    │   ├── test_incident_lifecycle.py
    │   ├── test_routing_pipeline.py
    │   ├── test_congestion_pipeline.py
    │   └── test_websocket_streams.py
    └── e2e/
        ├── test_resident_report_flow.py
        ├── test_admin_dispatch_flow.py
        └── test_guest_navigation_flow.py
```

---

## 6.5 apps/mobile — React Native Structure

```
apps/mobile/
│
├── app/                         # Expo Router file-based navigation
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── map.tsx              # Main navigation map screen
│   │   ├── report.tsx           # Incident reporting screen
│   │   ├── my-reports.tsx       # Resident report history + status
│   │   └── profile.tsx
│   └── _layout.tsx
│
├── components/
│   ├── map/
│   │   ├── CampMap.tsx          # Mapbox map wrapper
│   │   ├── IncidentMarker.tsx
│   │   ├── RouteOverlay.tsx     # Polyline renderer
│   │   ├── CongestionOverlay.tsx
│   │   └── ZoneAlertBanner.tsx
│   ├── incident/
│   │   ├── ReportForm.tsx
│   │   ├── IncidentCard.tsx
│   │   ├── StatusTimeline.tsx
│   │   └── CommentThread.tsx
│   └── shared/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── ErrorBoundary.tsx
│
├── hooks/
│   ├── useWebSocket.ts          # WS connection lifecycle + reconnect logic
│   ├── useLocation.ts           # Background location permissions + streaming
│   ├── useRoute.ts              # Route calculation + cache
│   ├── useCongestion.ts         # Zone alert subscription
│   └── useOfflineRoutes.ts      # Offline route cache management
│
├── services/
│   ├── api.ts                   # Axios instance + interceptors
│   ├── websocket.ts             # WebSocket client wrapper
│   ├── polyline.ts              # Client-side decode (mirrors server encode)
│   └── geofence.ts              # Client-side boundary check (offline capable)
│
├── store/
│   ├── auth.ts                  # Auth state (Zustand)
│   ├── map.ts                   # Map state — incidents, routes, zones
│   └── notifications.ts         # In-app notification queue
│
├── constants/                   # Consumed from packages/constants
└── package.json
```

---

## 6.6 apps/web — React Web Structure

The web app serves two distinct experiences from one codebase — the guest QR navigation interface (public, no auth) and the admin dashboard (admin role required). Route-based code splitting ensures the admin bundle is never loaded by guests.

```
apps/web/
│
├── src/
│   ├── pages/
│   │   ├── nav/
│   │   │   └── index.tsx        # Guest QR navigation — public route
│   │   ├── admin/
│   │   │   ├── index.tsx        # Dashboard overview
│   │   │   ├── incidents.tsx    # Incident management table
│   │   │   ├── map.tsx          # Live camp map
│   │   │   ├── analytics.tsx    # Hotspot + equity metrics
│   │   │   ├── drivers.tsx      # Driver management
│   │   │   └── broadcast.tsx    # Zone notification sender
│   │   └── login.tsx
│   │
│   ├── components/
│   │   ├── map/
│   │   │   ├── AdminMap.tsx     # Mapbox admin map with all overlays
│   │   │   ├── GuestMap.tsx     # Simplified guest navigation map
│   │   │   ├── IncidentLayer.tsx
│   │   │   ├── CongestionLayer.tsx
│   │   │   └── DriverLayer.tsx
│   │   ├── dashboard/
│   │   │   ├── SummaryCards.tsx
│   │   │   ├── IncidentTable.tsx
│   │   │   ├── HotspotChart.tsx
│   │   │   ├── EquityChart.tsx
│   │   │   └── ResponseMetrics.tsx
│   │   └── shared/
│   │       ├── ProtectedRoute.tsx
│   │       └── ErrorBoundary.tsx
│   │
│   ├── hooks/
│   │   ├── useGraphQL.ts        # Apollo Client wrapper
│   │   ├── useWebSocket.ts      # Admin live feed subscription
│   │   └── useMapbox.ts         # Mapbox instance management
│   │
│   ├── services/
│   │   ├── apollo.ts            # Apollo Client setup
│   │   ├── api.ts               # REST client for non-GraphQL endpoints
│   │   └── polyline.ts          # Polyline decode for guest nav
│   │
│   └── store/
│       ├── auth.ts
│       └── map.ts
│
└── package.json
```

---

## 6.7 packages/ — Shared Packages

### packages/shared-types
Single source of truth for all data types shared across TypeScript apps and the Python backend. TypeScript types are handwritten. Pydantic models in the API are kept in sync manually for the MVP — a code generation step (datamodel-code-generator) is a post-hackathon improvement.

```
packages/shared-types/
├── src/
│   ├── user.ts
│   ├── incident.ts
│   ├── route.ts
│   ├── congestion.ts
│   ├── websocket.ts             # WS message type definitions
│   └── index.ts
├── package.json
└── tsconfig.json
```

### packages/map-config
All static geographic data for Redemption City. This package is the authoritative source for camp boundaries, zone definitions, and hotspot schedules. Both the mobile app and the backend consume it — the backend at startup (loaded into Redis/DB), the mobile app at build time (bundled for offline geofencing).

```
packages/map-config/
├── src/
│   ├── boundary.geojson         # Camp outer boundary polygon
│   ├── zones.geojson            # Named zone polygons
│   ├── roads.geojson            # Initial road network (field-run data)
│   ├── hotspots.json            # Venue schedules for predictive detection
│   ├── mapbox-style.json        # Custom Mapbox style definition
│   └── index.ts                 # Typed exports
├── package.json
└── tsconfig.json
```

### packages/constants
Shared enumerations, configuration thresholds, and role definitions. The Python API imports the raw JSON; TypeScript apps import the typed exports.

```
packages/constants/
├── src/
│   ├── roles.ts
│   ├── incidentTypes.ts
│   ├── congestion.ts            # Threshold values, window durations
│   ├── routing.ts               # Cache TTLs, proximity radii
│   └── index.ts
├── congestion.json              # Raw JSON mirror for Python consumption
├── routing.json
├── package.json
└── tsconfig.json
```

---

## 6.8 infra/ — Infrastructure Configuration

### docker-compose.yml (local development)
```yaml
version: "3.9"
services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: camppulse_dev
      POSTGRES_USER: camppulse
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./apps/api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://camppulse:devpassword@postgres:5432/camppulse_dev
      REDIS_URL: redis://redis:6379
      MAPBOX_TOKEN: ${MAPBOX_TOKEN}
      GCP_BUCKET: ${GCP_BUCKET}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./apps/api:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      NEXT_PUBLIC_MAPBOX_TOKEN: ${MAPBOX_TOKEN}
    depends_on:
      - api

volumes:
  pgdata:
```

### fly.toml
```toml
app = "camppulse-api"
primary_region = "jnb"   # Johannesburg — lowest latency to Nigeria

[build]
  dockerfile = "apps/api/Dockerfile"

[env]
  PORT = "8000"
  ENVIRONMENT = "production"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "connections"
    hard_limit = 500
    soft_limit = 400

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 1024
```

---

## 6.9 Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/camppulse

# Redis (Upstash)
REDIS_URL=rediss://default:password@host.upstash.io:6380

# Auth
JWT_SECRET=minimum_32_char_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Mapbox
MAPBOX_TOKEN=pk.eyJ...
MAPBOX_STYLE_URL=mapbox://styles/camppulse/...

# GCP
GCP_BUCKET=camppulse-uploads
GCP_PROJECT_ID=camppulse
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# External routing
OPENROUTESERVICE_API_KEY=ors_...

# Feature flags
CONGESTION_DETECTION_ENABLED=true
PREDICTIVE_HOTSPOTS_ENABLED=true
OFFLINE_ROUTE_CACHE_ENABLED=true

# Thresholds (override defaults from constants package)
CONGESTION_THRESHOLD=50
DETECTION_WINDOW_SECONDS=90
REVALIDATION_WINDOW_SECONDS=60
```

---

## 6.10 Task Scripts (package.json root)

```json
{
  "scripts": {
    "dev":         "turbo run dev",
    "build":       "turbo run build",
    "test":        "turbo run test",
    "lint":        "turbo run lint",
    "type-check":  "turbo run type-check",
    "db:migrate":  "turbo run db:migrate",
    "db:seed":     "turbo run db:seed",
    "smoke":       "bash scripts/smoke-test.sh",
    "field-map":   "python scripts/field-map.py"
  }
}
```

---

## 6.11 Naming Conventions

| Concern | Convention | Example |
|---|---|---|
| Python files | snake_case | `incident_service.py` |
| Python classes | PascalCase | `IncidentService` |
| Python functions | snake_case | `calculate_route()` |
| TypeScript files | camelCase | `useWebSocket.ts` |
| TypeScript components | PascalCase | `IncidentMarker.tsx` |
| TypeScript functions | camelCase | `decodePolyline()` |
| Database tables | snake_case | `incident_upvotes` |
| Redis keys | colon-namespaced | `congestion:state:{zone_id}` |
| Environment variables | SCREAMING_SNAKE_CASE | `CONGESTION_THRESHOLD` |
| API endpoints | kebab-case | `/incidents/nearby` |
| GraphQL types | PascalCase | `IncidentHotspot` |
| GraphQL fields | camelCase | `upvoteCount` |
| Git branches | kebab-case | `feat/congestion-detection` |
| Commit messages | Conventional Commits | `feat(routing): add polyline compression` |

---

*Next: Section 7 — Design Patterns*
