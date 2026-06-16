# CampPulse Web — From Scratch Setup Guide

This guide walks through starting the CampPulse admin web app from a clean slate, including infrastructure, backend, and frontend.

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20+ | `node -v` |
| pnpm | 9+ | `pnpm -v` |
| Docker | 24+ | `docker -v` |
| Docker Compose | v2 | `docker compose version` |

---

## 2. Environment Variables

```bash
# From repo root:
cp .env.example .env
```

Edit `.env` with your values. Minimum required for the web app to work:

```ini
# Database (Docker defaults are fine — keep as-is)
DATABASE_URL=postgresql+asyncpg://camppulse:devpassword@localhost:5432/camppulse_dev
REDIS_URL=redis://localhost:6379

# Auth — change this in production
JWT_SECRET=minimum_32_char_secret_key_change_me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Mapbox — REQUIRED for map rendering. Get a free public token at https://account.mapbox.com
MAPBOX_TOKEN=pk.eyJ...

# Web app — must match API URL
VITE_API_URL=http://localhost:8000
```

Then copy Mapbox token to the web env file too:

```bash
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env and set your real VITE_MAPBOX_TOKEN
```

> **No Mapbox token?** The app will still start but the map pages will show a "Mapbox token not configured" message. Routes can still be calculated via the API (text results work).

---

## 3. Start Infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d postgres redis
```

This starts:
- **PostgreSQL + PostGIS** on port `5433`
- **Redis** on port `6379`

Wait a few seconds, then verify:

```bash
docker compose -f infra/docker-compose.yml ps
```

Both should show `Up` and `healthy`.

---

## 4. Install Dependencies

```bash
pnpm install
```

---

## 5. Run Database Migrations

The API container handles migrations. Start it:

```bash
docker compose -f infra/docker-compose.yml up -d api
```

Then run migrations inside the container:

```bash
docker compose -f infra/docker-compose.yml exec api alembic upgrade head
```

Verify the API is healthy:

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","db":"ok","redis":"ok"}
```

---

## 6. Seed the Database (optional but recommended)

Seeds camp events data so the Events page has content:

```bash
docker compose -f infra/docker-compose.yml exec api python seed.py
```

This populates 7 camp events (Holy Ghost Service, WIT, Youth Sunday, etc.).

---

## 7. Create an Admin User

Currently there's no self-registration for admin accounts (admin is assigned via DB). Use the API to create one:

```bash
# Register a resident account
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@camppulse.io",
    "password": "admin123!",
    "full_name": "Camp Admin",
    "role": "resident"
  }'
```

Then promote to admin directly in the database:

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U camppulse -d camppulse_dev -c \
  "UPDATE users SET role = 'admin' WHERE email = 'admin@camppulse.io';"
```

---

## 8. Start the Web App

```bash
pnpm --filter @camppulse/web dev
```

Open **http://localhost:3000** in your browser.

---

## 9. Login & Walkthrough

### Login screen
- Email: `admin@camppulse.io`
- Password: `admin123!`
- You'll be redirected to the admin dashboard after successful login

### Dashboard (`/admin`)
Shows real data from the backend via GraphQL:
- Total/open/in-progress/congestion counts
- Recent reports list
- Activity breakdown by zone

### Reports (`/admin/incidents`)
- Lists all incidents from the database
- Filter by severity, status, zone, or search by type/location
- **Assign** button — transitions status to `assigned`
- **Resolve** button — transitions status to `resolved`

### Camp Map (`/admin/map`)
- Real Mapbox map centered on Redemption City
- Incident markers (color-coded: red=critical, orange=high, yellow=medium, green=low)
- Small blue dots = active users (from Redis location pings)
- Auto-refreshes every 30 seconds
- Click any incident → detail popup
- Right sidebar shows open reports list + area breakdown

### Analytics (`/admin/analytics`)
- Charts computed from live data via GraphQL:
  - Reports by area
  - Reports by issue type
  - Severity breakdown
  - Incident hotspots
  - Equity metrics (avg resolution time per zone)

### Events (`/admin/events`)
- Lists camp events from the `camp_events` table (seeded in step 6)
- Filter by category (service, conference, youth, special) or status
- **+ New Event** button to create events (admin only)
- Each event card has a delete button (×)

### Announcements (`/admin/broadcast`)
- Select target zone(s), set priority, write a message
- Send calls `sendZoneBroadcast` GraphQL mutation
- History is stored in localStorage

### Response Teams (`/admin/drivers`)
- Shows active users from Redis `location:user:*` keys
- Updates in real-time with 30s TTL data

### Guest Navigation (`/nav`) — **public, no login required**
- Open http://localhost:3000/nav in an incognito/private window
- Mapbox map with your location (blue dot) or fallback to camp center
- Select a destination from the dropdown → tap **Go**
- Route is calculated via the API → polyline decoded → drawn on map
- Sidebar shows distance (km) + estimated duration (min)

---

## 10. Creating Test Data

To create sample incidents for testing the dashboard:

```bash
# Create a critical incident (requires multipart upload)
curl -X POST http://localhost:8000/api/v1/incidents \
  -F "type=flooding" \
  -F "lat=6.876" \
  -F "lon=3.383" \
  -F "severity=critical" \
  -F "description=Flooding near the Medical Centre"

# Create a few more with different types/locations
curl -X POST http://localhost:8000/api/v1/incidents \
  -F "type=congestion" \
  -F "lat=6.881" \
  -F "lon=3.383" \
  -F "severity=high" \
  -F "description=Heavy traffic at North Gate entrance"

curl -X POST http://localhost:8000/api/v1/incidents \
  -F "type=streetlight" \
  -F "lat=6.875" \
  -F "lon=3.390" \
  -F "severity=medium" \
  -F "description=Streetlight out in Festival Arena east pathway"
```

---

## 11. Environment Summary

| Variable | Required for | Default |
|---|---|---|
| `DATABASE_URL` | API — database connection | `postgresql+asyncpg://camppulse:devpassword@localhost:5432/camppulse_dev` |
| `REDIS_URL` | API — Redis connection | `redis://localhost:6379` |
| `JWT_SECRET` | API — token signing | `minimum_32_char_secret_key_change_me` |
| `MAPBOX_TOKEN` | API — directions API + **Web** — map tiles | ` ` (empty, set yours) |
| `VITE_API_URL` | Web — backend URL | `http://localhost:8000` |
| `VITE_MAPBOX_TOKEN` | Web — Mapbox map rendering | ` ` (set same as MAPBOX_TOKEN) |

> **Tip**: `VITE_MAPBOX_TOKEN` and `MAPBOX_TOKEN` can be the same Mapbox public token. The backend uses it for the Directions API; the frontend uses it for rendering tiles. A single Mapbox public token works for both.

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `GET /health` returns `"db":"error"` | PostgreSQL not started or wrong URL | `docker compose up -d postgres`; check port 5433 |
| `GET /health` returns `"redis":"error"` | Redis not started | `docker compose up -d redis` |
| Login returns 401 | Wrong credentials | Re-check password or create a new user (step 7) |
| Login returns "Login failed" | No admin user exists | Create + promote a user (step 7) |
| Map shows "Mapbox token not configured" | `VITE_MAPBOX_TOKEN` not set | Edit `apps/web/.env` with your token, restart dev server |
| API returns 500 on route calc | `MAPBOX_TOKEN` missing or circuit breaker open | Set `MAPBOX_TOKEN` in `.env`, restart API |
| Blank white page at localhost:3000 | Dev server crashed | Check terminal for errors; run `pnpm --filter @camppulse/web dev` again |
| `pnpm install` fails | Network issue or outdated lockfile | Run `pnpm install --no-frozen-lockfile` |
| Migrations fail | Alembic can't find versions | Ensure `alembic/versions/` directory has migration files |
| Port 8000 already in use | Another service on that port | Stop the other service or change API port in docker-compose |
