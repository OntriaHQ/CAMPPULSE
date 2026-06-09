# CampPulse — Technical Documentation
**Section 5: API Design**

---

# Section 5: API Design

## 5.1 Design Principles

- **REST for commands and simple resource operations.** Create, update, delete, and straightforward reads follow REST conventions with predictable URL patterns and HTTP semantics.
- **GraphQL for complex reads.** Admin dashboard queries, analytics, and multi-entity joins use GraphQL to eliminate over-fetching and give consumers precise control over response shape.
- **WebSocket for continuous bidirectional streams.** Location pings, route updates, congestion alerts, and incident broadcasts operate over persistent WebSocket connections.
- **Consistent error envelope.** Every error response — REST, GraphQL, or WebSocket — follows the same structure so clients handle errors uniformly.
- **Versioning from day one.** All REST endpoints are prefixed `/api/v1/` to support non-breaking evolution.

---

## 5.2 Base URL and Versioning

```
Production:   https://api.camppulse.ng/api/v1
Development:  http://localhost:8000/api/v1
WebSocket:    wss://api.camppulse.ng/ws
GraphQL:      https://api.camppulse.ng/graphql
```

---

## 5.3 Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

**Token lifecycle:**
```
Access token:   JWT, 15 minute expiry, carries { user_id, role, jti }
Refresh token:  Opaque string, 7 day expiry, stored as hash in Redis + DB
Guest access:   No token required — public endpoints return reduced payloads
```

**Role hierarchy:**
```
guest < resident < driver < admin
```

Each endpoint documents its minimum required role. A higher role always satisfies a lower role requirement.

---

## 5.4 Standard Response Envelope

### Success
```json
{
  "success": true,
  "data": { },
  "meta": {
    "timestamp": 1716912000,
    "request_id": "uuid"
  }
}
```

### Paginated Success
```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "timestamp": 1716912000,
    "request_id": "uuid",
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 143,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "INCIDENT_NOT_FOUND",
    "message": "No incident found with the provided ID.",
    "field": null
  },
  "meta": {
    "timestamp": 1716912000,
    "request_id": "uuid"
  }
}
```

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload validation failed.",
    "fields": [
      { "field": "lat", "message": "Value must be between -90 and 90." },
      { "field": "type", "message": "Invalid incident type." }
    ]
  }
}
```

---

## 5.5 HTTP Status Code Convention

| Code | Usage |
|---|---|
| 200 | Successful GET, PATCH |
| 201 | Successful POST — resource created |
| 204 | Successful DELETE — no body |
| 400 | Validation error or malformed request |
| 401 | Missing or invalid authentication token |
| 403 | Authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Conflict — duplicate resource or state violation |
| 422 | Unprocessable entity — passes validation but fails business rules |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Upstream dependency unavailable (circuit breaker open) |

---

## 5.6 Auth Service Endpoints

### POST /api/v1/auth/register
Register a new resident or driver account.

**Auth required:** None
**Request:**
```json
{
  "email": "user@example.com",
  "password": "min_8_chars",
  "full_name": "Adaeze Okonkwo",
  "phone": "+2348012345678",
  "role": "resident",
  "camp_id": "RC-2024-00142",
  "zone": "Zone A"
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "Adaeze Okonkwo",
      "role": "resident",
      "kyc_status": "pending"
    },
    "tokens": {
      "access_token": "eyJ...",
      "refresh_token": "opaque_string",
      "expires_in": 900
    }
  }
}
```
**Error codes:** `EMAIL_TAKEN`, `INVALID_ROLE`, `VALIDATION_ERROR`

---

### POST /api/v1/auth/login
**Auth required:** None
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "role": "resident", "kyc_status": "verified" },
    "tokens": {
      "access_token": "eyJ...",
      "refresh_token": "opaque_string",
      "expires_in": 900
    }
  }
}
```
**Error codes:** `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`

---

### POST /api/v1/auth/refresh
**Auth required:** None (refresh token in body)
**Request:**
```json
{ "refresh_token": "opaque_string" }
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "new_opaque_string",
    "expires_in": 900
  }
}
```
**Error codes:** `INVALID_REFRESH_TOKEN`, `SESSION_EXPIRED`

---

### POST /api/v1/auth/logout
**Auth required:** Resident+
**Request:** Empty body
**Response 204:** No content
**Behaviour:** Blacklists current access token JTI in Redis, deletes refresh token.

---

## 5.7 User Management Endpoints

### GET /api/v1/users/me
**Auth required:** Resident+
**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Adaeze Okonkwo",
    "phone": "+2348012345678",
    "role": "resident",
    "kyc_status": "verified",
    "camp_id": "RC-2024-00142",
    "zone": "Zone A",
    "created_at": "2026-05-01T08:00:00Z"
  }
}
```

---

### PATCH /api/v1/users/me
**Auth required:** Resident+
**Request:** Any subset of updatable fields
```json
{
  "full_name": "Adaeze O. Okonkwo",
  "phone": "+2348099999999",
  "zone": "Zone B"
}
```
**Response 200:** Updated user object
**Error codes:** `VALIDATION_ERROR`

---

### GET /api/v1/users/drivers/available
**Auth required:** Resident+
**Query params:** `lat`, `lon`, `radius_metres` (default 2000)
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "driver_id": "uuid",
      "full_name": "Emeka Nwosu",
      "vehicle_type": "tricycle",
      "distance_metres": 320,
      "current_location": { "lat": 6.9271, "lon": 3.3958 }
    }
  ]
}
```

---

### PATCH /api/v1/users/:id/role
**Auth required:** Admin
**Request:**
```json
{ "role": "driver" }
```
**Response 200:** Updated user object
**Error codes:** `USER_NOT_FOUND`, `INVALID_ROLE`

---

### PATCH /api/v1/users/:id/kyc
**Auth required:** Admin
**Request:**
```json
{ "kyc_status": "verified" }
```
**Response 200:** Updated user object

---

## 5.8 Incident Management Endpoints

### POST /api/v1/incidents
Submit a new incident report.

**Auth required:** None (guests can report anonymously)
**Content-Type:** `multipart/form-data`
**Request fields:**
```
type:        string (required) — incident_type enum value
description: string (optional)
lat:         float (required)
lon:         float (required)
severity:    string (optional, default: "low")
photo:       file (optional, image/jpeg or image/png, max 5MB)
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "incident_id": "uuid",
    "is_duplicate": false,
    "parent_incident_id": null,
    "status": "submitted",
    "department": "infrastructure",
    "estimated_response_window": "2–4 hours",
    "photo_url": "https://uploads.camppulse.ng/incidents/uuid/photo.jpg"
  }
}
```
**Duplicate response 201:**
```json
{
  "success": true,
  "data": {
    "incident_id": "uuid",
    "is_duplicate": true,
    "parent_incident_id": "parent_uuid",
    "parent_upvote_count": 4,
    "status": "in_progress",
    "message": "This issue has already been reported and is being addressed."
  }
}
```
**Error codes:** `LOCATION_OUTSIDE_BOUNDARY`, `INVALID_INCIDENT_TYPE`, `PHOTO_TOO_LARGE`

---

### GET /api/v1/incidents/:id
**Auth required:** None
**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "flooding",
    "description": "Road completely flooded near Block C gate",
    "photo_url": "https://...",
    "location": { "lat": 6.9271, "lon": 3.3958 },
    "address_label": "Block C, Zone A",
    "zone": "Zone A",
    "severity": "high",
    "status": "in_progress",
    "department": "infrastructure",
    "upvote_count": 7,
    "is_duplicate": false,
    "comments": [
      {
        "id": "uuid",
        "body": "This pothole floods badly in rain",
        "user": { "id": "uuid", "full_name": "Tunde B." },
        "created_at": "2026-05-18T09:30:00Z"
      }
    ],
    "created_at": "2026-05-18T08:00:00Z",
    "updated_at": "2026-05-18T09:00:00Z"
  }
}
```

---

### GET /api/v1/incidents/nearby
**Auth required:** None
**Query params:** `lat`, `lon`, `radius_metres` (default 500), `page`, `page_size`
**Response 200:** Paginated incident list sorted by distance ascending

---

### GET /api/v1/incidents/zone/:zone
**Auth required:** Resident+
**Query params:** `status`, `type`, `page`, `page_size`
**Response 200:** Paginated incident list for the specified zone

---

### POST /api/v1/incidents/:id/upvote
**Auth required:** Resident+
**Response 200:**
```json
{
  "success": true,
  "data": { "incident_id": "uuid", "upvote_count": 8 }
}
```
**Error codes:** `ALREADY_UPVOTED`, `INCIDENT_CLOSED`

---

### POST /api/v1/incidents/:id/comments
**Auth required:** Resident+
**Request:**
```json
{ "body": "This flooding started three weeks ago" }
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "comment_id": "uuid",
    "body": "This flooding started three weeks ago",
    "created_at": "2026-05-18T10:00:00Z"
  }
}
```

---

### PATCH /api/v1/incidents/:id/status
**Auth required:** Admin
**Request:**
```json
{
  "status": "in_progress",
  "note": "Team dispatched"
}
```
**Response 200:** Updated incident object

---

### PATCH /api/v1/incidents/:id/assign
**Auth required:** Admin
**Request:**
```json
{
  "assigned_to": "user_uuid",
  "department": "infrastructure"
}
```
**Response 200:** Updated incident object

---

## 5.9 Routing Service Endpoints

### POST /api/v1/routes/calculate
**Auth required:** None
**Request:**
```json
{
  "origin": { "lat": 6.9271, "lon": 3.3958 },
  "destination": { "lat": 6.9310, "lon": 3.4001 },
  "mode": "walking"
}
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "encoded_polyline": "abcdefgh...",
    "distance_metres": 820,
    "eta_seconds": 600,
    "restricted_segments_avoided": 1,
    "congestion_zones_avoided": ["Zone B"],
    "cached": false,
    "cached_at": null
  }
}
```
**Error codes:** `ORIGIN_OUTSIDE_BOUNDARY`, `DESTINATION_OUTSIDE_BOUNDARY`, `NO_ROUTE_FOUND`

---

### POST /api/v1/routes/reroute
Recalculate a route explicitly around a known restriction.

**Auth required:** None
**Request:**
```json
{
  "origin": { "lat": 6.9271, "lon": 3.3958 },
  "destination": { "lat": 6.9310, "lon": 3.4001 },
  "mode": "walking",
  "avoid_segment_ids": ["segment_uuid_1"]
}
```
**Response 200:** Same shape as `/routes/calculate`

---

### GET /api/v1/routes/segments/restricted
**Auth required:** Resident+
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "segment_id": "uuid",
      "name": "Block C Road",
      "zone": "Zone A",
      "restriction_reason": "flooding",
      "restricted_since": "2026-05-18T08:00:00Z"
    }
  ]
}
```

---

### PATCH /api/v1/routes/segments/:id/restrict
**Auth required:** Admin
**Request:**
```json
{ "reason": "road maintenance" }
```
**Response 200:** Updated segment object

---

### PATCH /api/v1/routes/segments/:id/clear
**Auth required:** Admin
**Response 200:** Updated segment object

---

## 5.10 WebSocket API

### Connection Endpoints

```
Authenticated:  wss://api.camppulse.ng/ws/location?token={access_token}
Guest:          wss://api.camppulse.ng/ws/location/guest
```

**Connection behaviour:**
- Authenticated connections: token validated on handshake, connection rejected if invalid
- Guest connections: accepted immediately, read-only stream (no ping ingestion)
- Heartbeat: client sends `ping` frame every 30 seconds; server responds with `pong`
- Reconnection: clients implement exponential backoff starting at 1 second

---

### Client → Server Messages

**Location Ping**
```json
{
  "type": "location_ping",
  "payload": {
    "lat": 6.9271,
    "lon": 3.3958,
    "accuracy": 10.5,
    "speed": 1.4,
    "heading": 270.0,
    "timestamp": 1716912000
  }
}
```

**Navigation Start**
```json
{
  "type": "navigation_start",
  "payload": {
    "destination": { "lat": 6.9310, "lon": 3.4001 },
    "mode": "walking",
    "encoded_polyline": "current_route_polyline"
  }
}
```
*Registers the user as an active navigator — eligible for proactive reroute pushes.*

**Navigation End**
```json
{
  "type": "navigation_end",
  "payload": {}
}
```

---

### Server → Client Messages

**Route Update**
Sent when an active navigator's current route is affected by a new incident or congestion event.
```json
{
  "type": "route_update",
  "payload": {
    "reason": "incident",
    "incident_id": "uuid",
    "affected_segment": "segment_uuid",
    "new_route": {
      "encoded_polyline": "new_polyline_string",
      "distance_metres": 950,
      "eta_seconds": 720
    }
  }
}
```

**Zone Alert**
Sent to all users in or approaching a congested zone.
```json
{
  "type": "zone_alert",
  "payload": {
    "zone": "Zone A",
    "status": "congested",
    "severity": "high",
    "message": "High congestion detected near Zone A. Consider alternative routes.",
    "suggested_alternatives": [
      "Zone B via Road 3 — 8 min",
      "Zone C via Main Gate — 12 min"
    ]
  }
}
```

**Incident Nearby**
Sent when a new high-severity incident is reported within 300 metres of a connected user.
```json
{
  "type": "incident_nearby",
  "payload": {
    "incident_id": "uuid",
    "type": "flooding",
    "severity": "high",
    "distance_metres": 145,
    "address_label": "Block C, Zone A"
  }
}
```

**Congestion Clearing**
```json
{
  "type": "zone_clearing",
  "payload": {
    "zone": "Zone A",
    "message": "Congestion in Zone A is clearing. Routes restored."
  }
}
```

**Error**
```json
{
  "type": "error",
  "payload": {
    "code": "INVALID_PING",
    "message": "Location ping rejected — coordinates outside camp boundary."
  }
}
```

---

## 5.11 GraphQL Schema

### 5.11.1 Types
```graphql
enum UserRole { GUEST RESIDENT DRIVER ADMIN }
enum KycStatus { PENDING VERIFIED REJECTED }
enum IncidentType {
  FLOODING POTHOLE STREETLIGHT WATER_LEAK
  TRASH SECURITY CONGESTION OTHER
}
enum IncidentStatus { SUBMITTED ASSIGNED IN_PROGRESS RESOLVED CLOSED }
enum IncidentSeverity { LOW MEDIUM HIGH CRITICAL }
enum Department { INFRASTRUCTURE SANITATION SECURITY UTILITIES EMERGENCY }
enum CongestionStatus { CLEAR ANTICIPATED PENDING_VALIDATION CONGESTED }

type User {
  id: ID!
  email: String
  fullName: String!
  role: UserRole!
  kycStatus: KycStatus!
  zone: String
  driverProfile: DriverProfile
  createdAt: String!
}

type DriverProfile {
  id: ID!
  vehicleType: String!
  isAvailable: Boolean!
  currentLocation: Location
  lastSeen: String
}

type Location {
  lat: Float!
  lon: Float!
}

type Incident {
  id: ID!
  type: IncidentType!
  description: String
  photoUrl: String
  location: Location!
  addressLabel: String
  zone: String
  severity: IncidentSeverity!
  status: IncidentStatus!
  department: Department
  upvoteCount: Int!
  isDuplicate: Boolean!
  assignedTo: User
  comments: [Comment!]!
  createdAt: String!
  updatedAt: String!
  resolvedAt: String
}

type Comment {
  id: ID!
  body: String!
  user: User!
  createdAt: String!
}

type CongestionZone {
  zone: String!
  status: CongestionStatus!
  severity: String
  flaggedAt: String
  confirmedAt: String
  pingCount: Int
}

type IncidentHotspot {
  zone: String!
  incidentCount: Int!
  resolvedCount: Int!
  avgResolutionHours: Float
  centroid: Location!
  topTypes: [IncidentTypeCount!]!
}

type IncidentTypeCount {
  type: IncidentType!
  count: Int!
}

type ResponseMetrics {
  avgResolutionHours: Float!
  totalOpen: Int!
  totalResolved: Int!
  resolutionRate: Float!
}

type EquityMetric {
  zone: String!
  reportCount: Int!
  resolvedCount: Int!
  avgResolutionHours: Float
  attentionScore: Float!
}

type DashboardSummary {
  openIncidents: OpenIncidentSummary!
  activeCongestionZones: [CongestionZone!]!
  responseMetrics: ResponseMetrics!
  activeDrivers: DriverSummary!
}

type OpenIncidentSummary {
  total: Int!
  bySeverity: [SeverityCount!]!
  byDepartment: [DepartmentCount!]!
}

type SeverityCount { severity: IncidentSeverity!; count: Int! }
type DepartmentCount { department: Department!; count: Int! }
type DriverSummary { total: Int!; availableNow: Int! }

input DateRangeInput {
  from: String!
  to: String
}

input IncidentFilterInput {
  status: IncidentStatus
  severity: IncidentSeverity
  department: Department
  type: IncidentType
  zone: String
  dateRange: DateRangeInput
  page: Int
  pageSize: Int
}

input UserFilterInput {
  role: UserRole
  kycStatus: KycStatus
  zone: String
}
```

### 5.11.2 Queries
```graphql
type Query {
  # Dashboard
  dashboardSummary: DashboardSummary!

  # Incidents
  incidents(filter: IncidentFilterInput): IncidentConnection!
  incident(id: ID!): Incident
  incidentHotspots(dateRange: DateRangeInput, zone: String): [IncidentHotspot!]!

  # Users
  users(filter: UserFilterInput): UserConnection!
  user(id: ID!): User

  # Analytics
  responseMetrics(dateRange: DateRangeInput, zone: String): ResponseMetrics!
  equityMetrics(dateRange: DateRangeInput): [EquityMetric!]!

  # Live state
  activeCongestionZones: [CongestionZone!]!
  restrictedSegments: [RoadSegment!]!
}

type IncidentConnection {
  nodes: [Incident!]!
  totalCount: Int!
  pageInfo: PageInfo!
}

type UserConnection {
  nodes: [User!]!
  totalCount: Int!
  pageInfo: PageInfo!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  currentPage: Int!
  totalPages: Int!
}
```

### 5.11.3 Mutations
```graphql
type Mutation {
  # Incident management
  updateIncidentStatus(id: ID!, status: IncidentStatus!, note: String): Incident!
  assignIncident(id: ID!, userId: ID!, department: Department!): Incident!
  bulkUpdateIncidentStatus(ids: [ID!]!, status: IncidentStatus!): BulkUpdateResult!
  markIncidentDuplicate(id: ID!, parentId: ID!): Incident!

  # Road segments
  restrictSegment(id: ID!, reason: String!): RoadSegment!
  clearSegment(id: ID!): RoadSegment!

  # User management
  updateUserRole(id: ID!, role: UserRole!): User!
  updateKycStatus(id: ID!, status: KycStatus!): User!

  # Broadcasts
  sendZoneBroadcast(zone: String!, title: String!, body: String!): BroadcastResult!
}

type BulkUpdateResult {
  updatedCount: Int!
  failedIds: [ID!]!
}

type BroadcastResult {
  recipientCount: Int!
  zone: String!
}
```

---

## 5.12 Error Code Registry

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request payload failed schema validation |
| `INVALID_CREDENTIALS` | 401 | Email/password mismatch |
| `MISSING_TOKEN` | 401 | Authorization header absent |
| `INVALID_TOKEN` | 401 | JWT malformed, expired, or blacklisted |
| `INSUFFICIENT_ROLE` | 403 | Authenticated but role too low |
| `USER_NOT_FOUND` | 404 | No user with provided ID |
| `INCIDENT_NOT_FOUND` | 404 | No incident with provided ID |
| `SEGMENT_NOT_FOUND` | 404 | No road segment with provided ID |
| `EMAIL_TAKEN` | 409 | Email already registered |
| `ALREADY_UPVOTED` | 409 | User has already upvoted this incident |
| `ACCOUNT_DISABLED` | 403 | User account deactivated |
| `INCIDENT_CLOSED` | 422 | Action not permitted on closed incident |
| `LOCATION_OUTSIDE_BOUNDARY` | 422 | Coordinates outside camp geofence |
| `NO_ROUTE_FOUND` | 422 | Routing engine could not find a valid path |
| `ORIGIN_OUTSIDE_BOUNDARY` | 422 | Route origin outside camp geofence |
| `DESTINATION_OUTSIDE_BOUNDARY` | 422 | Route destination outside camp geofence |
| `PHOTO_TOO_LARGE` | 400 | Uploaded photo exceeds 5MB limit |
| `INVALID_INCIDENT_TYPE` | 400 | Unrecognised incident type value |
| `INVALID_ROLE` | 400 | Unrecognised role value |
| `SESSION_EXPIRED` | 401 | Refresh token expired |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token not found or already used |
| `RATE_LIMITED` | 429 | Request rate limit exceeded |
| `UPSTREAM_UNAVAILABLE` | 503 | External dependency unreachable (circuit breaker open) |

---

## 5.13 Rate Limiting Headers

All responses include rate limit headers:
```
X-RateLimit-Limit:     300
X-RateLimit-Remaining: 247
X-RateLimit-Reset:     1716912060
X-RateLimit-Role:      resident
```

When limit is exceeded:
```
HTTP 429 Too Many Requests
Retry-After: 23
```

---

*Next: Section 6 — Monorepo Structure*
