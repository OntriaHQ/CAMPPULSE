# CampPulse

Camp navigation and incident management for Redemption City.

## Prerequisites

- **Node.js 20+** and **pnpm**
- **Docker Desktop** (PostGIS, Redis, API)
- **Git Bash or WSL** on Windows for `pnpm smoke` and shell scripts
- **Expo CLI** (optional, for mobile simulator verification)

Host Python is **not required** for daily development — the API runs in Docker.

## Quick start (Docker-first hybrid)

```bash
# 1. Clone + env
cp .env.example .env

# 2. Start infra + API (Docker — no host venv required)
docker compose -f infra/docker-compose.yml up -d postgres redis api

# 3. Install JS deps (once)
pnpm install

# 4. FE dev (local — pick what you need)
pnpm --filter @camppulse/web dev
pnpm --filter @camppulse/mobile dev
# or: turbo dev --filter=@camppulse/web --filter=@camppulse/mobile

# 5. M0 checkpoint
curl http://localhost:8000/health
turbo run type-check
pnpm smoke

# M1: apply migrations (always inside API container)
pnpm db:migrate
```

## Dev workflow

| Layer | How to run |
|---|---|
| PostgreSQL (PostGIS) + Redis | `docker compose -f infra/docker-compose.yml up -d postgres redis` |
| API (FastAPI) | `docker compose -f infra/docker-compose.yml up -d api` |
| Web (Vite + React) | `pnpm --filter @camppulse/web dev` → http://localhost:3000 |
| Mobile (Expo) | `pnpm --filter @camppulse/mobile dev` → Expo Go / simulator |

Root `pnpm dev` starts Docker (postgres, redis, api) then local web + mobile via Turborepo.

### Optional: DB-only for host-side API debugging

```bash
docker compose -f infra/docker-compose.yml up -d postgres redis
# Run API locally only if you need Python debugging (non-default)
```

## Project structure

```
camppulse/
├── apps/
│   ├── api/          # FastAPI modular monolith (Docker default)
│   ├── web/          # Vite React — guest nav + admin dashboard
│   └── mobile/       # Expo Router — resident/driver app
├── packages/
│   ├── constants/    # Shared enums and thresholds
│   ├── shared-types/ # TypeScript type definitions
│   └── map-config/   # GeoJSON, Mapbox style, hotspots
├── infra/            # Docker Compose, Fly.io config
├── scripts/          # smoke-test, seed, field-map
└── docs/             # Technical documentation
```

## Windows notes

- Use **Git Bash** or **WSL** for `bash scripts/smoke-test.sh` and `pnpm smoke`
- Docker Desktop must be running before compose commands

## Documentation

See [`docs/`](docs/) for architecture, API design, and milestone checkpoints.
