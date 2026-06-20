"""Routing event publisher (Level 4 — Redis pub/sub only)."""

import time

import redis.asyncio as redis

from core.events import Event

_SOURCE = "routing"


async def publish_cache_invalidated(
    redis_client: redis.Redis,
    zone: str | None = None,
    reason: str = "",
) -> None:
    event = Event(
        event_type="routing.cache_invalidated",
        payload={
            "zone": zone,
            "reason": reason,
            "invalidated_at": int(time.time()),
        },
        source_service=_SOURCE,
    )
    await redis_client.publish("routing.cache_invalidated", event.to_json())
