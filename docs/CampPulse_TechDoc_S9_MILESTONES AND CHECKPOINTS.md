# CampPulse — Technical Documentation
**Section 9: Build Milestones and Checkpoints**

---

# Section 9: Build Milestones and Checkpoints

## 9.1 Philosophy

The build is structured as a sequence of vertical slices — each milestone delivers a working, demonstrable capability end-to-end rather than completing one horizontal layer before starting the next. This means after Milestone 1, something works. After Milestone 2, more works. A build that stalls never leaves the team with nothing to show.

Each milestone has:
- **Scope** — what gets built
- **Entry condition** — what must be true before starting
- **Deliverables** — concrete, verifiable outputs
- **Checkpoint** — the specific behaviour that proves the milestone is complete
- **Smoke test** — the automated or manual verification that gates progression
- **Success rubric** — the standard the checkpoint must meet, not just that it passes

Build order is not arbitrary. Each milestone unlocks the next. Skipping or reordering will create integration debt that compounds under time pressure.

---

## 9.2 Milestone 0 — Foundation

**Scope:** Monorepo scaffolding, local dev environment, database up, core infrastructure verified.

**Entry condition:** None — this is the starting point.

### Deliverables
- [ ] Monorepo initialised with Turborepo + pnpm workspaces
- [ ] `packages/constants`, `packages/shared-types`, `packages/map-config` created with placeholder exports
- [ ] `apps/api` FastAPI app boots with no routes
- [ ] `apps/web` React app boots with blank page
- [ ] `apps/mobile` Expo app boots on simulator
- [ ] `docker-compose.yml` starts PostgreSQL (PostGIS) + Redis cleanly
- [ ] `core/database.py` connects to PostgreSQL — connection pool verified
- [ ] `core/redis.py` connects to Redis — ping verified
- [ ] `.env.example` populated with all required variables
- [ ] Alembic initialised per service — `alembic revision --autogenerate` runs without error
- [ ] `turbo dev` starts all apps in parallel

### Checkpoint
```bash
# All of the following must return success:
docker-compose up -d
curl http://localhost:8000/health    # → { "status": "ok", "db": "ok", "redis": "ok" }
turbo run type-check                 # → 0 errors across all packages
```

### Smoke Test
```bash
# scripts/smoke-test.sh — Milestone 0
echo "--- M0: Foundation ---"
docker-compose up -d postgres redis
sleep 3

# DB connection
python -c "
import asyncio, asyncpg
async def test():
    conn = await asyncpg.connect('$DATABASE_URL')
    result = await conn.fetchval('SELECT PostGIS_Version()')
    print(f'PostGIS: {result}')
    await conn.close()
asyncio.run(test())
"

# Redis connection
python -c "
import asyncio, aioredis
async def test():
    r = await aioredis.from_url('$REDIS_URL')
    pong = await r.ping()
    print(f'Redis ping: {pong}')
asyncio.run(test())
"

echo "M0 complete"
```

### Success Rubric
- PostgreSQL connects and PostGIS extension is active
- Redis connects and responds to PING
- All apps start without import errors
- Type check passes with zero errors
- No hardcoded credentials anywhere in committed code

---

## 9.3 Milestone 1 — Auth and User Foundation

**Scope:** Full auth flow operational. Users can register, log in, receive tokens, and be identified on subsequent requests.

**Entry condition:** Milestone 0 complete and verified.

### Deliverables
- [ ] `users` and `auth_sessions` tables migrated
- [ ] `POST /api/v1/auth/register` — creates user, returns token pair
- [ ] `POST /api/v1/auth/login` — validates credentials, returns token pair
- [ ] `POST /api/v1/auth/refresh` — rotates refresh token
- [ ] `POST /api/v1/auth/logout` — blacklists access token in Redis
- [ ] `GET /api/v1/users/me` — returns authenticated user profile
- [ ] `get_current_user` dependency works on protected routes
- [ ] `require_role(role)` dependency enforces role hierarchy
- [ ] `optional_user` dependency returns None for unauthenticated requests without rejecting them
- [ ] JWT access token: 15 min expiry, carries `user_id` and `role`
- [ ] Refresh token: stored as hash in Redis + DB, 7 day expiry
- [ ] Token blacklist: revoked JTIs stored in Redis with TTL matching token expiry
- [ ] Rate limiting middleware active — guest limit enforced

### Checkpoint
```
1. Register a new resident account → receive access + refresh token
2. Call GET /users/me with access token → receive user profile
3. Call GET /users/me with expired/invalid token → receive 401
4. Call GET /users/me with no token → receive 401
5. Logout → access token blacklisted
6. Attempt GET /users/me with blacklisted token → receive 401
7. Refresh → receive new token pair, old refresh token invalidated
```

### Smoke Test
```python
# tests/smoke/test_m1_auth.py

import httpx
BASE = "http://localhost:8000/api/v1"

async def test_auth_flow():
    async with httpx.AsyncClient() as client:
        # Register
        r = await client.post(f"{BASE}/auth/register", json={
            "email": "smoke@camppulse.test",
            "password": "testpass123",
            "full_name": "Smoke Test",
            "role": "resident"
        })
        assert r.status_code == 201
        tokens = r.json()["data"]["tokens"]
        access = tokens["access_token"]
        refresh = tokens["refresh_token"]

        # Authenticated request
        r = await client.get(f"{BASE}/users/me",
            headers={"Authorization": f"Bearer {access}"})
        assert r.status_code == 200
        assert r.json()["data"]["email"] == "smoke@camppulse.test"

        # Unauthenticated request
        r = await client.get(f"{BASE}/users/me")
        assert r.status_code == 401

        # Token refresh
        r = await client.post(f"{BASE}/auth/refresh",
            json={"refresh_token": refresh})
        assert r.status_code == 200
        new_access = r.json()["data"]["access_token"]

        # Logout
        r = await client.post(f"{BASE}/auth/logout",
            headers={"Authorization": f"Bearer {new_access}"})
        assert r.status_code == 204

        # Blacklisted token rejected
        r = await client.get(f"{BASE}/users/me",
            headers={"Authorization": f"Bearer {new_access}"})
        assert r.status_code == 401

    print("M1 auth smoke test: PASSED")
```

### Success Rubric
- All 7 checkpoint scenarios pass
- Token blacklist verified in Redis after logout
- No plaintext passwords stored — bcrypt hash confirmed in DB
- `require_role("admin")` on a resident token returns 403
- Rate limit headers present on every response

---

## 9.4 Milestone 2 — Incident Reporting Core

**Scope:** Residents and guests can submit incident reports. Reports are persisted, duplicate-detected, and visible via API. Admin can update status.

**Entry condition:** Milestone 1 complete and verified.

### Deliverables
- [ ] `incidents`, `incident_upvotes`, `incident_comments`, `camp_zones` tables migrated
- [ ] `camp_zones` seeded with Redemption City zone polygons from `packages/map-config`
- [ ] `POST /api/v1/incidents` — anonymous and authenticated submission
- [ ] Photo upload to Cloudflare R2 — URL stored on incident record
- [ ] Zone auto-detection on submission (PostGIS point-in-polygon)
- [ ] Department auto-routing on submission (domain rule)
- [ ] Duplicate detection within 50m radius operational
- [ ] `GET /api/v1/incidents/:id` — full incident detail
- [ ] `GET /api/v1/incidents/nearby` — paginated spatial query
- [ ] `POST /api/v1/incidents/:id/upvote` — authenticated upvote
- [ ] `POST /api/v1/incidents/:id/comments` — authenticated comment
- [ ] `PATCH /api/v1/incidents/:id/status` — admin status update
- [ ] `incident.created` event published to Redis on every new submission
- [ ] `incident.status` event published on every status change

### Checkpoint
```
1. Submit incident (anonymous) with photo + coordinates → ticket created,
   department auto-assigned, zone auto-detected, photo URL in response
2. Submit identical incident within 50m → duplicate detected,
   parent upvote_count incremented, duplicate flag in response
3. GET /incidents/:id → full detail with comments array
4. GET /incidents/nearby?lat=X&lon=Y&radius=500 → paginated list sorted by distance
5. POST /incidents/:id/upvote (resident) → upvote_count incremented
6. POST /incidents/:id/upvote (same resident, same incident) → 409 ALREADY_UPVOTED
7. PATCH /incidents/:id/status (admin) → status transitions correctly
8. PATCH /incidents/:id/status (resident) → 403 INSUFFICIENT_ROLE
9. Redis channel "incident.created" receives event after submission
```

### Smoke Test
```python
# tests/smoke/test_m2_incidents.py

async def test_incident_flow():
    # Submit incident (anonymous)
    r = await client.post("/api/v1/incidents", data={
        "type": "flooding",
        "lat": "6.9271",
        "lon": "3.3958",
        "severity": "high"
    })
    assert r.status_code == 201
    incident_id = r.json()["data"]["incident_id"]
    assert r.json()["data"]["is_duplicate"] == False
    assert r.json()["data"]["department"] == "infrastructure"

    # Duplicate detection
    r = await client.post("/api/v1/incidents", data={
        "type": "flooding",
        "lat": "6.92715",   # within 50m
        "lon": "3.39582",
        "severity": "medium"
    })
    assert r.status_code == 201
    assert r.json()["data"]["is_duplicate"] == True

    # Get incident
    r = await client.get(f"/api/v1/incidents/{incident_id}")
    assert r.status_code == 200
    assert r.json()["data"]["upvote_count"] == 1  # incremented by duplicate

    # Admin status update
    r = await client.patch(f"/api/v1/incidents/{incident_id}/status",
        json={"status": "assigned"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "assigned"

    # Redis event verification
    # (checked in integration test — subscribe to channel before submission)

    print("M2 incident smoke test: PASSED")
```

### Success Rubric
- Zone detection correct for all seeded zone polygons
- Department routing deterministic — same type always maps to same department
- Duplicate radius is exactly 50m — verified with coordinates at 49m and 51m
- Photos stored in R2, not in DB
- Status transitions enforce the valid chain — invalid transitions return 422
- Redis event payload contains all required fields

---

## 9.5 Milestone 3 — Map and Navigation Foundation

**Scope:** The camp map is live. Guests and residents can request routes between two points inside the camp. Road segments are seeded from field-run data. Basic routing is operational.

**Entry condition:** Milestone 2 complete and verified.

### Deliverables
- [ ] `road_segments` table migrated and seeded from `packages/map-config/roads.geojson`
- [ ] Mapbox client operational with circuit breaker
- [ ] `POST /api/v1/routes/calculate` — returns encoded polyline for any two points inside camp
- [ ] Polyline encode/decode verified — round-trip lossless
- [ ] Route cache operational in Redis (TTL 5 minutes)
- [ ] Cache hit returns in < 10ms
- [ ] `GET /api/v1/routes/segments/restricted` — returns current restrictions
- [ ] `PATCH /api/v1/routes/segments/:id/restrict` — admin restriction
- [ ] `PATCH /api/v1/routes/segments/:id/clear` — admin clear
- [ ] Routing subscriber active — listens to `incident.created` and `incident.resolved`
- [ ] Incident creates road restriction → route recalculated around it
- [ ] Incident resolved → restriction cleared → route restored
- [ ] Guest web app (QR) renders Mapbox map with camp boundary overlay
- [ ] Guest can request navigation between two points — route renders on map

### Checkpoint
```
1. POST /routes/calculate (origin, destination) → encoded polyline returned
2. Decode polyline client-side → coordinates match expected route shape
3. Same request repeated → served from cache, response time < 10ms
4. Submit flooding incident near a road → segment restricted
5. POST /routes/calculate same route → new polyline avoids restricted segment
6. Resolve incident → restriction cleared → original route available again
7. Admin restricts segment manually → route avoids it
8. Route origin outside camp boundary → 422 LOCATION_OUTSIDE_BOUNDARY
9. Guest opens QR URL → map renders, route request succeeds without auth
```

### Smoke Test
```python
# tests/smoke/test_m3_routing.py

async def test_routing_flow():
    origin = {"lat": 6.9271, "lon": 3.3958}
    dest   = {"lat": 6.9310, "lon": 3.4001}

    # Route calculation
    r = await client.post("/api/v1/routes/calculate",
        json={"origin": origin, "destination": dest, "mode": "walking"})
    assert r.status_code == 200
    polyline = r.json()["data"]["encoded_polyline"]
    assert len(polyline) > 0
    assert r.json()["data"]["cached"] == False

    # Cache hit
    r2 = await client.post("/api/v1/routes/calculate",
        json={"origin": origin, "destination": dest, "mode": "walking"})
    assert r2.json()["data"]["cached"] == True

    # Incident creates restriction
    await client.post("/api/v1/incidents", data={
        "type": "flooding", "lat": "6.9285", "lon": "3.3975", "severity": "high"
    })
    import asyncio; await asyncio.sleep(1)  # allow event to propagate

    r3 = await client.post("/api/v1/routes/calculate",
        json={"origin": origin, "destination": dest, "mode": "walking"})
    assert r3.json()["data"]["restricted_segments_avoided"] >= 1
    assert r3.json()["data"]["encoded_polyline"] != polyline  # different route

    print("M3 routing smoke test: PASSED")
```

### Success Rubric
- Polyline round-trip: decode(encode(coords)) == coords within 1e-5 precision
- Cache hit rate > 80% on repeated identical requests
- Routing reroutes within 2 seconds of incident event propagation
- Circuit breaker trips after 3 consecutive Mapbox failures
- Fallback route returned when circuit is open — no 503 on first failure

---

## 9.6 Milestone 4 — Real-Time Location and Congestion Detection

**Scope:** WebSocket connections live. Location pings flow. Congestion detection operational. Zone alerts broadcast to connected clients.

**Entry condition:** Milestone 3 complete and verified.

### Deliverables
- [ ] WebSocket endpoint `/ws/location` accepts authenticated connections
- [ ] WebSocket endpoint `/ws/location/guest` accepts anonymous connections
- [ ] Location pings ingested, stored in Redis (TTL 30s), published to `location.ping`
- [ ] Active session registry maintained in Redis
- [ ] Congestion Detection Engine running — subscribes to `location.ping`
- [ ] Detection window (W1): 90 seconds, threshold 50 pings
- [ ] Revalidation window (W2): 60 seconds, confirms or clears flag
- [ ] Severity scoring operational
- [ ] Predictive hotspot scheduler running — loads from `packages/map-config/hotspots.json`
- [ ] Zone determination cached in Redis (3dp grid, 5 min TTL)
- [ ] `congestion.confirmed` event broadcast to affected zone clients as `zone_alert`
- [ ] `congestion.cleared` event broadcast as `zone_clearing`
- [ ] Geofence enforcement — pings outside camp boundary silently dropped
- [ ] Mobility index computed per zone from displacement data

### Checkpoint
```
1. Connect authenticated WebSocket → connection accepted, session registered in Redis
2. Send location_ping → location stored in Redis, TTL 30s confirmed
3. Send location_ping with coordinates outside boundary → silently dropped,
   no Redis entry, no error sent to client
4. Simulate 50+ pings in Zone A within 90 seconds →
   W1 threshold crossed, congestion.flagged published
5. Continue pinging → W2 confirms → congestion.confirmed published →
   zone_alert delivered to all Zone A connections
6. Stop pinging → W2 revalidates → congestion.cleared published →
   zone_clearing delivered to Zone A connections
7. Guest WebSocket → receives zone_alert → cannot send pings (read-only)
8. Hotspot scheduler fires → congestion.anticipated published 10 min before
   program end time in hotspots.json
```

### Smoke Test
```python
# tests/smoke/test_m4_realtime.py

import asyncio
import websockets
import json

async def test_websocket_and_congestion():
    uri = f"wss://localhost:8000/ws/location?token={resident_token}"

    async with websockets.connect(uri) as ws:
        # Send location ping
        await ws.send(json.dumps({
            "type": "location_ping",
            "payload": {
                "lat": 6.9271, "lon": 3.3958,
                "accuracy": 10.0, "timestamp": int(time.time())
            }
        }))
        await asyncio.sleep(0.5)

        # Verify Redis entry
        location = await redis.hgetall(f"location:user:{user_id}")
        assert location[b"lat"] is not None

        # Simulate congestion threshold
        tasks = [send_ping(ws) for _ in range(55)]
        await asyncio.gather(*tasks)
        await asyncio.sleep(95)  # Wait for W1 to close

        # Check for zone_alert message
        msg = await asyncio.wait_for(ws.recv(), timeout=10)
        data = json.loads(msg)
        assert data["type"] == "zone_alert"
        assert data["payload"]["status"] == "congested"

    print("M4 realtime smoke test: PASSED")
```

### Success Rubric
- WebSocket connection established in < 500ms
- Ping ingestion latency < 50ms end-to-end (client send → Redis write)
- Zone determination cache hit rate > 90% in steady state
- Congestion flag raised within 5 seconds of threshold being crossed
- Revalidation correctly clears false positives — test with 55 pings then stop
- Out-of-boundary pings: zero Redis writes confirmed, zero errors sent to client
- Guest connection: receives zone_alert but send of location_ping is silently ignored

---

## 9.7 Milestone 5 — Admin Dashboard

**Scope:** Admin dashboard functional. Live map, incident management, analytics, and zone broadcast operational.

**Entry condition:** Milestone 4 complete and verified.

### Deliverables
- [ ] GraphQL endpoint `/graphql` operational
- [ ] `dashboardSummary` query returns live data
- [ ] `incidents` GraphQL query with full filter support
- [ ] `incidentHotspots` query returns spatial aggregation
- [ ] `equityMetrics` query returns per-zone attention scores
- [ ] `updateIncidentStatus` mutation operational
- [ ] `assignIncident` mutation operational
- [ ] `bulkUpdateIncidentStatus` mutation operational
- [ ] `sendZoneBroadcast` mutation operational
- [ ] `GET /admin/map/live` — all open incidents + active congestion zones
- [ ] `GET /admin/drivers/live` — all active driver locations
- [ ] Admin web dashboard renders live map with incident markers
- [ ] Admin can change incident status from dashboard
- [ ] Admin can restrict/clear road segments from dashboard
- [ ] Dashboard summary cards refresh every 30 seconds
- [ ] Hotspot chart renders from `incidentHotspots` query
- [ ] Equity metrics chart renders from `equityMetrics` query

### Checkpoint
```
1. Query dashboardSummary → returns open incident counts, active zones, response metrics
2. Query incidents(filter: { status: IN_PROGRESS }) → returns only in-progress incidents
3. Mutation updateIncidentStatus → status changes, event published, reporter notified
4. Mutation bulkUpdateIncidentStatus(ids: [...]) → all IDs updated in single operation
5. Mutation sendZoneBroadcast(zone: "Zone A") → notification delivered to Zone A users
6. GET /admin/map/live → all open incidents with coordinates returned
7. Dashboard map renders incident markers at correct coordinates
8. Admin restricts segment from dashboard → routing reroutes within 2 seconds
9. Query equityMetrics → zones with low resolution rates identifiable
```

### Smoke Test
```python
# tests/smoke/test_m5_admin.py

async def test_admin_dashboard():
    headers = {"Authorization": f"Bearer {admin_token}"}

    # GraphQL dashboard summary
    query = """
    query {
      dashboardSummary {
        openIncidents { total }
        activeCongestionZones { zone severity }
        responseMetrics { avgResolutionHours }
      }
    }
    """
    r = await client.post("/graphql",
        json={"query": query}, headers=headers)
    assert r.status_code == 200
    assert "dashboardSummary" in r.json()["data"]
    assert r.json()["data"]["dashboardSummary"]["openIncidents"]["total"] >= 0

    # Bulk status update
    mutation = """
    mutation BulkUpdate($ids: [ID!]!, $status: IncidentStatus!) {
      bulkUpdateIncidentStatus(ids: $ids, status: $status) {
        updatedCount
      }
    }
    """
    r = await client.post("/graphql",
        json={"query": mutation, "variables": {
            "ids": [incident_id_1, incident_id_2],
            "status": "ASSIGNED"
        }},
        headers=headers
    )
    assert r.status_code == 200
    assert r.json()["data"]["bulkUpdateIncidentStatus"]["updatedCount"] == 2

    print("M5 admin smoke test: PASSED")
```

### Success Rubric
- GraphQL playground accessible at `/graphql` in development
- All queries return data consistent with DB state — no stale cache serving wrong data
- Bulk update handles 50 incident IDs without timeout
- Zone broadcast confirmed delivered via WebSocket to connected clients in affected zone
- Dashboard map renders within 3 seconds on first load
- Equity metrics correctly identify a zone with zero resolved incidents as underserved

---

## 9.8 Milestone 6 — Emergency Dispatch and Notifications

**Scope:** Emergency dispatch flow operational. Push and in-app notifications delivered on status changes.

**Entry condition:** Milestone 5 complete and verified.

### Deliverables
- [ ] `driver_profiles` table migrated
- [ ] Driver accounts created via admin KYC flow
- [ ] Driver location updates via WebSocket ping — stored in `driver_profiles.current_location`
- [ ] Emergency dispatch triggered on `critical` severity incident submission
- [ ] Nearest available driver identified via PostGIS proximity query
- [ ] Dispatch route calculated — avoids restricted segments and congested zones
- [ ] ETA calculated and returned to reporter and admin
- [ ] Driver marked unavailable on dispatch, available again on incident resolution
- [ ] Notification Service subscribed to all relevant channels
- [ ] Push notification (Expo Push API) delivered on status change
- [ ] In-app notification delivered via WebSocket on status change
- [ ] Zone broadcast delivered to all users in specified zone
- [ ] `notification_log` persists delivery record

### Checkpoint
```
1. Submit critical severity incident → nearest available driver identified,
   dispatch route calculated, driver notified, ETA in response
2. Driver marked is_available = FALSE after dispatch
3. Incident resolved → driver marked is_available = TRUE
4. No available drivers within 2km → search expands to 5km
5. No drivers at all → admin notified, graceful error in response (no 500)
6. Status change on incident → reporter receives push notification
7. Zone broadcast → all WebSocket-connected users in zone receive message
8. Notification log record created for every delivered notification
```

### Smoke Test
```python
# tests/smoke/test_m6_dispatch.py

async def test_emergency_dispatch():
    # Create and position an available driver
    driver_token = await create_driver_account()
    await connect_driver_ws_and_ping(
        driver_token,
        lat=6.9280, lon=3.3965  # ~100m from incident location
    )

    # Submit critical incident
    r = await client.post("/api/v1/incidents", data={
        "type": "security",
        "lat": "6.9271",
        "lon": "3.3958",
        "severity": "critical"
    })
    assert r.status_code == 201
    incident_id = r.json()["data"]["incident_id"]

    await asyncio.sleep(2)  # allow dispatch to complete

    # Verify driver is now unavailable
    r = await client.get(
        f"/api/v1/users/drivers/available?lat=6.9271&lon=3.3958",
        headers={"Authorization": f"Bearer {resident_token}"}
    )
    driver_ids = [d["driver_id"] for d in r.json()["data"]]
    assert dispatched_driver_id not in driver_ids

    # Verify notification log
    log = await db.fetchrow(
        "SELECT * FROM notification_log WHERE channel = 'incident.status' LIMIT 1"
    )
    assert log is not None

    print("M6 dispatch smoke test: PASSED")
```

### Success Rubric
- Dispatch selects driver with lowest road ETA, not lowest straight-line distance — verify with a scenario where the nearest straight-line driver is behind a restricted segment
- ETA calculation accounts for current road restrictions — not straight-line
- No 500 errors under any dispatch failure scenario — all edge cases return structured errors
- Push notification delivered within 5 seconds of status change
- Notification log never has gaps — every dispatch, assignment, and resolution is recorded

---

## 9.9 Milestone 7 — Demo Hardening

**Scope:** The full demo flow works end-to-end, reliably, under simulated load. Nothing breaks during the 3-minute judge walkthrough.

**Entry condition:** Milestones 1–6 complete and verified.

### Deliverables
- [ ] Demo seed script populates: 3 zones, 10 road segments, 2 available drivers,
      5 open incidents in different statuses, 1 congested zone
- [ ] QR code generated pointing to guest web nav URL
- [ ] Full demo flow rehearsed and timed — under 3 minutes
- [ ] All WebSocket reconnect logic tested — client recovers from dropped connection
- [ ] Offline route cache: 3 repeated route requests promote route to offline set
- [ ] Mapbox circuit breaker tested — fallback route served correctly
- [ ] Rate limiting tested — 429 returned correctly, not 500
- [ ] All error codes return correct HTTP status — no 500s on expected error conditions
- [ ] Fly.io deployment verified — all Milestone 1–6 checkpoints pass on staging
- [ ] Response times on staging:
      - REST endpoints: < 200ms p95
      - WebSocket ping acknowledgement: < 100ms
      - Route calculation (cache miss): < 2000ms
      - Route calculation (cache hit): < 50ms
- [ ] `scripts/smoke-test.sh` runs all milestone smoke tests in sequence and passes

### Full Demo Flow Script
```
Duration target: 2 minutes 30 seconds

0:00 — Open resident mobile app. Show camp map with incident markers.
       "This is Redemption City — live."

0:15 — Tap "Report an Issue." Select "Flooding." Take photo.
       GPS auto-tags location. Submit.
       "Ticket created. Department auto-assigned. Zone detected."

0:30 — Admin dashboard opens. New incident appears on map in real time.
       Assign to infrastructure department. Mark in progress.

0:50 — Back on mobile. Status notification received.
       "Your report is being handled."

1:00 — Request navigation to the main auditorium.
       Route renders — avoids the flooded road.
       "The system already knows. It rerouted automatically."

1:20 — Trigger congestion simulation. Zone A alert fires.
       Navigation suggestion updates. Zone alert banner appears on mobile.
       "20,000 people just left the auditorium. The system felt it."

1:45 — Admin marks flood incident as resolved.
       Road restriction cleared. Navigation recalculates — direct route restored.

2:00 — Show QR code. Guest scans on second device.
       Web nav opens immediately. No install. No login.
       "A visitor scans this at the gate. They're navigating in 3 seconds."

2:20 — Show admin analytics. Hotspot cluster visible in Zone A.
       "This is the data that tells management where to invest."

2:30 — Done.
```

### Final Smoke Test (full sequence)
```bash
# scripts/smoke-test.sh

#!/bin/bash
set -e

echo "=== CampPulse Full Smoke Test Suite ==="

echo "--- M0: Foundation ---"
python tests/smoke/test_m0_foundation.py

echo "--- M1: Auth ---"
python tests/smoke/test_m1_auth.py

echo "--- M2: Incidents ---"
python tests/smoke/test_m2_incidents.py

echo "--- M3: Routing ---"
python tests/smoke/test_m3_routing.py

echo "--- M4: Realtime + Congestion ---"
python tests/smoke/test_m4_realtime.py

echo "--- M5: Admin Dashboard ---"
python tests/smoke/test_m5_admin.py

echo "--- M6: Dispatch + Notifications ---"
python tests/smoke/test_m6_dispatch.py

echo "=== ALL SMOKE TESTS PASSED ==="
```

### Success Rubric
- Full smoke test suite passes with zero failures on staging
- Demo flow completed in under 3 minutes with no errors
- No hardcoded tokens or credentials in any deployed code
- All environment variables resolved from `.env` — no missing vars at runtime
- WebSocket connection survives a 30-second network interruption and reconnects
- Offline route cache verified: route cached after 3 requests, served without network

---

## 9.10 Milestone Dependency Map

```
M0 Foundation
    │
    ▼
M1 Auth + Users
    │
    ▼
M2 Incident Reporting
    │
    ├──────────────┐
    ▼              ▼
M3 Routing     M4 Realtime + Congestion
    │              │
    └──────┬───────┘
           ▼
       M5 Admin Dashboard
           │
           ▼
       M6 Dispatch + Notifications
           │
           ▼
       M7 Demo Hardening
```

M3 and M4 can be built in parallel after M2 is complete. Everything else is sequential.

---

## 9.11 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mapbox road data sparse for camp interior | High | High | Field run pre-build; custom road layer seeded before M3 |
| WebSocket stability under load | Medium | High | Reconnect logic in M7; Fly.io concurrency limits configured |
| Redis Pub/Sub message loss | Medium | Medium | Idempotent handlers; self-healing on next event trigger |
| R2 upload latency or credential misconfiguration | Low | Medium | Circuit breaker with local file fallback for demo |
| Congestion threshold miscalibrated | Medium | Medium | Threshold in env var — adjustable without redeploy |
| Demo environment differs from dev | Medium | High | Full smoke suite on staging in M7 before presentation |
| Offline tile caching exceeds Mapbox free tier | Low | Low | Cache only frequently requested routes; monitor usage |

---

*Next: Section 10 — Testing Strategy*
