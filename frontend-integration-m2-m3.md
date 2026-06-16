# Frontend Integration Guide — M2 (Incidents) & M3 (Routes)

> Base URL (dev): `http://localhost:8000/api/v1`
> Base URL (prod): `https://api.camppulse.ng/api/v1`
> Standard envelope: `{ "success": bool, "data": any, "meta": { "timestamp", "request_id" } }`

---

## M2 — Incident Reporting

### 2.1 Create Incident

**`POST /incidents`** — No auth required (guests can submit).

Uses `multipart/form-data` (not JSON). Fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string | yes | One of: `flooding`, `pothole`, `streetlight`, `water_leak`, `trash`, `security`, `congestion`, `other` |
| `lat` | float | yes | -90 to 90 |
| `lon` | float | yes | -180 to 180 |
| `description` | string | no | Max 2000 chars |
| `severity` | string | no | `low` (default), `medium`, `high`, `critical` |
| `photo` | file | no | Image upload |

```typescript
// React Native / Web fetch
const form = new FormData();
form.append("type", "pothole");
form.append("lat", "6.9271");
form.append("lon", "3.3958");
form.append("description", "Large pothole near Main Avenue");
form.append("severity", "medium");
if (photoUri) {
  form.append("photo", { uri: photoUri, name: "photo.jpg", type: "image/jpeg" } as any);
}

const res = await fetch(`${API}/incidents`, { method: "POST", body: form });
const json = await res.json();
// json.data.incident_id → string
// json.data.is_duplicate → boolean
// json.data.department → string
// json.data.estimated_response_window → string
```

**Note**: If `is_duplicate` is `true`, `incident_id` will be `null` and `parent_incident_id` points to the existing incident.

### 2.2 Fetch Incident

**`GET /incidents/:id`** — No auth required.

```typescript
const res = await fetch(`${API}/incidents/${incidentId}`);
const { data } = await res.json();
// data: {
//   id, type, description, photo_url,
//   location: { lat, lon }, address_label, zone,
//   severity, status, department,
//   upvote_count, is_duplicate,
//   reporter_name, assignee_name,
//   comments: [{ id, body, author_name, created_at }],
//   created_at, updated_at, resolved_at
// }
```

### 2.3 Nearby Incidents

**`GET /incidents/nearby?lat=&lon=&radius_metres=500&page=1&page_size=20`** — No auth.

```typescript
const res = await fetch(`${API}/incidents/nearby?lat=6.9271&lon=3.3958&radius_metres=200`);
const { data } = await res.json();
// data: {
//   items: [{ id, type, severity, status, address_label, upvote_count, distance_metres }],
//   total, page, page_size, has_next
// }
```

### 2.4 Incidents by Zone

**`GET /incidents/zone/:zone?status=&type=&page=&page_size=`** — Requires `resident`+ auth (Bearer token).

```typescript
// zone e.g. "Zone A", "Zone B"
const res = await fetch(`${API}/incidents/zone/Zone%20A?status=submitted`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 2.5 Upvote

**`POST /incidents/:id/upvote`** — Requires `resident`+ auth.

```typescript
const res = await fetch(`${API}/incidents/${id}/upvote`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
// 409 if already upvoted
```

### 2.6 Comment

**`POST /incidents/:id/comments`** — Requires `resident`+ auth.

```typescript
const res = await fetch(`${API}/incidents/${id}/comments`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ body: "I saw this too!" }),
});
```

### 2.7 Status Update (Admin)

**`PATCH /incidents/:id/status`** — Requires `admin` role.

```typescript
fetch(`${API}/incidents/${id}/status`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ status: "in_progress", note: "Crew dispatched" }),
});
```

Valid transitions: `submitted → assigned → in_progress → resolved → closed` (no skipping, no backwards).

### 2.8 Assign (Admin)

**`PATCH /incidents/:id/assign`** — Requires `admin` role.

```typescript
fetch(`${API}/incidents/${id}/assign`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ assigned_to: "user-uuid", department: "infrastructure" }),
});
```

---

## M3 — Routing & Navigation

### 3.1 Calculate Route

**`POST /routes/calculate`** — No auth required (guest users can calculate routes).

Request body:
```json
{
  "origin": { "lat": 6.9271, "lon": 3.3958 },
  "destination": { "lat": 6.9310, "lon": 3.4001 },
  "mode": "walking"
}
```

`mode` values: `"walking"` | `"tricycle"`

Response:
```json
{
  "success": true,
  "data": {
    "polyline": "sv~mF~pmYOAo@KA",
    "distance_metres": 450.2,
    "duration_seconds": 324.0,
    "origin": { "lat": 6.9271, "lon": 3.3958 },
    "destination": { "lat": 6.9310, "lon": 3.4001 },
    "mode": "walking",
    "cache_hit": false,
    "segments": []
  }
}
```

**Caching**: Routes are cached in Redis for 5 minutes. Repeated requests for the same origin+destination+mode return `cache_hit: true` (faster, no external API call). The response polyline is encoded using the Google Polyline Algorithm (§3.5).

### 3.2 Reroute (Avoid Segments)

**`POST /routes/reroute`** — No auth required.

Same as `/calculate` but with an additional `avoid_segment_ids` array:
```json
{
  "origin": { "lat": 6.9271, "lon": 3.3958 },
  "destination": { "lat": 6.9310, "lon": 3.4001 },
  "mode": "walking",
  "avoid_segment_ids": ["uuid-of-blocked-road"]
}
```

### 3.3 List Restricted Segments

**`GET /routes/segments/restricted`** — Requires `resident`+ auth.

```typescript
const res = await fetch(`${API}/routes/segments/restricted`, {
  headers: { Authorization: `Bearer ${token}` },
});
// data: [{ id, road_id, name, zone, restriction_reason }]
```

Used to display closed/restricted roads on the map (e.g., in red).

### 3.4 List All Segments (with geometry)

**`GET /routes/segments`** — No auth required.

Returns all road segments with their GeoJSON geometry for rendering on the map:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "road_id": "main-avenue",
      "name": "Main Avenue",
      "zone": "Zone A",
      "speed_limit": null,
      "is_restricted": false,
      "restriction_reason": null,
      "geometry": {
        "type": "LineString",
        "coordinates": [[3.3958, 6.9271], [3.3975, 6.9285], [3.4001, 6.9310]]
      }
    }
  ]
}
```

### 3.5 Decoding the Polyline (Client-side)

The `polyline` field in route responses uses the **Google Polyline Encoding Algorithm**. You must decode it on the client to get coordinates for the map.

**TypeScript decoder** (mirrors the Python server implementation):

```typescript
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}
```

Or use the `@mapbox/polyline` npm package which implements the same algorithm.

### 3.6 Rendering the Route on Mapbox

```typescript
import polyline from "@mapbox/polyline";
// or your own decoder

const routeCoords = polyline.decode(data.polyline); // [[lat, lng], ...]
const geojson: GeoJSON.Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "LineString",
    coordinates: routeCoords.map(([lat, lng]) => [lng, lat]), // GeoJSON is [lng, lat]
  },
};

map.addSource("route", { type: "geojson", data: geojson });
map.addLayer({
  id: "route-line",
  type: "line",
  source: "route",
  paint: {
    "line-color": "#3b82f6",
    "line-width": 4,
    "line-opacity": 0.8,
  },
});
```

### 3.7 Admin — Restrict a Segment

**`PATCH /routes/segments/:id/restrict`** — Requires `admin` role.

```typescript
fetch(`${API}/routes/segments/${segmentId}/restrict`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ reason: "Incident blocking road" }),
});
// Response includes cache_entries_invalidated count
```

### 3.8 Admin — Clear a Restriction

**`PATCH /routes/segments/:id/clear`** — Requires `admin` role.

```typescript
fetch(`${API}/routes/segments/${segmentId}/clear`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## Auto-restriction Flow (Event-Driven)

You don't need to manually call restrict/clear during normal operation. The backend automatically:

1. **On `incident.created`** → finds nearby road segments → restricts them → invalidates affected route caches
2. **On `incident.resolved`** → clears restriction on nearby segments → invalidates caches
3. **On `congestion.confirmed`** → invalidates route caches in the affected zone
4. **On `congestion.cleared`** → same invalidation

This means the frontend should **refetch restricted segments** and **recalculate routes** after these events occur. If your app uses WebSocket connections, the backend will publish events on Redis channels — you can subscribe to these for real-time updates:

```typescript
// WebSocket events to watch for (if you have a WS connection):
// "incident.created" → refetch incident + restricted segments
// "incident.resolved" → refetch restricted segments
// "routing.cache_invalidated" → recalculate active route
```

---

## Error Handling

All endpoints follow the standard error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "field": null
  },
  "meta": { "timestamp": 1716912000, "request_id": "uuid" }
}
```

### Common M2 error codes

| Code | Status | Meaning |
|---|---|---|
| `LOCATION_OUTSIDE_BOUNDARY` | 422 | Coordinates outside camp boundary |
| `INCIDENT_NOT_FOUND` | 404 | Invalid incident ID |
| `ALREADY_UPVOTED` | 409 | Duplicate upvote |
| `INCIDENT_CLOSED` | 422 | Cannot upvote/comment on closed incident |
| `INVALID_STATUS_TRANSITION` | 422 | Status transition not allowed |

### Common M3 error codes

| Code | Status | Meaning |
|---|---|---|
| `NO_ROUTE_FOUND` | 422 | No route between origin and destination |
| `SEGMENT_NOT_FOUND` | 404 | Invalid segment ID |
| `UPSTREAM_UNAVAILABLE` | 503 | Mapbox/ORS circuit breaker open |

---

## Auth Headers

| Role | Requires Bearer Token |
|---|---|
| Guest (anonymous) | No |
| Resident | Yes |
| Admin | Yes |

Add token to requests: `Authorization: Bearer <access_token>`

The rate limit headers come back on every response:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-RateLimit-Role`

---

## Quick Reference: Endpoint Table

| Method | Path | Auth | M |
|---|---|---|---|
| POST | `/incidents` | None | M2 |
| GET | `/incidents/:id` | None | M2 |
| GET | `/incidents/nearby` | None | M2 |
| GET | `/incidents/zone/:zone` | Resident+ | M2 |
| POST | `/incidents/:id/upvote` | Resident+ | M2 |
| POST | `/incidents/:id/comments` | Resident+ | M2 |
| PATCH | `/incidents/:id/status` | Admin | M2 |
| PATCH | `/incidents/:id/assign` | Admin | M2 |
| POST | `/routes/calculate` | None | M3 |
| POST | `/routes/reroute` | None | M3 |
| GET | `/routes/segments` | None | M3 |
| GET | `/routes/segments/restricted` | Resident+ | M3 |
| PATCH | `/routes/segments/:id/restrict` | Admin | M3 |
| PATCH | `/routes/segments/:id/clear` | Admin | M3 |
