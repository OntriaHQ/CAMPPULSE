# CampPulse — Technical Documentation
**Section 8: Abstraction Levels**

---

# Section 8: Abstraction Levels

## 8.1 Overview

CampPulse is structured across four abstraction levels. Each level has a single responsibility, a defined interface with the level above and below it, and a strict rule about what it is allowed to know. Violating these rules — a route handler querying the database directly, a service importing from another service's models — is a code smell that signals a boundary violation and must be corrected before it compounds.

```
┌─────────────────────────────────────────┐
│           LEVEL 1: GATEWAY              │  Traffic coordination
│     API Gateway · Middleware · Auth     │  No business logic
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│           LEVEL 2: SERVICE              │  Business logic
│    Routers · Service functions ·        │  No direct DB access
│    Event publishers · Subscribers       │  No cross-service imports
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│           LEVEL 3: DOMAIN               │  Data logic + algorithms
│    Schemas · Models · Algorithms ·      │  No HTTP concerns
│    Validators · Domain rules            │  No Redis/DB clients
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│           LEVEL 4: DATA                 │  Persistence + state
│    PostgreSQL · PostGIS · Redis ·       │  No business logic
│    GCP Storage · Mapbox client          │  No HTTP concerns
└─────────────────────────────────────────┘
```

---

## 8.2 Level 1 — Gateway

### Responsibility
The gateway layer is the system's front door. It handles everything that must happen before a request reaches business logic — authentication, authorisation, rate limiting, request routing, and response logging. It knows nothing about what services do; it only knows how to get requests to the right service and how to enforce platform-level rules.

### What it owns
- FastAPI application instance
- Middleware stack
- Route mounting (maps URL prefixes to service routers)
- JWT validation
- Rate limit enforcement
- Request/response logging
- Global error handler (translates exceptions to the standard error envelope)

### What it does NOT own
- Business logic of any kind
- Database connections
- Event publishing
- Knowledge of any domain entity (incidents, users, routes)

### Interface contract
```
Inbound:  HTTP requests from clients (REST, GraphQL, WebSocket upgrade)
Outbound: Validated, authenticated request objects passed to Level 2 routers
```

### Implementation
```python
# apps/api/gateway/main.py

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from gateway.middleware.auth import AuthMiddleware
from gateway.middleware.rate_limit import RateLimitMiddleware
from gateway.middleware.logging import LoggingMiddleware
from core.exceptions import (
    ServiceUnavailableError,
    InvalidStatusTransition,
    ResourceNotFoundError,
    AuthenticationError,
    AuthorisationError
)

# Import service routers — gateway knows routes exist, not what they do
from services.auth.router import router as auth_router
from services.user.router import router as user_router
from services.incident.router import router as incident_router
from services.routing.router import router as routing_router
from services.admin.router import router as admin_router
from services.realtime.manager import ws_router

def create_app() -> FastAPI:
    app = FastAPI(
        title="CampPulse API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url=None
    )

    # Middleware stack — applied in reverse registration order
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(AuthMiddleware)

    # Route mounting
    app.include_router(auth_router,     prefix="/api/v1/auth")
    app.include_router(user_router,     prefix="/api/v1/users")
    app.include_router(incident_router, prefix="/api/v1/incidents")
    app.include_router(routing_router,  prefix="/api/v1/routes")
    app.include_router(admin_router,    prefix="/graphql")
    app.include_router(ws_router,       prefix="/ws")

    # Global exception handlers
    @app.exception_handler(ResourceNotFoundError)
    async def not_found_handler(request: Request, exc: ResourceNotFoundError):
        return JSONResponse(status_code=404, content={
            "success": False,
            "error": { "code": exc.code, "message": str(exc) }
        })

    @app.exception_handler(AuthenticationError)
    async def auth_error_handler(request: Request, exc: AuthenticationError):
        return JSONResponse(status_code=401, content={
            "success": False,
            "error": { "code": "INVALID_TOKEN", "message": str(exc) }
        })

    @app.exception_handler(AuthorisationError)
    async def authz_error_handler(request: Request, exc: AuthorisationError):
        return JSONResponse(status_code=403, content={
            "success": False,
            "error": { "code": "INSUFFICIENT_ROLE", "message": str(exc) }
        })

    @app.exception_handler(ServiceUnavailableError)
    async def unavailable_handler(request: Request, exc: ServiceUnavailableError):
        return JSONResponse(status_code=503, content={
            "success": False,
            "error": { "code": "UPSTREAM_UNAVAILABLE", "message": str(exc) }
        })

    return app
```

### Boundary Rules
```
✅ Gateway MAY:
   - Read JWT claims from request headers
   - Increment rate limit counters in Redis
   - Route requests to service routers
   - Translate exceptions to HTTP responses

❌ Gateway MUST NOT:
   - Query PostgreSQL
   - Instantiate service classes directly
   - Contain if/else business logic
   - Know what an "incident" or "zone" is
```

---

## 8.3 Level 2 — Service

### Responsibility
The service layer is where business logic lives. Service functions orchestrate domain operations — they validate inputs, apply business rules, coordinate between domain objects, publish events, and return results. Routers at this level are thin: they receive HTTP requests, call service functions, and return HTTP responses. They contain no logic beyond parameter extraction and response construction.

### What it owns
- HTTP routers (thin — parameter extraction only)
- Service functions (business logic orchestration)
- Event publishers (emit domain events)
- Event subscribers (react to domain events from other services)
- GraphQL resolvers (orchestrate service function calls for dashboard queries)

### What it does NOT own
- SQL queries (delegated to Level 4 via repository functions)
- Redis commands (delegated to Level 4 via cache functions)
- Algorithm implementations (delegated to Level 3)
- HTTP clients for external APIs (delegated to Level 4)

### Interface contract
```
Inbound:  Validated Pydantic schemas from Level 1 routers
Outbound: Pydantic response schemas returned to Level 1
          Events published to Redis (consumed by other Level 2 services)
          Function calls down to Level 3 algorithms and Level 4 data access
```

### Router — thin layer example
```python
# services/incident/router.py

from fastapi import APIRouter, Depends, UploadFile, File, Form
from services.auth.dependencies import get_current_user, optional_user
from services.incident.service import create_incident, get_incident, upvote_incident
from services.incident.schemas import IncidentCreate, IncidentCreateResponse, IncidentDetail

router = APIRouter(tags=["incidents"])

@router.post("", response_model=IncidentCreateResponse, status_code=201)
async def submit_incident(
    type: str = Form(...),
    description: str = Form(None),
    lat: float = Form(...),
    lon: float = Form(...),
    severity: str = Form("low"),
    photo: UploadFile = File(None),
    current_user = Depends(optional_user)   # None for anonymous guests
):
    """Router is thin — extract params, call service, return result."""
    data = IncidentCreate(
        type=type, description=description,
        lat=lat, lon=lon, severity=severity
    )
    return await create_incident(data, photo, current_user)

@router.get("/{incident_id}", response_model=IncidentDetail)
async def fetch_incident(incident_id: str):
    return await get_incident(incident_id)

@router.post("/{incident_id}/upvote")
async def upvote(
    incident_id: str,
    current_user = Depends(get_current_user)
):
    return await upvote_incident(incident_id, current_user.id)
```

### Service function — business logic
```python
# services/incident/service.py

from services.incident.duplicate import check_and_handle_duplicate
from services.incident.routing import resolve_department
from services.incident.storage import upload_photo
from core.publisher import EventPublisher
from core.db import queries as q   # Level 4 — all SQL lives here

publisher = EventPublisher("incident")

async def create_incident(
    data: IncidentCreate,
    photo: UploadFile | None,
    reporter
) -> IncidentCreateResponse:
    """
    Service function — orchestrates the incident creation workflow.
    Knows the business rules. Does not write SQL. Does not know HTTP.
    """
    # Rule: location must be within camp boundary
    if not await q.is_within_boundary(data.lat, data.lon):
        raise LocationOutsideBoundaryError()

    # Rule: check for duplicates before creating
    duplicate = await check_and_handle_duplicate(
        data.type, (data.lat, data.lon), reporter.id if reporter else None
    )
    if duplicate.is_duplicate:
        return IncidentCreateResponse(
            is_duplicate=True,
            parent_incident_id=duplicate.parent_id,
            parent_upvote_count=duplicate.parent_upvote_count,
            status=duplicate.parent_status
        )

    # Rule: resolve department from incident type
    department = resolve_department(data.type)

    # Upload photo if provided (Level 4 — GCP)
    photo_url = await upload_photo(photo) if photo else None

    # Persist (Level 4 — PostgreSQL)
    incident = await q.incidents.create(
        reporter_id=reporter.id if reporter else None,
        type=data.type,
        description=data.description,
        photo_url=photo_url,
        lat=data.lat,
        lon=data.lon,
        severity=data.severity,
        department=department
    )

    # Emit event (other services react independently)
    await publisher.publish("incident.created", {
        "incident_id": str(incident.id),
        "type":        data.type,
        "location":    {"lat": data.lat, "lon": data.lon},
        "severity":    data.severity,
        "zone":        incident.zone
    })

    return IncidentCreateResponse(
        incident_id=incident.id,
        is_duplicate=False,
        status=incident.status,
        department=department
    )
```

### Boundary Rules
```
✅ Service MAY:
   - Call Level 3 domain functions and algorithms
   - Call Level 4 query functions (q.incidents.create, q.users.get)
   - Publish events via EventPublisher
   - Call other services' public service functions (sparingly — prefer events)
   - Instantiate and use Pydantic schemas

❌ Service MUST NOT:
   - Write raw SQL strings
   - Import SQLAlchemy models directly
   - Call redis.get / redis.set directly
   - Know about HTTP request/response objects
   - Import from another service's router or models
```

---

## 8.4 Level 3 — Domain

### Responsibility
The domain layer owns the system's core logic that is not specific to any HTTP request or database operation. This is where algorithms live, where domain rules are encoded, where data shapes are defined. Domain functions are pure or near-pure — they take typed inputs and return typed outputs without side effects where possible. They are the most testable layer in the system.

### What it owns
- Pydantic schemas (request models, response models, internal DTOs)
- SQLAlchemy ORM models (schema definitions — not query execution)
- Algorithm implementations (congestion windows, polyline encoding, dispatch logic)
- Domain validators (severity scoring, department routing, duplicate detection logic)
- Business rule functions (valid status transitions, geofence checks)

### What it does NOT own
- HTTP routing
- Database connection management
- Redis connection management
- Event publishing/subscribing

### Interface contract
```
Inbound:  Primitive types or typed DTOs from Level 2
Outbound: Typed DTOs or primitive results returned to Level 2
          No I/O side effects in pure domain functions
```

### Schema definition example
```python
# services/incident/schemas.py

from pydantic import BaseModel, validator, Field
from typing import Optional, Literal
from datetime import datetime
import uuid

VALID_INCIDENT_TYPES = [
    "flooding", "pothole", "streetlight", "water_leak",
    "trash", "security", "congestion", "other"
]

class IncidentCreate(BaseModel):
    type: str
    description: Optional[str] = None
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    severity: Literal["low", "medium", "high", "critical"] = "low"

    @validator("type")
    def validate_type(cls, v):
        if v not in VALID_INCIDENT_TYPES:
            raise ValueError(f"Invalid incident type: {v}")
        return v

    @validator("description")
    def validate_description(cls, v):
        if v and len(v) > 1000:
            raise ValueError("Description must not exceed 1000 characters")
        return v

class IncidentCreateResponse(BaseModel):
    incident_id: Optional[uuid.UUID] = None
    is_duplicate: bool
    parent_incident_id: Optional[uuid.UUID] = None
    parent_upvote_count: Optional[int] = None
    status: Optional[str] = None
    department: Optional[str] = None
    estimated_response_window: Optional[str] = None

class IncidentDetail(BaseModel):
    id: uuid.UUID
    type: str
    description: Optional[str]
    photo_url: Optional[str]
    location: dict           # { lat, lon }
    address_label: Optional[str]
    zone: Optional[str]
    severity: str
    status: str
    department: Optional[str]
    upvote_count: int
    is_duplicate: bool
    reporter_name: Optional[str]
    assignee_name: Optional[str]
    comments: list
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True
```

### Domain rule functions
```python
# services/incident/routing.py — pure domain logic

DEPARTMENT_ROUTING = {
    "flooding":    "infrastructure",
    "pothole":     "infrastructure",
    "streetlight": "utilities",
    "water_leak":  "utilities",
    "trash":       "sanitation",
    "security":    "security",
    "congestion":  "infrastructure",
    "other":       "infrastructure"
}

VALID_STATUS_TRANSITIONS = {
    "submitted":   ["assigned"],
    "assigned":    ["in_progress"],
    "in_progress": ["resolved"],
    "resolved":    ["closed"]
}

def resolve_department(incident_type: str) -> str:
    """Pure function — no I/O. Deterministic. Fully testable."""
    return DEPARTMENT_ROUTING.get(incident_type, "infrastructure")

def is_valid_transition(current_status: str, next_status: str) -> bool:
    """Pure function — validates state machine transition."""
    return next_status in VALID_STATUS_TRANSITIONS.get(current_status, [])

def estimate_response_window(severity: str, department: str) -> str:
    """Pure function — returns human-readable SLA estimate."""
    windows = {
        ("critical", "security"):       "15–30 minutes",
        ("critical", "infrastructure"): "30–60 minutes",
        ("high",     "infrastructure"): "1–2 hours",
        ("high",     "utilities"):      "2–4 hours",
        ("medium",   "sanitation"):     "4–8 hours",
        ("low",      "sanitation"):     "1–2 days",
    }
    return windows.get((severity, department), "2–4 hours")
```

### Boundary Rules
```
✅ Domain MAY:
   - Implement pure functions with typed inputs/outputs
   - Define Pydantic schemas and ORM models
   - Import from packages/constants and packages/shared-types
   - Call other domain functions within the same service

❌ Domain MUST NOT:
   - Import FastAPI, Starlette, or any HTTP framework
   - Import asyncpg, SQLAlchemy sessions, or execute queries
   - Import aioredis or execute Redis commands
   - Publish or subscribe to events
   - Have async functions unless the async is genuinely needed
     (i.e. not for I/O — domain is I/O-free)
```

---

## 8.5 Level 4 — Data

### Responsibility
The data layer is the only layer permitted to communicate with external systems — PostgreSQL, Redis, GCP Storage, Mapbox, and OpenRouteService. It translates between the domain's typed objects and the persistence layer's native formats. It owns all SQL strings, all Redis commands, and all external API calls. Nothing above Level 4 writes SQL or calls redis directly.

### What it owns
- All SQL query strings (via asyncpg or SQLAlchemy Core)
- All Redis commands (via aioredis)
- External API clients (Mapbox, GCP, OpenRouteService) — wrapped with circuit breakers
- Database connection pool management
- Migration files (Alembic)

### What it does NOT own
- Business logic of any kind
- Pydantic validation (inputs arrive pre-validated from Level 3)
- Event publishing (returns raw data — Level 2 decides what to emit)

### Interface contract
```
Inbound:  Primitive types or typed DTOs from Level 2 service functions
Outbound: Raw database records mapped to typed DTOs
          No exceptions from DB drivers leak above this layer —
          all DB exceptions are caught and re-raised as domain exceptions
```

### Query module structure
```python
# core/db/queries/incidents.py
# All incident-related SQL lives here and nowhere else

from core.database import get_db
from core.exceptions import ResourceNotFoundError
import uuid

async def create(
    reporter_id: str | None,
    type: str,
    description: str | None,
    photo_url: str | None,
    lat: float,
    lon: float,
    severity: str,
    department: str
) -> dict:
    """
    Inserts a new incident record.
    Returns a dict — Level 2 constructs the domain object.
    Never raises DB driver exceptions — wraps in domain exceptions.
    """
    db = await get_db()
    try:
        row = await db.fetchrow("""
            INSERT INTO incidents (
                reporter_id, type, description, photo_url,
                location, severity, department,
                zone
            )
            VALUES (
                $1, $2, $3, $4,
                ST_SetSRID(ST_Point($5, $6), 4326), $7, $8,
                (
                    SELECT name FROM camp_zones
                    WHERE zone_type != 'boundary'
                    AND ST_Within(ST_SetSRID(ST_Point($5, $6), 4326), boundary)
                    LIMIT 1
                )
            )
            RETURNING id, status, zone, department, created_at
        """, reporter_id, type, description, photo_url,
             lon, lat, severity, department)
        return dict(row)
    except Exception as e:
        # Translate DB exception to domain exception
        raise IncidentCreationError(str(e)) from e


async def get_by_id(incident_id: str) -> dict:
    db = await get_db()
    row = await db.fetchrow("""
        SELECT i.*,
               ST_Y(i.location::geometry) AS lat,
               ST_X(i.location::geometry) AS lon,
               u.full_name AS reporter_name,
               a.full_name AS assignee_name
        FROM incidents i
        LEFT JOIN users u ON u.id = i.reporter_id
        LEFT JOIN users a ON a.id = i.assigned_to
        WHERE i.id = $1
    """, uuid.UUID(incident_id))

    if not row:
        raise ResourceNotFoundError("incident", incident_id)
    return dict(row)


async def update_status(incident_id: str, status: str) -> None:
    db = await get_db()
    await db.execute("""
        UPDATE incidents
        SET status = $1,
            updated_at = NOW(),
            resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
        WHERE id = $2
    """, status, uuid.UUID(incident_id))
```

### Redis access module
```python
# core/db/cache/routes.py
# All route-cache Redis operations

from core.redis import get_redis
import json

async def get_cached_route(cache_key: str) -> dict | None:
    redis = await get_redis()
    cached = await redis.get(cache_key)
    return json.loads(cached) if cached else None

async def set_cached_route(cache_key: str, route: dict, ttl: int = 300) -> None:
    redis = await get_redis()
    await redis.setex(cache_key, ttl, json.dumps(route))

async def invalidate_route(cache_key: str) -> None:
    redis = await get_redis()
    await redis.delete(cache_key)

async def get_offline_route_keys(user_id: str) -> list[str]:
    redis = await get_redis()
    keys = await redis.smembers(f"route:offline:{user_id}")
    return [k.decode() for k in keys]
```

### External API client example
```python
# services/routing/mapbox.py
# Mapbox is a Level 4 concern — abstracted behind a clean interface

import httpx
from core.circuit_breakers import mapbox_breaker
from core.config import settings

class MapboxClient:
    BASE_URL = "https://api.mapbox.com/directions/v5/mapbox"

    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        mode: str,
        avoid_points: list[tuple] | None = None
    ) -> dict:
        profile = "walking" if mode == "walking" else "driving"
        coords = f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"

        params = {
            "access_token":  settings.MAPBOX_TOKEN,
            "geometries":    "geojson",
            "overview":      "full",
            "steps":         "false"
        }

        return await mapbox_breaker.call(
            self._request,
            f"{self.BASE_URL}/{profile}/{coords}",
            params
        )

    async def _request(self, url: str, params: dict) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            if not data.get("routes"):
                raise NoRouteFoundError()
            return data["routes"][0]

mapbox_client = MapboxClient()
```

### Boundary Rules
```
✅ Data layer MAY:
   - Write and execute SQL queries
   - Execute Redis commands
   - Call external HTTP APIs (wrapped in circuit breakers)
   - Manage connection pool lifecycle
   - Translate DB driver exceptions to domain exceptions

❌ Data layer MUST NOT:
   - Contain business logic or conditional rules
   - Import from service layer
   - Publish events
   - Validate input data (arrives pre-validated)
   - Return raw DB driver objects above this layer
     (always map to dicts or typed DTOs)
```

---

## 8.6 Cross-Cutting Concerns

Some concerns span all four levels but are implemented once and consumed everywhere:

### Logging
```python
# core/logging.py — structured JSON logging, consumed at every level

import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "timestamp":  datetime.utcnow().isoformat(),
            "level":      record.levelname,
            "service":    getattr(record, "service", "unknown"),
            "message":    record.getMessage(),
            "request_id": getattr(record, "request_id", None)
        })
```

### Dependency Injection
```python
# core/dependencies.py — FastAPI DI, consumed by all service routers

from fastapi import Depends
from core.database import get_db
from core.redis import get_redis

# These are the only two dependencies service routers should ever inject
# DB and Redis clients are never instantiated directly in service code
DatabaseDep = Depends(get_db)
RedisDep    = Depends(get_redis)
```

### Exception Hierarchy
```python
# core/exceptions.py — all domain exceptions inherit from CampPulseError

class CampPulseError(Exception):
    """Base exception for all application errors."""
    code: str = "INTERNAL_ERROR"

class ResourceNotFoundError(CampPulseError):
    code = "NOT_FOUND"
    def __init__(self, resource: str, id: str):
        super().__init__(f"{resource} '{id}' not found")

class AuthenticationError(CampPulseError):
    code = "INVALID_TOKEN"

class AuthorisationError(CampPulseError):
    code = "INSUFFICIENT_ROLE"

class LocationOutsideBoundaryError(CampPulseError):
    code = "LOCATION_OUTSIDE_BOUNDARY"

class InvalidStatusTransition(CampPulseError):
    code = "INVALID_STATUS_TRANSITION"
    def __init__(self, current: str, attempted: str):
        super().__init__(f"Cannot transition from '{current}' to '{attempted}'")

class ServiceUnavailableError(CampPulseError):
    code = "UPSTREAM_UNAVAILABLE"

class NoRouteFoundError(CampPulseError):
    code = "NO_ROUTE_FOUND"

class IncidentCreationError(CampPulseError):
    code = "INCIDENT_CREATION_FAILED"
```

---

## 8.7 Abstraction Violation Detection

The following are concrete signals that a boundary has been violated. Every team member should be able to identify and correct these:

| Violation | Signal | Correct fix |
|---|---|---|
| Level 1 contains business logic | `if incident.severity == "critical"` in middleware | Move to Level 2 service function |
| Level 2 contains raw SQL | `await db.execute("SELECT * FROM incidents...")` in service.py | Move query to `core/db/queries/` |
| Level 3 imports a DB driver | `from asyncpg import ...` in schemas.py | Remove — domain is I/O free |
| Level 4 publishes events | `await redis.publish(...)` in queries/ | Move publish to Level 2 |
| Service imports from another service's models | `from services.incident.models import Incident` in routing service | Use shared types package or communicate via API |
| Router contains conditional logic | `if user.role == "admin": ...` in router.py | Move to service function or use `require_role` dependency |

---

*Next: Section 9 — Build Milestones and Checkpoints*
