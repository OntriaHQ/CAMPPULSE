"""Location service — Level 2 orchestration layer.

Validates pings, enforces geofence, resolves zone (cache-first),
stores location in Redis, and publishes location.ping event.
"""

import logging
import time

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.db.queries.locations import get_zone_for_point
from services.realtime.geofence import is_within_boundary
from services.realtime.publisher import publish_location_ping, store_location
from services.realtime.session_manager import add_session, remove_session

logger = logging.getLogger(__name__)

_ZONE_CACHE_TTL = 300  # 5 minutes
_ZONE_GRID_PRECISION = 3  # 3 decimal places ≈ 111m resolution


def _zone_cache_key(lat: float, lon: float) -> str:
    lat_r = round(lat, _ZONE_GRID_PRECISION)
    lon_r = round(lon, _ZONE_GRID_PRECISION)
    return f"zone:grid:{lat_r}:{lon_r}"


async def resolve_zone(
    redis_client: redis.Redis,
    session: AsyncSession,
    lat: float,
    lon: float,
) -> str | None:
    """Return zone name for a position. Cache-first (Redis grid), fallback to PostGIS."""
    cache_key = _zone_cache_key(lat, lon)
    cached = await redis_client.get(cache_key)
    if cached is not None:
        return cached if cached else None

    zone = await get_zone_for_point(session, lat, lon)
    # Cache even None results (store empty string) to avoid repeated DB hits
    await redis_client.setex(cache_key, _ZONE_CACHE_TTL, zone or "")
    return zone


async def ingest_ping(
    redis_client: redis.Redis,
    session: AsyncSession,
    user_id: str,
    lat: float,
    lon: float,
    accuracy: float | None = None,
    timestamp: int | None = None,
) -> bool:
    """Process an authenticated location ping.

    Returns True if the ping was accepted (within boundary), False if silently dropped.
    """
    if not is_within_boundary(lat, lon):
        logger.debug(
            "Ping from user %s at (%.5f, %.5f) is outside boundary — dropped silently",
            user_id,
            lat,
            lon,
        )
        return False

    zone = await resolve_zone(redis_client, session, lat, lon)
    ts = timestamp or int(time.time())

    await store_location(redis_client, user_id, lat, lon, zone)
    await publish_location_ping(redis_client, user_id, lat, lon, zone, ts)

    return True


async def register_session(redis_client: redis.Redis, user_id: str) -> None:
    await add_session(redis_client, user_id)


async def deregister_session(redis_client: redis.Redis, user_id: str) -> None:
    await remove_session(redis_client, user_id)
