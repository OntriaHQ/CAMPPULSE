# CampPulse — Technical Documentation
**Section 4: Algorithm Specifications**

---

# Section 4: Algorithm Specifications

This section documents every non-trivial algorithm in CampPulse at full implementation detail — data structures, pseudocode, complexity analysis, and edge case handling. Each algorithm is scoped to its owning service and references the data layer it operates on.

---

## 4.1 Congestion Detection — Two-Window Algorithm

**Owner:** Congestion Detection Engine
**Data layer:** Redis (working state), PostgreSQL (graduated event log)

### 4.1.1 Overview

The two-window algorithm detects genuine congestion while suppressing transient noise. It operates on a continuous stream of location pings aggregated per camp zone, running two sequential evaluation phases — detection and revalidation — before committing a congestion signal downstream.

### 4.1.2 Configuration Constants
```python
# packages/constants/congestion.py

DETECTION_WINDOW_SECONDS = 90       # W1 duration
REVALIDATION_WINDOW_SECONDS = 60    # W2 duration
CONGESTION_THRESHOLD = 50           # pings per zone per W1 to trigger flag
CLEAR_THRESHOLD = 20                # pings per zone per W2 to confirm clearing
ANTICIPATION_LEAD_MINUTES = 10      # hotspot pre-alert window
ZONE_RADIUS_METRES = 200            # spatial boundary for zone ping aggregation
```

### 4.1.3 Data Structures
```python
# Window identifier — deterministic, derived from zone and window start time
window_id: str = f"{zone_id}:{floor(timestamp / DETECTION_WINDOW_SECONDS)}"

# Redis Sorted Set — ping registry per window
# Key:    congestion:window:{window_id}
# Score:  Unix timestamp (enables time-range queries and expiry)
# Member: "{user_id}:{timestamp}" (deduplicates per user per second)

# Redis Hash — zone congestion state
# Key:    congestion:state:{zone_id}
# Fields:
class CongestionState:
    status: Literal["clear", "pending_validation", "congested", "anticipated"]
    severity: Literal["low", "medium", "high", "critical"]
    flagged_at: int        # Unix timestamp
    confirmed_at: int      # Unix timestamp, nullable
    ping_count: int
    window_id: str
```

### 4.1.4 Ping Ingestion
```python
async def ingest_ping(user_id: str, lat: float, lon: float, timestamp: int):
    """
    Called for every location ping received by the Real-Time Location Service.
    Determines zone, deduplicates, and registers ping in the detection window.

    Complexity: O(log N) — Redis ZADD into sorted set
                N = pings already in current window for this zone
    """
    # Step 1: Determine zone (cached in Redis for 5 minutes to avoid repeat DB calls)
    zone_id = await get_zone_cached(lat, lon)
    if zone_id is None:
        return  # Ping outside camp boundary — silently dropped

    # Step 2: Derive current window identifier
    window_id = f"{zone_id}:{floor(timestamp / DETECTION_WINDOW_SECONDS)}"
    redis_key = f"congestion:window:{window_id}"

    # Step 3: Deduplicate — one entry per user per window
    # Using user_id as member prefix ensures ZADD overwrites prior entry for same user
    member = f"{user_id}:{timestamp}"
    await redis.zadd(redis_key, {member: timestamp})
    await redis.expire(redis_key, DETECTION_WINDOW_SECONDS + 10)  # buffer for late arrivals

    # Step 4: Evaluate window on every Nth ping to avoid evaluation on every single ping
    # N = 5 (configurable) — balances responsiveness with compute cost
    ping_count = await redis.zcard(redis_key)
    if ping_count % 5 == 0:
        await evaluate_detection_window(zone_id, window_id, ping_count)
```

### 4.1.5 Detection Window Evaluation (W1)
```python
async def evaluate_detection_window(zone_id: str, window_id: str, ping_count: int):
    """
    Evaluates whether the current detection window warrants a congestion flag.

    Complexity: O(1) — Redis HGET for state check, HSET for state write
    """
    current_state = await get_zone_state(zone_id)

    # Skip if already flagged or confirmed — W2 is running
    if current_state and current_state["status"] in ("pending_validation", "congested"):
        return

    if ping_count >= CONGESTION_THRESHOLD:
        severity = score_severity(ping_count, CONGESTION_THRESHOLD)

        # Write pending state to Redis
        await redis.hset(f"congestion:state:{zone_id}", mapping={
            "status":     "pending_validation",
            "severity":   severity,
            "flagged_at": int(time.time()),
            "ping_count": ping_count,
            "window_id":  window_id
        })
        # TTL = revalidation window — if W2 never runs, state auto-expires
        await redis.expire(f"congestion:state:{zone_id}", REVALIDATION_WINDOW_SECONDS * 2)

        # Publish flag event — triggers W2 and downstream consumers
        await redis.publish("congestion.flagged", json.dumps({
            "zone_id":    zone_id,
            "ping_count": ping_count,
            "window_id":  window_id,
            "severity":   severity
        }))
```

### 4.1.6 Revalidation Window (W2)
```python
async def run_revalidation(zone_id: str, flagged_ping_count: int):
    """
    Runs after a congestion flag is raised. Opens a fresh aggregation window
    and re-evaluates ping density to confirm or clear the flag.

    Complexity: O(log N) ingestion during window, O(1) evaluation at close
    """
    revalidation_key = f"congestion:revalidation:{zone_id}:{int(time.time())}"
    deadline = time.time() + REVALIDATION_WINDOW_SECONDS

    # Collect pings during revalidation window
    # New pings are routed here in parallel with normal W1 ingestion
    await asyncio.sleep(REVALIDATION_WINDOW_SECONDS)

    revalidation_count = await redis.zcard(revalidation_key)

    if revalidation_count >= CONGESTION_THRESHOLD:
        # Congestion confirmed
        severity = score_severity(revalidation_count, CONGESTION_THRESHOLD)
        confirmed_at = int(time.time())

        await redis.hset(f"congestion:state:{zone_id}", mapping={
            "status":       "congested",
            "severity":     severity,
            "confirmed_at": confirmed_at,
            "ping_count":   revalidation_count
        })
        await redis.expire(f"congestion:state:{zone_id}", 86400)  # 24hr analytics window

        await redis.publish("congestion.confirmed", json.dumps({
            "zone_id":      zone_id,
            "severity":     severity,
            "confirmed_at": confirmed_at,
            "ping_count":   revalidation_count
        }))

    elif revalidation_count <= CLEAR_THRESHOLD:
        # Transient spike — clear the flag
        await redis.delete(f"congestion:state:{zone_id}")
        await redis.publish("congestion.cleared", json.dumps({
            "zone_id":    zone_id,
            "cleared_at": int(time.time())
        }))

    else:
        # Ambiguous — extend revalidation by one more window
        await run_revalidation(zone_id, revalidation_count)

    # Cleanup revalidation window key
    await redis.delete(revalidation_key)
```

### 4.1.7 Severity Scoring
```python
def score_severity(ping_count: int, threshold: int) -> str:
    """
    Scores congestion severity as a ratio of observed pings to threshold.

    Complexity: O(1)
    """
    ratio = ping_count / threshold
    if ratio >= 3.0:   return "critical"   # 3x threshold — 150+ pings
    elif ratio >= 2.0: return "high"       # 2x threshold — 100+ pings
    elif ratio >= 1.5: return "medium"     # 1.5x threshold — 75+ pings
    else:              return "low"        # just above threshold — 50+ pings
```

### 4.1.8 Predictive Detection (Hotspot Scheduler)
```python
async def run_hotspot_scheduler():
    """
    Background task running every 5 minutes.
    Checks known venue schedules and pre-raises congestion state
    for zones where a program is ending within the anticipation window.

    Complexity: O(H) — H = number of registered hotspots (typically < 20)
    """
    hotspots = load_hotspot_registry()  # from constants/hotspots.json
    now = datetime.utcnow()

    for hotspot in hotspots:
        for program in hotspot["programs"]:
            if now.strftime("%A").lower() not in program["days"]:
                continue

            program_end = parse_time(program["end_time"])
            minutes_to_end = (program_end - now.time()).seconds / 60

            if 0 < minutes_to_end <= ANTICIPATION_LEAD_MINUTES:
                current_state = await get_zone_state(hotspot["zone"])

                # Only anticipate if zone is currently clear
                if not current_state or current_state["status"] == "clear":
                    await redis.hset(f"congestion:state:{hotspot['zone']}", mapping={
                        "status":    "anticipated",
                        "severity":  "medium",  # conservative default
                        "flagged_at": int(time.time()),
                        "ping_count": 0
                    })
                    await redis.expire(
                        f"congestion:state:{hotspot['zone']}",
                        int(minutes_to_end * 60) + REVALIDATION_WINDOW_SECONDS
                    )
                    await redis.publish("congestion.anticipated", json.dumps({
                        "zone_id":       hotspot["zone"],
                        "venue_id":      hotspot["venue_id"],
                        "program_name":  program["name"],
                        "eta_minutes":   int(minutes_to_end)
                    }))
```

### 4.1.9 Full Algorithm Complexity Summary

| Operation | Complexity | Notes |
|---|---|---|
| Ping ingestion | O(log N) | Redis ZADD — N = pings in current window |
| Window evaluation | O(1) | Redis ZCARD + HGET/HSET |
| Revalidation | O(log N) | Same as ingestion |
| Severity scoring | O(1) | Arithmetic comparison |
| Zone state lookup | O(1) | Redis HGET |
| Hotspot scheduler | O(H) | H = registered hotspots |
| Space per window | O(W) | W = unique users pinging in window |
| Total space | O(W × Z) | Z = active zones |

---

## 4.2 Route Calculation and Dynamic Rerouting

**Owner:** Routing Service
**Data layer:** PostgreSQL + PostGIS (road graph), Redis (route cache)

### 4.2.1 Overview

Route calculation operates in two modes — cache-first for repeat requests, and live computation for novel origin-destination pairs or invalidated cache entries. Dynamic rerouting is triggered by road graph state changes emitted as events from the Incident and Congestion services.

### 4.2.2 Cache Key Generation
```python
import hashlib

def make_route_key(origin: tuple, destination: tuple, mode: str) -> str:
    """
    Generates a deterministic cache key for a route request.
    Coordinates are rounded to 4 decimal places (~11m precision)
    to increase cache hit rate for nearby requests.

    Complexity: O(1)
    """
    origin_str = f"{round(origin[0], 4)},{round(origin[1], 4)}"
    dest_str = f"{round(destination[0], 4)},{round(destination[1], 4)}"
    raw = f"{origin_str}|{dest_str}|{mode}"
    return f"route:{hashlib.md5(raw.encode()).hexdigest()}"
```

### 4.2.3 Route Calculation Pipeline
```python
async def calculate_route(
    origin: tuple[float, float],
    destination: tuple[float, float],
    mode: Literal["walking", "tricycle"],
    user_id: str | None = None
) -> RouteResult:
    """
    Main route calculation entry point.

    Complexity:
      Cache hit:  O(1) Redis GET
      Cache miss: O(E log E) Dijkstra on road graph via routing engine
                  + O(N) polyline encoding — N = coordinate points
                  E = road segments in routing graph
    """
    cache_key = make_route_key(origin, destination, mode)

    # Step 1: Cache check
    cached = await redis.get(cache_key)
    if cached:
        await track_offline_candidate(user_id, cache_key)
        return RouteResult(**json.loads(cached))

    # Step 2: Fetch restricted segments from PostGIS
    restricted_segments = await fetch_restricted_segments()

    # Step 3: Build avoidance waypoints from restricted segment midpoints
    avoidance_points = [
        midpoint(seg.geom) for seg in restricted_segments
        if seg.zone in get_relevant_zones(origin, destination)
    ]

    # Step 4: Call external routing engine (Mapbox Directions API / OpenRouteService)
    raw_route = await routing_client.get_route(
        origin=origin,
        destination=destination,
        mode=mode,
        avoid_points=avoidance_points
    )

    # Step 5: Encode route geometry as polyline
    encoded = encode_polyline(raw_route.coordinates)

    result = RouteResult(
        encoded_polyline=encoded,
        distance_metres=raw_route.distance,
        eta_seconds=raw_route.duration,
        restricted_segments_avoided=len(avoidance_points),
        cached_at=int(time.time())
    )

    # Step 6: Store in cache (TTL 5 minutes)
    await redis.setex(cache_key, 300, json.dumps(result.dict()))

    # Step 7: Track for offline promotion
    await track_offline_candidate(user_id, cache_key)

    return result
```

### 4.2.4 Cache Invalidation on Road Graph Change
```python
async def invalidate_routes_for_segment(segment_id: str):
    """
    When a road segment is restricted or cleared, invalidate all
    cached routes that pass through or near that segment.

    Strategy: Scan cache keys by segment zone prefix.
    For MVP: full cache flush for affected zone.
    Post-MVP: spatial intersection check per cached route geometry.

    Complexity: O(K) — K = cached routes in affected zone
    """
    segment = await fetch_segment(segment_id)
    zone_routes = await redis.keys(f"route:*zone:{segment.zone}*")

    if zone_routes:
        await redis.delete(*zone_routes)

    # Notify active navigators in zone
    await redis.publish("routing.cache_invalidated", json.dumps({
        "segment_id": segment_id,
        "zone": segment.zone,
        "timestamp": int(time.time())
    }))
```

### 4.2.5 Offline Route Promotion
```python
OFFLINE_PROMOTION_THRESHOLD = 3   # requests before route is promoted to offline cache

async def track_offline_candidate(user_id: str | None, cache_key: str):
    """
    Tracks route request frequency per user.
    Promotes frequently requested routes to the user's offline cache set.

    Complexity: O(1) — Redis INCR + SADD
    """
    if user_id is None:
        return  # Guests do not get offline caching

    freq_key = f"route:freq:{user_id}:{cache_key}"
    count = await redis.incr(freq_key)
    await redis.expire(freq_key, 604800)  # 7 days

    if count >= OFFLINE_PROMOTION_THRESHOLD:
        await redis.sadd(f"route:offline:{user_id}", cache_key)
        await redis.expire(f"route:offline:{user_id}", 604800)
```

---

## 4.3 Polyline Encoding

**Owner:** Routing Service
**Data layer:** None (pure computation)

### 4.3.1 Overview

Google Polyline Encoding Algorithm (Phase 1 standard) encodes a sequence of lat/lon coordinate pairs into a compact ASCII string. A typical route with 80 coordinate points compresses from ~4KB (raw JSON array) to ~320 bytes — a 92% payload reduction.

### 4.3.2 Implementation
```python
def encode_polyline(coordinates: list[tuple[float, float]]) -> str:
    """
    Encodes a list of (lat, lon) coordinate pairs into a Google-encoded polyline string.

    Args:
        coordinates: List of (latitude, longitude) tuples

    Returns:
        Encoded polyline string

    Complexity: O(N) — N = number of coordinate pairs
    Space:      O(N) output string, O(1) working space per coordinate
    """
    output = []
    prev_lat = 0
    prev_lon = 0

    for lat, lon in coordinates:
        # Work in integer space (multiply by 1e5, round)
        lat_e5 = round(lat * 1e5)
        lon_e5 = round(lon * 1e5)

        # Encode delta from previous coordinate
        for value in (lat_e5 - prev_lat, lon_e5 - prev_lon):
            # Left shift by 1; if negative, invert all bits
            value = ~(value << 1) if value < 0 else (value << 1)

            # Split into 5-bit chunks and encode
            while value >= 0x20:
                output.append(chr((0x20 | (value & 0x1F)) + 63))
                value >>= 5
            output.append(chr(value + 63))

        prev_lat = lat_e5
        prev_lon = lon_e5

    return "".join(output)


def decode_polyline(encoded: str) -> list[tuple[float, float]]:
    """
    Decodes a Google-encoded polyline string back to coordinate pairs.
    Used client-side (TypeScript mirror of this function) for route rendering.

    Complexity: O(N) — N = length of encoded string
    """
    coordinates = []
    index = 0
    lat = 0
    lon = 0

    while index < len(encoded):
        for is_lon in (False, True):
            result = 0
            shift = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else (result >> 1)
            if is_lon:
                lon += delta
            else:
                lat += delta
        coordinates.append((lat / 1e5, lon / 1e5))

    return coordinates
```

### 4.3.3 Compression Analysis
```
Route with 80 coordinate points:

Raw JSON:
[{"lat": 6.92710, "lon": 3.39580}, ...] × 80
≈ 30 bytes per point × 80 = 2,400 bytes + JSON overhead ≈ 4,000 bytes

Encoded polyline:
~4 characters per coordinate delta on average × 2 values × 80 points
≈ 640 characters = 640 bytes

Compression ratio: ~84–92% depending on coordinate density
Network savings at 1,000 concurrent route requests: ~3.3MB per request cycle
```

### 4.3.4 Substitution Point

If benchmarking reveals encoding/decoding is a bottleneck (unlikely at hackathon scale):

| Alternative | Advantage | Trade-off |
|---|---|---|
| Flexpolyline (HERE) | Higher precision (6 decimal places), altitude support | Less client library support |
| Custom binary encoding | Smallest possible payload | Requires custom client decoder |
| GeoJSON (no encoding) | Zero encoding overhead, native browser support | 5–10x larger payload |

The interface contract (`encoded_polyline: str`) is stable regardless of encoding algorithm. Swapping the encoding changes only `encode_polyline()` and `decode_polyline()` — no other service is affected.

---

## 4.4 Emergency Dispatch — Nearest Responder Algorithm

**Owner:** Incident Management Service
**Data layer:** PostgreSQL + PostGIS (driver locations), Routing Service (path calculation)

### 4.4.1 Overview

When a critical or high-severity incident is reported, the system identifies the nearest available response team and calculates the fastest accessible route to the incident — avoiding congested and restricted roads.

### 4.4.2 Implementation
```python
async def dispatch_nearest_responder(
    incident_id: str,
    incident_location: tuple[float, float],
    incident_type: str
) -> DispatchResult | None:
    """
    Finds the nearest available responder and dispatches them to an incident.

    Complexity:
      Responder query: O(log N) — PostGIS GIST index spatial scan
                       N = total driver/responder records
      Route calculation: O(E log E) — Dijkstra via routing engine
      Total: O(log N + E log E) — dominated by routing
    """
    # Step 1: Find up to 5 nearest available responders within 2km
    candidates = await db.fetch("""
        SELECT
            dp.id AS driver_id,
            dp.user_id,
            dp.vehicle_type,
            u.full_name,
            ST_Distance(
                dp.current_location::geography,
                ST_SetSRID(ST_Point($1, $2), 4326)::geography
            ) AS straight_line_distance
        FROM driver_profiles dp
        JOIN users u ON u.id = dp.user_id
        WHERE dp.is_available = TRUE
          AND u.role IN ('driver', 'admin')
          AND ST_DWithin(
              dp.current_location::geography,
              ST_SetSRID(ST_Point($1, $2), 4326)::geography,
              2000
          )
        ORDER BY straight_line_distance ASC
        LIMIT 5
    """, incident_location[1], incident_location[0])  # lon, lat for ST_Point

    if not candidates:
        # No responders within 2km — expand search radius to 5km
        candidates = await expand_responder_search(incident_location, radius=5000)

    if not candidates:
        return None  # No available responders — escalate to admin notification

    # Step 2: Calculate actual routed distance for top candidates
    # Straight-line proximity is a heuristic — road routing may differ significantly
    route_results = await asyncio.gather(*[
        routing_service.calculate_route(
            origin=(c["current_lat"], c["current_lon"]),
            destination=incident_location,
            mode="tricycle"
        )
        for c in candidates[:3]  # Top 3 by straight-line, then pick by road ETA
    ])

    # Step 3: Select responder with lowest road ETA
    best_idx = min(
        range(len(route_results)),
        key=lambda i: route_results[i].eta_seconds
    )
    best_candidate = candidates[best_idx]
    best_route = route_results[best_idx]

    # Step 4: Mark responder as unavailable
    await db.execute("""
        UPDATE driver_profiles SET is_available = FALSE
        WHERE id = $1
    """, best_candidate["driver_id"])

    # Step 5: Create dispatch record and notify responder
    dispatch = await create_dispatch_record(
        incident_id=incident_id,
        responder_id=best_candidate["user_id"],
        route=best_route,
        eta_seconds=best_route.eta_seconds
    )

    await notification_service.notify_user(
        user_id=best_candidate["user_id"],
        title="Dispatch Alert",
        body=f"Emergency reported nearby. ETA: {best_route.eta_seconds // 60} minutes.",
        data={"incident_id": incident_id, "route": best_route.encoded_polyline}
    )

    return dispatch
```

### 4.4.3 Complexity Summary

| Operation | Complexity | Notes |
|---|---|---|
| Spatial responder query | O(log N) | GIST index scan — N = driver records |
| Route calculation per candidate | O(E log E) | Dijkstra — E = road segments |
| ETA comparison across candidates | O(K) | K = candidates evaluated (≤ 3) |
| Total dispatch | O(log N + K × E log E) | Dominated by routing |

---

## 4.5 Duplicate Incident Detection

**Owner:** Incident Management Service
**Data layer:** PostgreSQL + PostGIS

### 4.5.1 Implementation
```python
async def check_and_handle_duplicate(
    incident_type: str,
    location: tuple[float, float],
    reporter_id: str | None
) -> DuplicateCheckResult:
    """
    Checks for existing open incidents of the same type within 50 metres.
    If found, the new submission is registered as a duplicate — incrementing
    the parent's upvote count and linking the reporter for status notifications.

    Complexity: O(log N) — PostGIS GIST index spatial scan
                N = total open incidents
    """
    parent = await db.fetchrow("""
        SELECT id, upvote_count FROM incidents
        WHERE status NOT IN ('resolved', 'closed')
          AND type = $1
          AND ST_DWithin(
              location::geography,
              ST_SetSRID(ST_Point($2, $3), 4326)::geography,
              50
          )
        ORDER BY
          ST_Distance(
              location::geography,
              ST_SetSRID(ST_Point($2, $3), 4326)::geography
          ) ASC
        LIMIT 1
    """, incident_type, location[1], location[0])

    if parent:
        # Increment upvote count on parent
        await db.execute("""
            UPDATE incidents
            SET upvote_count = upvote_count + 1, updated_at = NOW()
            WHERE id = $1
        """, parent["id"])

        # Register reporter on parent for status notifications (if logged in)
        if reporter_id:
            await db.execute("""
                INSERT INTO incident_upvotes (incident_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (incident_id, user_id) DO NOTHING
            """, parent["id"], reporter_id)

        return DuplicateCheckResult(
            is_duplicate=True,
            parent_id=parent["id"],
            parent_upvote_count=parent["upvote_count"] + 1
        )

    return DuplicateCheckResult(is_duplicate=False)
```

---

## 4.6 Zone Determination with Caching

**Owner:** Real-Time Location Service / Congestion Detection Engine
**Data layer:** PostgreSQL + PostGIS (authoritative), Redis (cache)

### 4.6.1 Implementation
```python
ZONE_CACHE_TTL = 300  # 5 minutes — zones are static, cache aggressively

async def get_zone_cached(lat: float, lon: float) -> str | None:
    """
    Determines which camp zone a coordinate falls in.
    Caches results aggressively — zone boundaries are static.

    Cache key uses 3 decimal place precision (~111m grid)
    to maximise hit rate for users moving within the same zone.

    Complexity:
      Cache hit:  O(1)
      Cache miss: O(log Z) PostGIS point-in-polygon — Z = number of zones
    """
    # Round to 3dp for cache key (~111m precision — sub-zone granularity)
    grid_lat = round(lat, 3)
    grid_lon = round(lon, 3)
    cache_key = f"zone:grid:{grid_lat}:{grid_lon}"

    cached_zone = await redis.get(cache_key)
    if cached_zone:
        return cached_zone.decode()

    # Cache miss — query PostGIS
    zone = await db.fetchval("""
        SELECT name FROM camp_zones
        WHERE zone_type != 'boundary'
          AND ST_Within(
              ST_SetSRID(ST_Point($1, $2), 4326),
              boundary
          )
        LIMIT 1
    """, lon, lat)

    if zone:
        await redis.setex(cache_key, ZONE_CACHE_TTL, zone)
    else:
        # Outside all named zones but within camp boundary
        # Cache the null result to avoid repeated DB queries
        await redis.setex(cache_key, ZONE_CACHE_TTL, "__none__")

    return zone
```

---

## 4.7 Peak-Period Mobility Inference

**Owner:** Congestion Detection Engine
**Data layer:** Redis

### 4.7.1 Overview

Beyond zone-level congestion detection, the system infers camp-wide mobility patterns from aggregate displacement data. This produces a live mobility index per zone — a measure of how actively people are moving — which feeds route prioritisation and proactive navigation suggestions.

### 4.7.2 Displacement-Based Mobility Scoring
```python
DISPLACEMENT_THRESHOLD_METRES = 100   # minimum movement to count as active
MOBILITY_WINDOW_SECONDS = 120         # rolling window for mobility scoring
MOBILITY_SCORE_TTL = 60               # how long a mobility score is valid

async def update_mobility_score(user_id: str, new_location: tuple, timestamp: int):
    """
    Compares current ping location to previous ping for the same user.
    If displacement exceeds threshold, the user is counted as actively mobile.
    Aggregates active user count per zone into a mobility index.

    Complexity: O(1) — Redis GET/SET + arithmetic
    """
    prev_key = f"location:prev:{user_id}"
    prev_data = await redis.get(prev_key)

    is_mobile = False
    if prev_data:
        prev = json.loads(prev_data)
        displacement = haversine_distance(
            (prev["lat"], prev["lon"]),
            new_location
        )
        is_mobile = displacement >= DISPLACEMENT_THRESHOLD_METRES

    # Store current location as previous for next ping
    await redis.setex(prev_key, 60, json.dumps({
        "lat": new_location[0],
        "lon": new_location[1],
        "timestamp": timestamp
    }))

    if is_mobile:
        zone_id = await get_zone_cached(*new_location)
        if zone_id:
            mobility_key = f"mobility:active:{zone_id}"
            await redis.incr(mobility_key)
            await redis.expire(mobility_key, MOBILITY_WINDOW_SECONDS)


def haversine_distance(
    point_a: tuple[float, float],
    point_b: tuple[float, float]
) -> float:
    """
    Calculates great-circle distance between two coordinate pairs in metres.

    Complexity: O(1)
    """
    R = 6_371_000  # Earth radius in metres
    lat1, lon1 = map(math.radians, point_a)
    lat2, lon2 = map(math.radians, point_b)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))
```

### 4.7.3 Mobility Index Per Zone
```python
async def get_mobility_index(zone_id: str) -> MobilityIndex:
    """
    Returns the current mobility score for a zone — used by the
    routing service to deprioritise high-mobility zones during route selection.

    Complexity: O(1) — Redis GET
    """
    active_count = int(await redis.get(f"mobility:active:{zone_id}") or 0)
    total_active = int(await redis.scard("location:active_sessions") or 1)

    # Normalised score: 0.0 (no movement) → 1.0 (all active users moving in this zone)
    score = min(active_count / max(total_active, 1), 1.0)

    return MobilityIndex(
        zone_id=zone_id,
        active_mobile_users=active_count,
        score=score,
        level="high" if score > 0.6 else "medium" if score > 0.3 else "low"
    )
```

---

## 4.8 Algorithm Interaction Map

```
Location Ping Received
        │
        ├──► Zone Determination (4.6) ──► cached zone_id
        │
        ├──► Mobility Scoring (4.7) ──► mobility index per zone
        │
        └──► Congestion Ingestion (4.1)
                │
                ├──► W1 Evaluation ──► threshold crossed?
                │         │
                │         └── YES ──► W2 Revalidation
                │                          │
                │                    ┌─────┴──────┐
                │                confirmed      cleared
                │                    │
                │              Severity Score (4.1.7)
                │                    │
                │         ┌──────────┴──────────┐
                │    Routing Service        Notification Svc
                │    Road graph update      Zone broadcast
                │         │
                │    Cache Invalidation (4.2.4)
                │         │
                │    Active navigators rerouted (4.2.3)
                │
Incident Reported
        │
        ├──► Duplicate Detection (4.5)
        │         │
        │    Not duplicate ──► New incident created
        │                           │
        │              ┌────────────┴────────────┐
        │         Severity HIGH/CRITICAL      Severity LOW/MED
        │              │                          │
        │    Emergency Dispatch (4.4)        Standard routing
        │    Nearest responder found         Road restriction applied
        │    Route calculated (4.2)
        │
Hotspot Schedule Check (4.1.8)
        │
        └──► Program ending soon?
                    │
               Anticipation flag raised
               Proactive rerouting triggered
```

---

*Next: Section 5 — API Design*
