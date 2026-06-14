"""Location ping publisher (Level 4 — Redis pub/sub only)."""

import time

import redis.asyncio as redis

from core.events import Event

_SOURCE = "realtime"
_LOCATION_TTL = 30  # seconds


async def store_location(
    redis_client: redis.Redis,
    user_id: str,
    lat: float,
    lon: float,
    zone: str | None,
) -> None:
    """Store user location hash in Redis with 30s TTL."""
    key = f"location:user:{user_id}"
    await redis_client.hset(
        key,
        mapping={
            "lat": str(lat),
            "lon": str(lon),
            "zone": zone or "",
            "timestamp": str(int(time.time())),
        },
    )
    await redis_client.expire(key, _LOCATION_TTL)


async def publish_location_ping(
    redis_client: redis.Redis,
    user_id: str,
    lat: float,
    lon: float,
    zone: str | None,
    timestamp: int | None = None,
) -> None:
    """Publish location.ping event to Redis pub/sub channel."""
    event = Event(
        event_type="location.ping",
        payload={
            "user_id": user_id,
            "lat": lat,
            "lon": lon,
            "zone": zone,
            "timestamp": timestamp or int(time.time()),
        },
        source_service=_SOURCE,
    )
    await redis_client.publish("location.ping", event.to_json())
