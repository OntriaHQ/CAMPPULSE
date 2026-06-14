"""Mobility index computation (Level 4 — Redis commands only)."""

import math

import redis.asyncio as redis

_MOBILITY_TTL = 120  # seconds
_DISPLACEMENT_THRESHOLD_METRES = 100.0


def _haversine_metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate distance in metres between two lat/lon points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def update_mobility(
    redis_client: redis.Redis,
    zone_id: str,
    user_id: str,
    lat: float,
    lon: float,
) -> None:
    """Increment zone mobility counter if user has moved >100m since last ping."""
    prev_key = f"location:user:{user_id}"
    prev = await redis_client.hgetall(prev_key)

    if prev and prev.get("lat") and prev.get("lon"):
        try:
            prev_lat = float(prev["lat"])
            prev_lon = float(prev["lon"])
            displacement = _haversine_metres(prev_lat, prev_lon, lat, lon)
            if displacement > _DISPLACEMENT_THRESHOLD_METRES:
                mob_key = f"mobility:active:{zone_id}"
                await redis_client.incr(mob_key)
                await redis_client.expire(mob_key, _MOBILITY_TTL)
        except (ValueError, KeyError):
            pass


async def get_mobility_index(
    redis_client: redis.Redis,
    zone_id: str,
    active_session_count: int,
) -> float:
    """Return normalised mobility index (0.0 – 1.0) for a zone."""
    if active_session_count <= 0:
        return 0.0
    mob_key = f"mobility:active:{zone_id}"
    raw = await redis_client.get(mob_key)
    mobile_count = int(raw) if raw else 0
    return min(1.0, mobile_count / active_session_count)
