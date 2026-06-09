# CampPulse — Technical Documentation
**Section 7: Design Patterns**

---

# Section 7: Design Patterns

## 7.1 Overview

CampPulse applies four primary design patterns across its architecture. Each pattern is documented with its rationale, where it is applied, how it is implemented in this specific codebase, and what problem it solves. These are not academic exercises — every pattern listed here is load-bearing. Removing any one of them degrades either correctness, performance, or resilience in a measurable way.

| Pattern | Primary concern | Where applied |
|---|---|---|
| Event-Driven Architecture | Decoupling and reactivity | System-wide |
| Publisher/Subscriber | Async fan-out | Redis pub/sub channels |
| CQRS | Read/write separation | All services |
| Circuit Breaker | Resilience | External dependencies |

---

## 7.2 Event-Driven Architecture

### 7.2.1 Rationale

CampPulse is fundamentally a reactive system. A location ping is not just a data point — it is a signal that may trigger congestion detection, rerouting, notification dispatch, and mobility index updates simultaneously. A reported incident is not just a database write — it restricts a road, invalidates route caches, notifies nearby users, and alerts admin. Modelling these as synchronous request-response chains would create tight coupling, cascading latency, and a system where every service needs to know about every other service.

Event-driven architecture inverts this. A service produces an event when something meaningful happens. It does not know or care who consumes it. Consumers react independently, at their own pace, without the producer waiting. The system remains coherent without being coupled.

### 7.2.2 Event Taxonomy

Every event in CampPulse is categorised by the state change it represents:

```
Domain events — something happened in the business domain
  incident.created
  incident.resolved
  incident.status

Infrastructure events — something changed in the system's operational state
  congestion.flagged
  congestion.confirmed
  congestion.cleared
  congestion.anticipated
  routing.cache_invalidated

Stream events — continuous data flow (not pub/sub — WebSocket direct)
  location_ping
  route_update
  zone_alert
```

### 7.2.3 Event Schema Convention

Every event published to Redis follows a consistent envelope:

```python
# core/events.py

from dataclasses import dataclass
from typing import Any
import time
import uuid

@dataclass
class Event:
    event_id: str           # UUID — idempotency key
    event_type: str         # Dot-namespaced string e.g. "incident.created"
    payload: dict           # Event-specific data
    timestamp: int          # Unix timestamp
    source_service: str     # Emitting service name

    @classmethod
    def create(cls, event_type: str, payload: dict, source: str) -> "Event":
        return cls(
            event_id=str(uuid.uuid4()),
            event_type=event_type,
            payload=payload,
            timestamp=int(time.time()),
            source_service=source
        )

    def to_json(self) -> str:
        import json
        return json.dumps({
            "event_id":      self.event_id,
            "event_type":    self.event_type,
            "payload":       self.payload,
            "timestamp":     self.timestamp,
            "source_service": self.source_service
        })
```

### 7.2.4 Event Flow — Incident Created

```
IncidentService.create_incident()
        │
        ├── Write to PostgreSQL (COMMAND path)
        │
        └── Publish Event:
            {
              event_type: "incident.created",
              payload: {
                incident_id, type, location,
                severity, zone, segment_id
              }
            }
                    │
          ┌─────────┼──────────┐
          ▼         ▼          ▼
    RoutingService  NotificationService  (future: AnalyticsService)
    Restricts       Notifies admin       Records event
    segment         + nearby users       for analytics
    Invalidates
    route cache
    Broadcasts
    route_update
    to navigators
```

### 7.2.5 Implementation — Event Publisher Base Class

```python
# core/publisher.py

import json
import logging
from core.redis import get_redis
from core.events import Event

logger = logging.getLogger(__name__)

class EventPublisher:
    """
    Base class for all services that emit events.
    Wraps Redis PUBLISH with logging and error isolation.
    A publish failure never propagates to the caller —
    the primary operation (DB write) has already succeeded.
    """

    def __init__(self, service_name: str):
        self.service_name = service_name

    async def publish(self, event_type: str, payload: dict) -> None:
        event = Event.create(event_type, payload, self.service_name)
        try:
            redis = await get_redis()
            await redis.publish(event_type, event.to_json())
            logger.info(f"Published {event_type} [{event.event_id}]")
        except Exception as e:
            # Publish failure is non-fatal — log and continue
            logger.error(f"Failed to publish {event_type}: {e}")
```

### 7.2.6 Implementation — Event Subscriber Base Class

```python
# core/subscriber.py

import json
import asyncio
import logging
from typing import Callable, Awaitable
from core.redis import get_redis

logger = logging.getLogger(__name__)

class EventSubscriber:
    """
    Base class for all services that consume events.
    Manages channel subscription lifecycle, deserialization,
    and per-message error isolation — a handler failure
    does not kill the subscription loop.
    """

    def __init__(self, channels: list[str], handler: Callable[[dict], Awaitable[None]]):
        self.channels = channels
        self.handler = handler

    async def listen(self) -> None:
        redis = await get_redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(*self.channels)
        logger.info(f"Subscribed to channels: {self.channels}")

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                event = json.loads(message["data"])
                await self.handler(event)
            except Exception as e:
                logger.error(
                    f"Handler failed for message on {message['channel']}: {e}",
                    exc_info=True
                )
                # Continue listening — one bad message does not stop the subscriber

    async def start(self) -> None:
        asyncio.create_task(self.listen())
```

---

## 7.3 Publisher/Subscriber Pattern

### 7.3.1 Rationale

Pub/Sub extends event-driven architecture with a many-to-many fan-out capability. When a congestion zone is confirmed, the Routing Service, Notification Service, and Real-Time Location Service all need to react — but the Congestion Detection Engine should not call each of them directly. That would couple the engine to its consumers and require it to be updated every time a new consumer is added.

Redis Pub/Sub provides the fan-out layer. The engine publishes once to a channel. Every subscriber on that channel receives the message independently.

### 7.3.2 Channel Registry

```python
# packages/constants/src/channels.py

class Channels:
    # Location
    LOCATION_PING           = "location.ping"

    # Incident
    INCIDENT_CREATED        = "incident.created"
    INCIDENT_RESOLVED       = "incident.resolved"
    INCIDENT_STATUS         = "incident.status"

    # Congestion
    CONGESTION_FLAGGED      = "congestion.flagged"
    CONGESTION_CONFIRMED    = "congestion.confirmed"
    CONGESTION_CLEARED      = "congestion.cleared"
    CONGESTION_ANTICIPATED  = "congestion.anticipated"

    # Routing
    ROUTING_CACHE_INVALIDATED = "routing.cache_invalidated"
```

### 7.3.3 Subscriber Startup — Service Registration

Each service registers its subscribers on application startup via FastAPI lifespan events:

```python
# services/routing/subscriber.py

from core.subscriber import EventSubscriber
from core.channels import Channels
from services.routing.graph import restrict_segment, clear_segment_restriction
from services.routing.cache import invalidate_routes_for_segment

class RoutingEventSubscriber(EventSubscriber):
    def __init__(self):
        super().__init__(
            channels=[
                Channels.INCIDENT_CREATED,
                Channels.INCIDENT_RESOLVED,
                Channels.CONGESTION_CONFIRMED,
                Channels.CONGESTION_CLEARED
            ],
            handler=self.handle
        )

    async def handle(self, event: dict) -> None:
        match event["event_type"]:
            case "incident.created":
                await restrict_segment(
                    location=event["payload"]["location"],
                    reason=event["payload"]["type"]
                )
                await invalidate_routes_for_segment(
                    event["payload"].get("segment_id")
                )

            case "incident.resolved":
                await clear_segment_restriction(
                    location=event["payload"]["location"]
                )

            case "congestion.confirmed":
                await soft_restrict_zone(
                    zone=event["payload"]["zone_id"],
                    severity=event["payload"]["severity"]
                )

            case "congestion.cleared":
                await restore_zone_routes(
                    zone=event["payload"]["zone_id"]
                )
```

```python
# apps/api/main.py — startup registration

from contextlib import asynccontextmanager
from fastapi import FastAPI
from services.routing.subscriber import RoutingEventSubscriber
from services.congestion.subscriber import CongestionEventSubscriber
from services.notification.subscriber import NotificationEventSubscriber
from services.realtime.subscriber import RealtimeEventSubscriber

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start all event subscribers on application boot
    await RoutingEventSubscriber().start()
    await CongestionEventSubscriber().start()
    await NotificationEventSubscriber().start()
    await RealtimeEventSubscriber().start()
    yield
    # Cleanup on shutdown handled by Redis connection pool

app = FastAPI(lifespan=lifespan)
```

### 7.3.4 Idempotency

Event handlers are designed to be idempotent — processing the same event twice produces the same result as processing it once. This is critical because Redis Pub/Sub offers at-most-once delivery; if a subscriber restarts mid-message, it may re-process on reconnect.

```python
async def restrict_segment(location: dict, reason: str) -> None:
    segment = await find_nearest_segment(location)
    if not segment or segment.is_restricted:
        return  # Already restricted — idempotent, safe to skip
    await db.execute("""
        UPDATE road_segments
        SET is_restricted = TRUE,
            restriction_reason = $1,
            restricted_since = NOW()
        WHERE id = $2
          AND is_restricted = FALSE  -- guard against concurrent updates
    """, reason, segment.id)
```

---

## 7.4 CQRS — Command Query Responsibility Segregation

### 7.4.1 Rationale

CampPulse has two fundamentally different data access profiles operating simultaneously:

- **Write path (Commands):** High-frequency, low-compute per operation. Location pings, incident reports, status updates, upvotes. These are append-heavy, time-sensitive, and must not block each other.
- **Read path (Queries):** Variable frequency, potentially expensive. Admin dashboard aggregations, hotspot calculations, equity metrics, incident history. These involve joins, aggregations, and spatial computations that can take hundreds of milliseconds.

Without separation, a heavy analytics query on the admin dashboard can hold database connections and degrade write performance for incident reporting — precisely when the system is under its most load. CQRS prevents this by making the separation explicit in the code and data access patterns.

### 7.4.2 Implementation Pattern

Every service separates its command (write) and query (read) paths into distinct functions. Commands write to PostgreSQL and publish events. Queries read from PostgreSQL (for complex joins) or Redis (for hot data that has already been computed).

```python
# services/incident/service.py

# ── COMMAND PATH ──────────────────────────────────────────────────────

async def create_incident(data: IncidentCreate, reporter_id: str | None) -> Incident:
    """
    COMMAND — writes incident to DB, emits event, returns minimal confirmation.
    Fast path: insert + publish. No joins. No aggregations.
    """
    # Duplicate check (spatial query — indexed, O(log N))
    duplicate = await check_and_handle_duplicate(
        data.type, (data.lat, data.lon), reporter_id
    )
    if duplicate.is_duplicate:
        return IncidentCreateResult(is_duplicate=True, parent_id=duplicate.parent_id)

    # Write to DB
    incident = await db.fetchrow("""
        INSERT INTO incidents (reporter_id, type, description, photo_url,
                               location, address_label, zone, severity, department)
        VALUES ($1, $2, $3, $4,
                ST_SetSRID(ST_Point($5, $6), 4326), $7, $8, $9, $10)
        RETURNING id, status, department, created_at
    """, reporter_id, data.type, data.description, data.photo_url,
         data.lon, data.lat, data.address_label, data.zone,
         data.severity, resolve_department(data.type))

    # Publish event — non-blocking, non-fatal on failure
    await publisher.publish("incident.created", {
        "incident_id": str(incident["id"]),
        "type":        data.type,
        "location":    {"lat": data.lat, "lon": data.lon},
        "severity":    data.severity,
        "zone":        data.zone
    })

    return IncidentCreateResult(
        incident_id=incident["id"],
        status=incident["status"],
        department=incident["department"]
    )


async def update_incident_status(
    incident_id: str,
    status: str,
    note: str | None,
    admin_id: str
) -> None:
    """
    COMMAND — status transition only. Validates transition, writes, publishes.
    """
    valid_transitions = {
        "submitted":   ["assigned"],
        "assigned":    ["in_progress"],
        "in_progress": ["resolved"],
        "resolved":    ["closed"]
    }
    current = await db.fetchval(
        "SELECT status FROM incidents WHERE id = $1", incident_id
    )
    if status not in valid_transitions.get(current, []):
        raise InvalidStatusTransition(current, status)

    await db.execute("""
        UPDATE incidents
        SET status = $1, updated_at = NOW(),
            resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
        WHERE id = $2
    """, status, incident_id)

    await publisher.publish("incident.status", {
        "incident_id": incident_id,
        "status":      status,
        "note":        note
    })


# ── QUERY PATH ────────────────────────────────────────────────────────

async def get_incident(incident_id: str) -> IncidentDetail:
    """
    QUERY — full incident detail with comments. Read-only. No side effects.
    """
    incident = await db.fetchrow("""
        SELECT i.*,
               u.full_name AS reporter_name,
               a.full_name AS assignee_name
        FROM incidents i
        LEFT JOIN users u ON u.id = i.reporter_id
        LEFT JOIN users a ON a.id = i.assigned_to
        WHERE i.id = $1
    """, incident_id)

    comments = await db.fetch("""
        SELECT c.*, u.full_name AS author_name
        FROM incident_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.incident_id = $1
        ORDER BY c.created_at ASC
    """, incident_id)

    return IncidentDetail.from_records(incident, comments)


async def get_incidents_nearby(
    lat: float, lon: float, radius: int, page: int, page_size: int
) -> PaginatedResult:
    """
    QUERY — spatial read. Expensive but isolated from write path.
    """
    offset = (page - 1) * page_size
    rows = await db.fetch("""
        SELECT id, type, severity, status, address_label, upvote_count,
               ST_Distance(
                   location::geography,
                   ST_SetSRID(ST_Point($1, $2), 4326)::geography
               ) AS distance_metres
        FROM incidents
        WHERE status NOT IN ('resolved', 'closed')
          AND ST_DWithin(
              location::geography,
              ST_SetSRID(ST_Point($1, $2), 4326)::geography,
              $3
          )
        ORDER BY distance_metres ASC
        LIMIT $4 OFFSET $5
    """, lon, lat, radius, page_size, offset)

    total = await db.fetchval("""
        SELECT COUNT(*) FROM incidents
        WHERE status NOT IN ('resolved', 'closed')
          AND ST_DWithin(
              location::geography,
              ST_SetSRID(ST_Point($1, $2), 4326)::geography,
              $3
          )
    """, lon, lat, radius)

    return PaginatedResult(rows=rows, total=total, page=page, page_size=page_size)
```

### 7.4.3 Redis as the Query Cache Layer

For the admin dashboard and any query that aggregates across many records, the CQRS read path goes through Redis before hitting PostgreSQL:

```python
async def get_dashboard_summary() -> DashboardSummary:
    """
    QUERY — admin dashboard summary.
    Attempts Redis cache first (O(1)), falls back to DB aggregation (O(N)).
    Cache is invalidated by relevant command events.
    """
    cache_key = "admin:dashboard:summary"
    cached = await redis.get(cache_key)
    if cached:
        return DashboardSummary(**json.loads(cached))

    # Cache miss — compute from DB
    summary = await compute_dashboard_summary_from_db()

    # Cache for 30 seconds — short TTL, data is live
    await redis.setex(cache_key, 30, json.dumps(summary.dict()))
    return summary
```

### 7.4.4 CQRS Applied Per Service

| Service | Command operations | Query operations |
|---|---|---|
| Incident | create, update_status, assign, upvote, comment | get, list, nearby, by_zone |
| User | register, update_profile, update_role, update_kyc | get_me, list_drivers |
| Routing | restrict_segment, clear_segment, invalidate_cache | calculate_route, get_restricted |
| Congestion | ingest_ping, flag_zone, confirm_zone, clear_zone | get_zone_state, get_mobility_index |
| Admin | bulk_update, assign, broadcast | dashboard_summary, hotspots, equity_metrics |

---

## 7.5 Circuit Breaker Pattern

### 7.5.1 Rationale

CampPulse depends on three external services whose availability it cannot control — Mapbox, GCP Cloud Storage, and OpenRouteService. During a hackathon demo, a slow or failed Mapbox call that blocks for 30 seconds before timing out is indistinguishable from the entire system being broken. The circuit breaker prevents this by tracking failure rates per dependency and short-circuiting calls to failing dependencies before they are even attempted — returning a cached fallback or a graceful error immediately.

### 7.5.2 States

```
CLOSED → Normal operation. Requests pass through. Failures are counted.
         If failure_count >= threshold within window → trip to OPEN.

OPEN   → Dependency is failing. All requests short-circuit immediately.
         Returns fallback or raises ServiceUnavailable.
         After recovery_timeout → transition to HALF_OPEN.

HALF_OPEN → Recovery probe. One request allowed through.
            Success → CLOSED (reset counters).
            Failure → OPEN again (restart recovery timer).
```

### 7.5.3 Implementation

```python
# core/circuit_breaker.py

import time
import asyncio
import logging
from enum import Enum
from typing import Callable, Awaitable, Any, TypeVar

logger = logging.getLogger(__name__)
T = TypeVar("T")

class CircuitState(Enum):
    CLOSED    = "closed"
    OPEN      = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    """
    Per-dependency circuit breaker.

    Args:
        name:             Dependency name (for logging)
        failure_threshold: Failures within window before tripping
        recovery_timeout:  Seconds before attempting recovery probe
        window_seconds:    Rolling window for failure counting
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 30,
        window_seconds: int = 60
    ):
        self.name              = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout  = recovery_timeout
        self.window_seconds    = window_seconds

        self._state            = CircuitState.CLOSED
        self._failure_count    = 0
        self._last_failure_at  = 0.0
        self._opened_at        = 0.0
        self._lock             = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.time() - self._opened_at >= self.recovery_timeout:
                return CircuitState.HALF_OPEN
        return self._state

    async def call(
        self,
        func: Callable[..., Awaitable[T]],
        *args,
        fallback: Callable[..., Awaitable[T]] | None = None,
        **kwargs
    ) -> T:
        """
        Execute func through the circuit breaker.
        If circuit is OPEN and fallback is provided, returns fallback result.
        If circuit is OPEN and no fallback, raises ServiceUnavailableError.

        Complexity: O(1) state check + O(func) execution
        """
        current_state = self.state

        if current_state == CircuitState.OPEN:
            logger.warning(f"Circuit OPEN for {self.name} — short-circuiting")
            if fallback:
                return await fallback(*args, **kwargs)
            raise ServiceUnavailableError(f"{self.name} is currently unavailable")

        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure(e)
            if fallback:
                return await fallback(*args, **kwargs)
            raise

    async def _on_success(self) -> None:
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                logger.info(f"Circuit CLOSED for {self.name} — recovery successful")
            self._state = CircuitState.CLOSED
            self._failure_count = 0

    async def _on_failure(self, error: Exception) -> None:
        async with self._lock:
            now = time.time()

            # Reset counter if outside rolling window
            if now - self._last_failure_at > self.window_seconds:
                self._failure_count = 0

            self._failure_count += 1
            self._last_failure_at = now

            logger.warning(
                f"Circuit failure {self._failure_count}/{self.failure_threshold} "
                f"for {self.name}: {error}"
            )

            if self._failure_count >= self.failure_threshold:
                self._state     = CircuitState.OPEN
                self._opened_at = now
                logger.error(f"Circuit OPEN for {self.name} — threshold reached")


class ServiceUnavailableError(Exception):
    pass
```

### 7.5.4 Circuit Breaker Registry

```python
# core/circuit_breakers.py

from core.circuit_breaker import CircuitBreaker

# One breaker per external dependency
mapbox_breaker = CircuitBreaker(
    name="mapbox",
    failure_threshold=3,
    recovery_timeout=20,
    window_seconds=60
)

gcp_storage_breaker = CircuitBreaker(
    name="gcp_storage",
    failure_threshold=5,
    recovery_timeout=30,
    window_seconds=60
)

openrouteservice_breaker = CircuitBreaker(
    name="openrouteservice",
    failure_threshold=3,
    recovery_timeout=20,
    window_seconds=60
)
```

### 7.5.5 Usage in Routing Service

```python
# services/routing/mapbox.py

from core.circuit_breakers import mapbox_breaker, openrouteservice_breaker
from services.routing.cache import get_last_valid_route

async def get_route_from_mapbox(origin, destination, mode, avoid_points):
    return await mapbox_breaker.call(
        _call_mapbox_api,
        origin, destination, mode, avoid_points,
        fallback=_fallback_to_openrouteservice
    )

async def _fallback_to_openrouteservice(origin, destination, mode, avoid_points):
    return await openrouteservice_breaker.call(
        _call_openrouteservice_api,
        origin, destination, mode, avoid_points,
        fallback=_fallback_to_cached_route
    )

async def _fallback_to_cached_route(origin, destination, mode, avoid_points):
    """
    Last resort — return last valid cached route for this origin/destination pair.
    Route may be stale but is better than no route at all.
    Adds a staleness warning to the response.
    """
    cached = await get_last_valid_route(origin, destination)
    if cached:
        cached["stale"] = True
        cached["warning"] = "Route may not reflect current road conditions."
        return cached
    raise ServiceUnavailableError("Navigation temporarily unavailable.")
```

---

## 7.6 Pattern Interaction Map

The four patterns do not operate in isolation — they form a coherent system where each pattern handles a different failure mode or architectural concern:

```
USER ACTION (e.g. incident report)
        │
        ▼
CQRS — Command path executes
        │ DB write succeeds
        │
        ▼
Event-Driven — Event published
        │
        ▼
Pub/Sub — Event fans out to N consumers
        │
   ┌────┴────┬────────────┐
   ▼         ▼            ▼
Routing   Notification  Realtime
Service   Service       Location Svc
   │
   ▼
Circuit Breaker wraps Mapbox call
        │
   ┌────┴────┐
CLOSED     OPEN
   │         │
Mapbox    Fallback route
succeeds  (ORS or cached)
   │         │
   └────┬────┘
        ▼
Route update broadcast
to active navigators
(Event-Driven + Pub/Sub)
        │
        ▼
CQRS — Query path serves
updated route to client
```

---

## 7.7 Patterns Not Used and Why

**Saga Pattern** — applicable for distributed transactions spanning multiple services. CampPulse does not have multi-service transactions in the MVP. Incident creation is a single atomic operation. If the event publish fails, the incident still exists in the DB and the system recovers on the next relevant trigger. No saga needed.

**Repository Pattern** — commonly layered on top of database access. Adds indirection without meaningful benefit in FastAPI + asyncpg where the query layer is already explicit and testable. Direct async DB calls with Pydantic validation are sufficient for this scale.

**Saga/Outbox Pattern** — for guaranteed event delivery (at-least-once). Redis Pub/Sub is at-most-once. For the hackathon MVP this is acceptable — missed events self-correct on the next trigger. Post-hackathon, the outbox pattern (events written to a DB table, polled by a relay) should be introduced for critical events like emergency dispatch.

---

*Next: Section 8 — Abstraction Levels*
