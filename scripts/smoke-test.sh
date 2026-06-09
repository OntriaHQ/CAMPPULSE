#!/usr/bin/env bash
set -euo pipefail

echo "--- M0: Foundation ---"

COMPOSE_FILE="infra/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" up -d postgres redis api

# Wait for API healthy
for i in {1..30}; do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

# DB check — inside API container
docker compose -f "$COMPOSE_FILE" exec -T api python -c "
import asyncio, asyncpg, os
async def test():
    url = os.environ['DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://', 1)
    conn = await asyncpg.connect(url)
    result = await conn.fetchval('SELECT PostGIS_Version()')
    print(f'PostGIS: {result}')
    await conn.close()
asyncio.run(test())
"

# Redis check — inside API container (redis.asyncio, NOT aioredis)
docker compose -f "$COMPOSE_FILE" exec -T api python -c "
import asyncio, os, redis.asyncio as redis
async def test():
    r = redis.from_url(os.environ['REDIS_URL'])
    pong = await r.ping()
    print(f'Redis ping: {pong}')
    await r.aclose()
asyncio.run(test())
"

# Health endpoint
HEALTH=$(curl -sf http://localhost:8000/health)
echo "Health: $HEALTH"
echo "$HEALTH" | grep -q '"status":"ok"'
echo "$HEALTH" | grep -q '"db":"ok"'
echo "$HEALTH" | grep -q '"redis":"ok"'

echo "M0 complete"

echo "--- M1: Auth ---"
docker compose -f "$COMPOSE_FILE" exec -T api alembic upgrade head
docker compose -f "$COMPOSE_FILE" exec -T redis sh -c 'for k in $(redis-cli --scan --pattern "ratelimit:*"); do redis-cli del "$k"; done' >/dev/null 2>&1 || true
docker compose -f "$COMPOSE_FILE" exec -T api python tests/smoke/test_m1_auth.py

echo "M1 complete"
