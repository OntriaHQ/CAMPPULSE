# CampPulse — Technical Documentation
**Section 10: Testing Strategy**

---

# Section 10: Testing Strategy

## 10.1 Philosophy

Testing in CampPulse serves three purposes: correctness verification, regression prevention, and confidence in deployment. Every test exists to answer a specific question. Tests that answer no clear question get deleted.

The testing pyramid for CampPulse:

```
        ▲
       /E2E\          Few — full lifecycle flows, demo scenarios
      /──────\
     /  Integ  \      Moderate — service boundaries, event propagation
    /────────────\
   /     Unit     \   Many — algorithms, domain rules, pure functions
  /────────────────\
```

**Unit tests** are fast, isolated, and numerous. They test logic that has no external dependencies — algorithms, domain rules, validators, pure functions. They run in milliseconds and give immediate feedback.

**Integration tests** verify that components work correctly together — service functions with real database operations, event publish/subscribe flows, WebSocket message handling, and Redis operations. They use a test database and test Redis instance, not mocks.

**End-to-end tests** execute full user-facing lifecycles against a running application instance. They are few, deliberately chosen, and correspond directly to the demo flow scenarios. They are slow but definitive.

**App dry runs** are manual full-lifecycle tests conducted on a real device against the staging environment. They are not automated but are gated — no milestone passes without its dry run scenario completed.

---

## 10.2 Test Infrastructure

### 10.2.1 Test Environment Setup

```yaml
# infra/docker-compose.test.yml

version: "3.9"
services:
  postgres_test:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB:       camppulse_test
      POSTGRES_USER:     camppulse
      POSTGRES_PASSWORD: testpassword
    ports:
      - "5433:5432"   # Different port — avoids collision with dev DB

  redis_test:
    image: redis:7-alpine
    ports:
      - "6380:6379"   # Different port — avoids collision with dev Redis
```

### 10.2.2 Pytest Configuration

```toml
# apps/api/pyproject.toml

[tool.pytest.ini_options]
asyncio_mode    = "auto"
testpaths       = ["tests"]
python_files    = ["test_*.py"]
python_classes  = ["Test*"]
python_functions= ["test_*"]
markers = [
    "unit: pure unit tests — no I/O",
    "integration: tests with real DB and Redis",
    "e2e: full lifecycle tests against running app",
    "slow: tests that take > 1 second"
]

[tool.coverage.run]
source  = ["services", "core", "gateway"]
omit    = ["*/migrations/*", "*/tests/*"]

[tool.coverage.report]
fail_under = 70   # Minimum coverage gate for CI
```

### 10.2.3 Shared Test Fixtures

```python
# tests/conftest.py

import pytest
import asyncio
import asyncpg
import aioredis
import httpx
from typing import AsyncGenerator
from main import create_app

TEST_DB_URL    = "postgresql://camppulse:testpassword@localhost:5433/camppulse_test"
TEST_REDIS_URL = "redis://localhost:6380"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def db_pool() -> AsyncGenerator:
    """Session-scoped DB pool — created once, shared across all tests."""
    pool = await asyncpg.create_pool(TEST_DB_URL)
    yield pool
    await pool.close()

@pytest.fixture(scope="session")
async def redis_client() -> AsyncGenerator:
    """Session-scoped Redis client."""
    client = await aioredis.from_url(TEST_REDIS_URL)
    yield client
    await client.close()

@pytest.fixture(autouse=True)
async def clean_db(db_pool):
    """
    Transaction-based test isolation.
    Each test runs in a transaction that is rolled back on completion.
    Zero data leaks between tests. No truncation overhead.
    """
    async with db_pool.acquire() as conn:
        transaction = conn.transaction()
        await transaction.start()
        yield conn
        await transaction.rollback()

@pytest.fixture(autouse=True)
async def clean_redis(redis_client):
    """Flush test Redis before each test."""
    await redis_client.flushdb()
    yield redis_client

@pytest.fixture(scope="session")
async def app_client() -> AsyncGenerator:
    """Async HTTP client against the running test app."""
    app = create_app()
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
async def resident_token(app_client) -> str:
    """Pre-created resident auth token for tests that need authentication."""
    r = await app_client.post("/api/v1/auth/register", json={
        "email":     "resident@test.camppulse",
        "password":  "testpassword",
        "full_name": "Test Resident",
        "role":      "resident"
    })
    return r.json()["data"]["tokens"]["access_token"]

@pytest.fixture
async def admin_token(app_client) -> str:
    """Pre-created admin auth token."""
    r = await app_client.post("/api/v1/auth/register", json={
        "email":     "admin@test.camppulse",
        "password":  "testpassword",
        "full_name": "Test Admin",
        "role":      "admin"
    })
    return r.json()["data"]["tokens"]["access_token"]

@pytest.fixture
async def driver_token(app_client) -> str:
    """Pre-created driver auth token."""
    r = await app_client.post("/api/v1/auth/register", json={
        "email":     "driver@test.camppulse",
        "password":  "testpassword",
        "full_name": "Test Driver",
        "role":      "driver"
    })
    return r.json()["data"]["tokens"]["access_token"]

@pytest.fixture
async def seeded_incident(app_client, resident_token) -> dict:
    """Pre-created incident for tests that need an existing incident."""
    r = await app_client.post("/api/v1/incidents", data={
        "type":     "flooding",
        "lat":      "6.9271",
        "lon":      "3.3958",
        "severity": "high"
    }, headers={"Authorization": f"Bearer {resident_token}"})
    return r.json()["data"]
```

---

## 10.3 Unit Tests

Unit tests cover every function that contains logic and has no external dependencies. Target: 100% coverage on all algorithm files and domain rule files.

### 10.3.1 Polyline Encoding

```python
# tests/unit/test_polyline.py

import pytest
from services.routing.polyline import encode_polyline, decode_polyline

class TestPolylineEncoding:

    def test_encode_returns_non_empty_string(self):
        coords = [(6.9271, 3.3958), (6.9310, 3.4001)]
        result = encode_polyline(coords)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_round_trip_lossless(self):
        """Decode(encode(coords)) == coords within 1e-5 precision."""
        coords = [
            (6.92710, 3.39580),
            (6.92850, 3.39750),
            (6.93100, 3.40010)
        ]
        encoded = encode_polyline(coords)
        decoded = decode_polyline(encoded)
        assert len(decoded) == len(coords)
        for original, recovered in zip(coords, decoded):
            assert abs(original[0] - recovered[0]) < 1e-5
            assert abs(original[1] - recovered[1]) < 1e-5

    def test_single_point(self):
        coords = [(6.9271, 3.3958)]
        assert decode_polyline(encode_polyline(coords)) == [(6.9271, 3.3958)]

    def test_negative_coordinates(self):
        """Southern hemisphere coordinates encode/decode correctly."""
        coords = [(-33.8688, 151.2093)]
        recovered = decode_polyline(encode_polyline(coords))
        assert abs(recovered[0][0] - (-33.8688)) < 1e-5

    def test_compression_ratio(self):
        """Encoded polyline is at least 80% smaller than raw JSON."""
        import json
        coords = [(6.9271 + i*0.0001, 3.3958 + i*0.0001) for i in range(80)]
        raw_size    = len(json.dumps([{"lat": c[0], "lon": c[1]} for c in coords]))
        encoded_size = len(encode_polyline(coords))
        compression  = 1 - (encoded_size / raw_size)
        assert compression >= 0.80, f"Compression only {compression:.1%}"

    def test_empty_coordinates(self):
        assert encode_polyline([]) == ""
        assert decode_polyline("") == []
```

### 10.3.2 Congestion Window Logic

```python
# tests/unit/test_congestion_windows.py

import pytest
from services.congestion.severity import score_severity
from services.congestion.windows import get_window_id
from unittest.mock import patch

class TestSeverityScoring:

    @pytest.mark.parametrize("ping_count,threshold,expected", [
        (50,  50, "low"),       # exactly at threshold
        (75,  50, "medium"),    # 1.5x
        (100, 50, "high"),      # 2x
        (150, 50, "critical"),  # 3x
        (51,  50, "low"),       # just above threshold
        (149, 50, "high"),      # just below critical
    ])
    def test_severity_boundaries(self, ping_count, threshold, expected):
        assert score_severity(ping_count, threshold) == expected

    def test_severity_never_raises_on_valid_input(self):
        for count in range(50, 300, 10):
            result = score_severity(count, 50)
            assert result in ("low", "medium", "high", "critical")

class TestWindowId:

    def test_window_id_deterministic(self):
        """Same zone and timestamp always produces same window ID."""
        wid1 = get_window_id("zone_a", 1716912000)
        wid2 = get_window_id("zone_a", 1716912000)
        assert wid1 == wid2

    def test_different_zones_different_ids(self):
        wid_a = get_window_id("zone_a", 1716912000)
        wid_b = get_window_id("zone_b", 1716912000)
        assert wid_a != wid_b

    def test_timestamps_in_same_window_bucket(self):
        """Two timestamps within 90s of each other share a window ID."""
        wid1 = get_window_id("zone_a", 1716912000)
        wid2 = get_window_id("zone_a", 1716912089)  # 89s later
        assert wid1 == wid2

    def test_timestamps_in_different_window_buckets(self):
        wid1 = get_window_id("zone_a", 1716912000)
        wid2 = get_window_id("zone_a", 1716912090)  # 90s later — new window
        assert wid1 != wid2
```

### 10.3.3 Domain Rules

```python
# tests/unit/test_domain_rules.py

import pytest
from services.incident.routing import (
    resolve_department,
    is_valid_transition,
    estimate_response_window
)

class TestDepartmentRouting:

    @pytest.mark.parametrize("incident_type,expected_dept", [
        ("flooding",    "infrastructure"),
        ("pothole",     "infrastructure"),
        ("streetlight", "utilities"),
        ("water_leak",  "utilities"),
        ("trash",       "sanitation"),
        ("security",    "security"),
        ("congestion",  "infrastructure"),
        ("other",       "infrastructure"),  # default
    ])
    def test_routing_is_exhaustive(self, incident_type, expected_dept):
        assert resolve_department(incident_type) == expected_dept

    def test_unknown_type_falls_back_to_infrastructure(self):
        assert resolve_department("unknown_type") == "infrastructure"

class TestStatusTransitions:

    @pytest.mark.parametrize("current,next_status,valid", [
        ("submitted",   "assigned",    True),
        ("assigned",    "in_progress", True),
        ("in_progress", "resolved",    True),
        ("resolved",    "closed",      True),
        ("submitted",   "resolved",    False),   # skip step
        ("submitted",   "closed",      False),   # skip multiple steps
        ("resolved",    "submitted",   False),   # backward
        ("closed",      "resolved",    False),   # reopen
        ("in_progress", "submitted",   False),   # backward
    ])
    def test_transition_validity(self, current, next_status, valid):
        assert is_valid_transition(current, next_status) == valid

class TestResponseWindowEstimation:

    def test_critical_security_is_fastest(self):
        window = estimate_response_window("critical", "security")
        assert "15" in window or "30" in window

    def test_low_sanitation_is_slowest(self):
        window = estimate_response_window("low", "sanitation")
        assert "day" in window

    def test_returns_string_for_all_valid_combinations(self):
        severities = ["low", "medium", "high", "critical"]
        departments = ["infrastructure", "sanitation", "security", "utilities"]
        for s in severities:
            for d in departments:
                result = estimate_response_window(s, d)
                assert isinstance(result, str)
                assert len(result) > 0
```

### 10.3.4 Haversine Distance

```python
# tests/unit/test_dispatch.py

import pytest
from services.congestion.engine import haversine_distance

class TestHaversineDistance:

    def test_same_point_is_zero(self):
        dist = haversine_distance((6.9271, 3.3958), (6.9271, 3.3958))
        assert dist == pytest.approx(0.0, abs=0.01)

    def test_known_distance(self):
        """
        Coordinates approximately 100m apart.
        Haversine should return ~100 ± 5 metres.
        """
        dist = haversine_distance((6.9271, 3.3958), (6.9280, 3.3958))
        assert 90 < dist < 115

    def test_symmetry(self):
        """Distance A→B equals distance B→A."""
        a = (6.9271, 3.3958)
        b = (6.9310, 3.4001)
        assert haversine_distance(a, b) == pytest.approx(haversine_distance(b, a), rel=1e-6)

    def test_displacement_threshold(self):
        """
        Verify the 100m displacement threshold used in mobility scoring.
        Points clearly below and above should classify correctly.
        """
        origin = (6.9271, 3.3958)
        below  = (6.9272, 3.3959)   # ~15m
        above  = (6.9285, 3.3975)   # ~200m

        assert haversine_distance(origin, below) < 100
        assert haversine_distance(origin, above) > 100
```

---

## 10.4 Integration Tests

Integration tests use a real test database and test Redis. They do not mock infrastructure. They verify that service functions, DB queries, event flows, and WebSocket handling work correctly together.

### 10.4.1 Auth Flow

```python
# tests/integration/test_auth_flow.py

import pytest
from services.auth.service import register_user, login_user, logout_user
from services.auth.security import verify_password, decode_token

@pytest.mark.integration
class TestAuthFlow:

    async def test_register_hashes_password(self, clean_db, clean_redis):
        result = await register_user({
            "email":     "test@example.com",
            "password":  "plaintext",
            "full_name": "Test User",
            "role":      "resident"
        })
        # Verify password is NOT stored as plaintext
        row = await clean_db.fetchrow(
            "SELECT password_hash FROM users WHERE email = $1", "test@example.com"
        )
        assert row["password_hash"] != "plaintext"
        assert verify_password("plaintext", row["password_hash"])

    async def test_login_returns_valid_tokens(self, clean_db, clean_redis):
        await register_user({
            "email": "test@example.com", "password": "pass",
            "full_name": "T", "role": "resident"
        })
        result = await login_user("test@example.com", "pass")
        payload = decode_token(result.access_token)
        assert payload["role"] == "resident"
        assert "user_id" in payload

    async def test_logout_blacklists_token(self, clean_db, clean_redis):
        reg = await register_user({
            "email": "test@example.com", "password": "pass",
            "full_name": "T", "role": "resident"
        })
        access_token = reg.tokens.access_token
        await logout_user(access_token)

        # Token JTI must now be in Redis blacklist
        jti = decode_token(access_token)["jti"]
        blacklisted = await clean_redis.exists(f"auth:blacklist:{jti}")
        assert blacklisted == 1

    async def test_duplicate_email_raises_conflict(self, clean_db, clean_redis):
        data = {"email": "same@example.com", "password": "p",
                "full_name": "A", "role": "resident"}
        await register_user(data)
        with pytest.raises(Exception) as exc:
            await register_user(data)
        assert "EMAIL_TAKEN" in str(exc.value)
```

### 10.4.2 Incident Lifecycle

```python
# tests/integration/test_incident_lifecycle.py

import pytest
import json
from services.incident.service import create_incident, update_incident_status
from services.incident.schemas import IncidentCreate

@pytest.mark.integration
class TestIncidentLifecycle:

    async def test_create_incident_assigns_zone(self, clean_db, clean_redis):
        """Zone is auto-detected from PostGIS point-in-polygon."""
        data = IncidentCreate(type="flooding", lat=6.9271, lon=3.3958, severity="high")
        result = await create_incident(data, photo=None, reporter=None)
        assert result.is_duplicate == False
        row = await clean_db.fetchrow(
            "SELECT zone FROM incidents WHERE id = $1", result.incident_id
        )
        assert row["zone"] is not None

    async def test_create_incident_publishes_event(self, clean_db, clean_redis):
        """incident.created event published to Redis on creation."""
        pubsub = clean_redis.pubsub()
        await pubsub.subscribe("incident.created")

        data = IncidentCreate(type="pothole", lat=6.9271, lon=3.3958, severity="low")
        await create_incident(data, photo=None, reporter=None)

        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=2.0)
        assert msg is not None
        event = json.loads(msg["data"])
        assert event["event_type"] == "incident.created"
        assert event["payload"]["type"] == "pothole"

    async def test_duplicate_detection_within_50m(self, clean_db, clean_redis):
        data1 = IncidentCreate(type="flooding", lat=6.9271, lon=3.3958, severity="high")
        result1 = await create_incident(data1, photo=None, reporter=None)
        assert result1.is_duplicate == False

        # Submit identical type at 30m distance
        data2 = IncidentCreate(type="flooding", lat=6.92713, lon=3.39584, severity="medium")
        result2 = await create_incident(data2, photo=None, reporter=None)
        assert result2.is_duplicate == True
        assert str(result2.parent_incident_id) == str(result1.incident_id)

    async def test_duplicate_not_triggered_beyond_50m(self, clean_db, clean_redis):
        data1 = IncidentCreate(type="flooding", lat=6.9271, lon=3.3958, severity="high")
        await create_incident(data1, photo=None, reporter=None)

        # Submit same type at 100m distance
        data2 = IncidentCreate(type="flooding", lat=6.9280, lon=3.3958, severity="medium")
        result2 = await create_incident(data2, photo=None, reporter=None)
        assert result2.is_duplicate == False

    async def test_status_transition_enforced(self, clean_db, clean_redis, seeded_incident):
        incident_id = seeded_incident["incident_id"]

        # Valid transition: submitted → assigned
        await update_incident_status(incident_id, "assigned", note=None, admin_id="admin")
        row = await clean_db.fetchrow(
            "SELECT status FROM incidents WHERE id = $1", incident_id
        )
        assert row["status"] == "assigned"

        # Invalid transition: assigned → resolved (must go through in_progress)
        from core.exceptions import InvalidStatusTransition
        with pytest.raises(InvalidStatusTransition):
            await update_incident_status(incident_id, "resolved", note=None, admin_id="admin")
```

### 10.4.3 Routing Pipeline

```python
# tests/integration/test_routing_pipeline.py

import pytest
import asyncio
import json
from services.routing.service import calculate_route
from services.routing.polyline import decode_polyline

@pytest.mark.integration
class TestRoutingPipeline:

    async def test_route_calculation_returns_polyline(self, clean_db, clean_redis):
        result = await calculate_route(
            origin=(6.9271, 3.3958),
            destination=(6.9310, 3.4001),
            mode="walking"
        )
        assert result.encoded_polyline
        coords = decode_polyline(result.encoded_polyline)
        assert len(coords) > 0
        assert result.distance_metres > 0
        assert result.eta_seconds > 0

    async def test_route_cached_on_second_request(self, clean_db, clean_redis):
        origin = (6.9271, 3.3958)
        dest   = (6.9310, 3.4001)

        result1 = await calculate_route(origin, dest, "walking")
        assert result1.cached == False

        result2 = await calculate_route(origin, dest, "walking")
        assert result2.cached == True
        assert result2.encoded_polyline == result1.encoded_polyline

    async def test_incident_creates_restriction_and_reroutes(
        self, clean_db, clean_redis
    ):
        from services.incident.service import create_incident
        from services.incident.schemas import IncidentCreate

        origin = (6.9271, 3.3958)
        dest   = (6.9310, 3.4001)

        route_before = await calculate_route(origin, dest, "walking")

        # Submit incident near route midpoint
        await create_incident(
            IncidentCreate(type="flooding", lat=6.9285, lon=3.3975, severity="high"),
            photo=None, reporter=None
        )
        await asyncio.sleep(1)  # Allow event propagation

        route_after = await calculate_route(origin, dest, "walking")
        assert route_after.restricted_segments_avoided >= 1
        # Route geometry must differ
        assert route_after.encoded_polyline != route_before.encoded_polyline

    async def test_route_outside_boundary_rejected(self, clean_db, clean_redis):
        from core.exceptions import LocationOutsideBoundaryError
        with pytest.raises(LocationOutsideBoundaryError):
            await calculate_route(
                origin=(51.5074, -0.1278),  # London
                destination=(6.9310, 3.4001),
                mode="walking"
            )
```

### 10.4.4 Congestion Detection Pipeline

```python
# tests/integration/test_congestion_pipeline.py

import pytest
import asyncio
import json
from services.congestion.engine import ingest_ping
from services.congestion.windows import get_zone_state

@pytest.mark.integration
class TestCongestionPipeline:

    async def test_threshold_triggers_flag(self, clean_redis):
        """51 pings in Zone A within W1 should flag the zone."""
        zone_id = "zone_a"

        for i in range(51):
            await ingest_ping(
                user_id=f"user_{i}",
                lat=6.9271, lon=3.3958,
                timestamp=1716912000 + i
            )

        # Allow W1 evaluation
        await asyncio.sleep(0.5)

        state = await get_zone_state(zone_id)
        assert state is not None
        assert state["status"] in ("pending_validation", "congested")

    async def test_below_threshold_does_not_flag(self, clean_redis):
        """49 pings should not trigger a flag."""
        zone_id = "zone_a"

        for i in range(49):
            await ingest_ping(
                user_id=f"user_{i}",
                lat=6.9271, lon=3.3958,
                timestamp=1716912000 + i
            )

        await asyncio.sleep(0.5)
        state = await get_zone_state(zone_id)
        assert state is None or state["status"] == "clear"

    async def test_revalidation_clears_false_positive(self, clean_redis):
        """
        Flag is raised, then pings stop.
        W2 should clear the flag.
        """
        zone_id = "zone_a"

        # Raise flag
        for i in range(55):
            await ingest_ping(f"user_{i}", 6.9271, 3.3958, 1716912000 + i)

        await asyncio.sleep(0.5)
        state = await get_zone_state(zone_id)
        assert state["status"] == "pending_validation"

        # Stop pinging — W2 runs, count is below CLEAR_THRESHOLD
        # Manually advance revalidation (in test, use shortened window config)
        await asyncio.sleep(2)  # test config: W2 = 2 seconds

        state = await get_zone_state(zone_id)
        assert state is None  # Cleared — key deleted from Redis

    async def test_congestion_event_published_on_confirmation(self, clean_redis):
        """congestion.confirmed published when W2 confirms threshold."""
        pubsub = clean_redis.pubsub()
        await pubsub.subscribe("congestion.confirmed")

        for i in range(55):
            await ingest_ping(f"user_{i}", 6.9271, 3.3958, 1716912000 + i)

        # Wait for W1 + W2
        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=10.0)
        assert msg is not None
        event = json.loads(msg["data"])
        assert event["event_type"] == "congestion.confirmed"
        assert event["payload"]["zone_id"] == "zone_a"
```

### 10.4.5 WebSocket Streams

```python
# tests/integration/test_websocket_streams.py

import pytest
import asyncio
import json
import websockets

@pytest.mark.integration
class TestWebSocketStreams:

    async def test_authenticated_connection_accepted(self, resident_token):
        uri = f"ws://localhost:8000/ws/location?token={resident_token}"
        async with websockets.connect(uri) as ws:
            assert ws.open

    async def test_invalid_token_rejected(self):
        uri = "ws://localhost:8000/ws/location?token=invalid_token"
        with pytest.raises(websockets.exceptions.InvalidStatusCode) as exc:
            async with websockets.connect(uri):
                pass
        assert exc.value.status_code == 401

    async def test_guest_connection_accepted(self):
        uri = "ws://localhost:8000/ws/location/guest"
        async with websockets.connect(uri) as ws:
            assert ws.open

    async def test_location_ping_stored_in_redis(
        self, resident_token, clean_redis, user_id
    ):
        uri = f"ws://localhost:8000/ws/location?token={resident_token}"
        async with websockets.connect(uri) as ws:
            await ws.send(json.dumps({
                "type": "location_ping",
                "payload": {
                    "lat": 6.9271, "lon": 3.3958,
                    "accuracy": 10.0, "timestamp": 1716912000
                }
            }))
            await asyncio.sleep(0.3)
            location = await clean_redis.hgetall(f"location:user:{user_id}")
            assert location is not None

    async def test_out_of_boundary_ping_silently_dropped(
        self, resident_token, clean_redis, user_id
    ):
        uri = f"ws://localhost:8000/ws/location?token={resident_token}"
        async with websockets.connect(uri) as ws:
            await ws.send(json.dumps({
                "type": "location_ping",
                "payload": {
                    "lat": 51.5074, "lon": -0.1278,  # London — outside geofence
                    "accuracy": 10.0, "timestamp": 1716912000
                }
            }))
            await asyncio.sleep(0.3)
            # No Redis entry for this user
            exists = await clean_redis.exists(f"location:user:{user_id}")
            assert exists == 0

    async def test_zone_alert_broadcast_received(self, resident_token, clean_redis):
        """Manually publish congestion.confirmed → client receives zone_alert."""
        uri = f"ws://localhost:8000/ws/location?token={resident_token}"
        async with websockets.connect(uri) as ws:
            # First send a ping to register the user in Zone A
            await ws.send(json.dumps({
                "type": "location_ping",
                "payload": {"lat": 6.9271, "lon": 3.3958,
                            "accuracy": 5.0, "timestamp": 1716912000}
            }))
            await asyncio.sleep(0.3)

            # Manually publish congestion event
            await clean_redis.publish("congestion.confirmed", json.dumps({
                "event_type": "congestion.confirmed",
                "payload": {
                    "zone_id": "zone_a",
                    "severity": "high",
                    "confirmed_at": 1716912000
                }
            }))

            # Client should receive zone_alert
            msg = await asyncio.wait_for(ws.recv(), timeout=3.0)
            data = json.loads(msg)
            assert data["type"] == "zone_alert"
            assert data["payload"]["zone"] == "zone_a"
            assert data["payload"]["status"] == "congested"
```

---

## 10.5 End-to-End Tests

E2E tests run against a fully deployed staging instance. They execute the exact scenarios that appear in the demo flow. Automation covers the API layer; visual rendering is verified in the app dry run.

```python
# tests/e2e/test_resident_report_flow.py

import pytest
import httpx
import asyncio
import json
import websockets

STAGING_BASE = "https://api.camppulse.ng/api/v1"
STAGING_WS   = "wss://api.camppulse.ng/ws"

@pytest.mark.e2e
class TestResidentReportFlow:
    """
    Full lifecycle: resident submits incident → admin responds →
    routing updates → resident receives notification.
    """

    async def test_full_incident_lifecycle(self):
        async with httpx.AsyncClient(base_url=STAGING_BASE) as client:

            # 1. Register resident
            r = await client.post("/auth/register", json={
                "email":     f"e2e_resident_{int(time.time())}@test.com",
                "password":  "e2etest",
                "full_name": "E2E Resident",
                "role":      "resident"
            })
            assert r.status_code == 201
            resident_token = r.json()["data"]["tokens"]["access_token"]

            # 2. Connect WebSocket to receive notifications
            ws_uri = f"{STAGING_WS}/location?token={resident_token}"
            async with websockets.connect(ws_uri) as ws:

                # 3. Submit incident
                r = await client.post("/incidents", data={
                    "type":     "flooding",
                    "lat":      "6.9271",
                    "lon":      "3.3958",
                    "severity": "high"
                }, headers={"Authorization": f"Bearer {resident_token}"})
                assert r.status_code == 201
                incident_id = r.json()["data"]["incident_id"]

                # 4. Verify route reroutes around incident
                await asyncio.sleep(2)
                r = await client.post("/routes/calculate", json={
                    "origin":      {"lat": 6.9271, "lon": 3.3958},
                    "destination": {"lat": 6.9310, "lon": 3.4001},
                    "mode":        "walking"
                })
                assert r.status_code == 200
                assert r.json()["data"]["restricted_segments_avoided"] >= 1

                # 5. Admin updates status
                r = await client.patch(
                    f"/incidents/{incident_id}/status",
                    json={"status": "assigned"},
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                assert r.status_code == 200

                # 6. Resident receives notification via WebSocket
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    data = json.loads(msg)
                    assert data["type"] in ("route_update", "incident_nearby")
                except asyncio.TimeoutError:
                    pytest.fail("No WebSocket message received after status update")

        print("E2E resident report flow: PASSED")
```

---

## 10.6 App Dry Runs

Automated tests verify the API layer. App dry runs verify the full user experience — rendering, interaction, and visual correctness — on a real device against staging.

### 10.6.1 Dry Run Scenarios

| # | Scenario | Device | Pass criteria |
|---|---|---|---|
| DR-01 | Guest scans QR → map loads → navigates to destination | iOS Safari | Map renders in < 3s, route displayed correctly |
| DR-02 | Resident submits flooding incident with photo | Android | Ticket ID returned, photo visible in admin dashboard |
| DR-03 | Navigation reroutes when incident reported ahead | iOS app | Route updates automatically without user action |
| DR-04 | Zone congestion alert received during navigation | Android app | Banner appears, alternative routes shown |
| DR-05 | Admin assigns incident from dashboard | Web browser | Status change reflected on resident app in < 5s |
| DR-06 | Emergency dispatch flow | Web + Android | Driver receives notification, ETA displayed |
| DR-07 | Offline navigation — airplane mode | iOS app | Cached routes still navigable, map base renders |
| DR-08 | App reconnects after dropped connection | Android | WebSocket reconnects within 10s, no data loss |

### 10.6.2 Dry Run Checklist Template

```
Dry Run: DR-[number] — [scenario name]
Date:
Tester:
Device:
OS version:
App version:
Staging build:

Steps:
[ ] 1. [Step]
[ ] 2. [Step]
[ ] 3. [Step]

Pass criteria:
[ ] [Criterion 1]
[ ] [Criterion 2]

Observations:

Result: PASS / FAIL
Defects raised: [list or "none"]
```

---

## 10.7 Coverage Requirements

| Layer | Minimum coverage | Rationale |
|---|---|---|
| Algorithm files (`polyline.py`, `windows.py`, `severity.py`, etc.) | 100% | Zero tolerance — correctness is critical |
| Domain rule files (`routing.py`, `duplicate.py`, validators) | 100% | Pure functions — 100% is trivially achievable |
| Service functions | 80% | Main paths + primary error branches |
| Routers | 60% | Thin layer — integration tests cover the rest |
| Gateway middleware | 70% | Auth and rate limit paths must be covered |
| Data layer queries | 70% | Integration tests cover the main query paths |

Run coverage report:
```bash
cd apps/api
pytest --cov=. --cov-report=term-missing --cov-fail-under=70
```

---

## 10.8 CI Test Pipeline

```yaml
# .github/workflows/test.yml

name: Test Suite

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r apps/api/requirements.txt --break-system-packages
      - run: pytest tests/unit -m unit -v --tb=short

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:15-3.3
        env:
          POSTGRES_DB:       camppulse_test
          POSTGRES_USER:     camppulse
          POSTGRES_PASSWORD: testpassword
        ports: ["5433:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6380:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r apps/api/requirements.txt --break-system-packages
      - run: pytest tests/integration -m integration -v --tb=short
        env:
          DATABASE_URL: postgresql://camppulse:testpassword@localhost:5433/camppulse_test
          REDIS_URL:    redis://localhost:6380

  coverage:
    runs-on: ubuntu-latest
    needs: [unit, integration]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r apps/api/requirements.txt --break-system-packages
      - run: pytest tests/unit tests/integration --cov=. --cov-fail-under=70
```

---

## 10.9 Testing Anti-Patterns to Avoid

| Anti-pattern | Why it's harmful | Correct approach |
|---|---|---|
| Mocking the database in integration tests | Masks real query errors and schema mismatches | Use real test DB with transaction rollback |
| Testing implementation details | Tests break on refactors that don't change behaviour | Test observable outputs, not internal state |
| Shared mutable state between tests | Flaky tests that pass or fail based on execution order | Transaction rollback fixture + Redis flushdb per test |
| `time.sleep()` in tests without justification | Slow, brittle, non-deterministic | Use event subscriptions or polling with timeout |
| E2E test for every edge case | Slow suite, hard to debug | Unit test edge cases, E2E tests only demo flows |
| Asserting on log output | Logs are not contracts | Assert on return values, DB state, or Redis state |

---

*End of Technical Documentation*

---

## Document Index

| Section | Title |
|---|---|
| 1 | System Overview |
| 2 | Module Breakdown |
| 3 | Data Architecture |
| 4 | Algorithm Specifications |
| 5 | API Design |
| 6 | Monorepo Structure |
| 7 | Design Patterns |
| 8 | Abstraction Levels |
| 9 | Build Milestones and Checkpoints |
| 10 | Testing Strategy |

*CampPulse Technical Documentation v1.0 — Kingdom Hack 3.0*
*Prepared by Shemaiah Yaba-Shiaka*
