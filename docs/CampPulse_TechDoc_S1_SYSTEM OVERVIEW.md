# CampPulse — Technical Documentation
**Kingdom Hack 3.0 | Internal Engineering Reference**
**Version 1.0 | May 2026**

---

# Section 1: System Overview

## 1.1 Architecture Philosophy

CampPulse is designed as a **modular monolith with microservice boundaries** — a single deployable unit for the hackathon MVP that is structured internally as if it were already a distributed system. Every service has a clearly defined boundary, owns its data, and communicates through explicit interfaces. This means the MVP ships fast and stays coherent under a tight timeline, while the architecture supports splitting into independent deployable services post-hackathon without a rewrite.

The guiding principles are:

- **Build piece by piece.** Each module is independently buildable, testable, and deployable. No module should require another to be complete before it can be developed and verified in isolation.
- **Fail fast.** Where technology choices are unproven in this specific context — polyline encoding standard, congestion threshold values, Mapbox custom layer behaviour — the architecture provides clear substitution points so alternatives can be swapped without cascading changes.
- **Data owns behaviour.** Business logic lives inside the service that owns the data. No service reaches into another service's data store directly. Communication happens through APIs and events.
- **Real-time is a first-class concern.** The system is not a CRUD application with a real-time layer bolted on. Real-time data flow — location pings, congestion signals, route updates, incident broadcasts — is a core architectural concern that shapes every design decision from data structures to deployment topology.

---

## 1.2 System Responsibilities

CampPulse coordinates four distinct operational concerns that converge into one unified platform:

| Concern | What the system does |
|---|---|
| Civic reporting | Accepts, stores, routes, and tracks incident reports through their full lifecycle |
| Intelligent navigation | Calculates and streams optimal routes, dynamically updated as camp conditions change |
| Peak-period mobility | Detects and responds to congestion in real time using aggregated location intelligence |
| Emergency coordination | Identifies nearest responders and dispatches them along fastest available routes |

The critical architectural insight is that these four concerns are not independent features — they share a live data layer. An incident report updates the routing graph. A congestion signal updates route calculations. A route calculation reads incident and congestion state. Emergency dispatch reads responder location and routing state. Every module produces data that every other module consumes. The system gets more intelligent the more it is used.

---

## 1.3 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│   React Native App        React Web App        QR Web Client   │
│   (residents/drivers)     (admin dashboard)    (guests)        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API GATEWAY                               │
│         Rate limiting · Auth middleware · Request routing       │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌──────────┐
│ Auth │ │ User │ │ Incident │ │Route │ │  Admin   │
│ Svc  │ │ Mgmt │ │   Svc    │ │ Svc  │ │   Svc    │
└──────┘ └──────┘ └──────────┘ └──┬───┘ └──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
             ┌──────────┐  ┌──────────┐  ┌──────────────┐
             │Realtime  │  │Congestion│  │Notification  │
             │Location  │  │Detection │  │    Svc       │
             │   Svc    │  │  Engine  │  └──────────────┘
             └──────────┘  └──────────┘
                    │              │
                    └──────┬───────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SHARED DATA LAYER                          │
│                                                                 │
│   PostgreSQL + PostGIS          Redis (Upstash)                 │
│   (persistent store)            (ephemeral state + pub/sub)     │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                        │
│                                                                 │
│   Mapbox SDK          GCP Cloud Storage       Fly.io Edge       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1.4 Separation of Concerns

Each layer has a single, clearly scoped responsibility:

**Client Layer**
Renders UI, manages local state, handles WebSocket connections, and caches route data for offline use. Contains zero business logic. All decisions are made server-side and consumed by the client.

**API Gateway**
Single entry point for all client traffic. Handles rate limiting, authenticates requests via JWT validation, and routes to the appropriate downstream service. Does not contain business logic — it is a traffic coordinator only.

**Service Layer**
Nine independently scoped services, each owning its domain logic and its slice of the data model. Services communicate synchronously via internal HTTP for request-response operations and asynchronously via Redis Pub/Sub for event-driven operations.

**Shared Data Layer**
PostgreSQL + PostGIS for all persistent, relational, and geospatial data. Redis for ephemeral state — aggregation windows, session data, pub/sub channels, hot route cache. No service owns the database server, but each service owns its schema namespace and never reads or writes outside it.

**External Integrations**
Mapbox for map rendering and base routing. GCP Cloud Storage for incident photo uploads. These are treated as external dependencies with abstraction layers so they can be swapped without service-level changes.

---

## 1.5 Communication Protocols

| Protocol | Used for |
|---|---|
| REST (HTTP/JSON) | Standard CRUD operations, incident lifecycle, auth, user management |
| WebSocket | Bidirectional real-time streams — location pings, route updates, congestion broadcasts |
| GraphQL | Complex, multi-entity read operations — admin dashboard queries, analytics, filtered incident views |
| Redis Pub/Sub | Asynchronous internal event propagation — congestion signals, incident updates, broadcast triggers |

The protocol choice per operation is driven by the data flow pattern, not convention. REST for request-response. WebSocket for continuous bidirectional streams. GraphQL where query shape is variable and over-fetching is a concern. Pub/Sub where a state change needs to propagate to multiple consumers without the producer knowing who they are.

---

## 1.6 Deployment Topology

**Fly.io** hosts the application backend — API gateway, all service modules, and WebSocket server. Fly.io's anycast network reduces latency for geographically distributed clients and provides first-class WebSocket connection management. Each service module runs as an isolated process within the same Fly.io application for the MVP, with independent Fly.io apps per service post-hackathon.

**Upstash Redis** provides managed Redis with HTTP-based access — suitable for serverless and edge environments, globally replicated, and zero-ops for a hackathon timeline.

**GCP Cloud Storage** handles incident photo uploads — object storage with direct upload URLs issued by the backend, keeping binary data off the application server.

**Mapbox** is consumed client-side via SDK with server-side token scoping. Route calculations that require dynamic road graph modifications (incident-based rerouting) are handled server-side via OpenRouteService or Mapbox Directions API with waypoint manipulation, with results returned to the client as compressed polylines.

---

## 1.7 Monorepo Structure (Top Level)

```
camppulse/
├── apps/
│   ├── mobile/              # React Native — resident and driver app
│   ├── web/                 # React — guest QR navigation + admin dashboard
│   └── api/                 # FastAPI — all backend services (modular monolith)
├── packages/
│   ├── shared-types/        # Pydantic models + TypeScript interfaces (generated)
│   ├── map-config/          # Mapbox style config, camp boundary coordinates
│   └── constants/           # Shared enums, role definitions, threshold config
├── infra/
│   ├── fly.toml             # Fly.io deployment config
│   └── docker-compose.yml   # Local development environment
├── turbo.json               # Turborepo task pipeline
└── pnpm-workspace.yaml      # Workspace config
```

The `api/` directory is structured internally by service module — detailed in Section 6.

---

*Next: Section 2 — Module Breakdown*
