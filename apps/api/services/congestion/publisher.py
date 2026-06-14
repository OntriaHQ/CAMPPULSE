"""Congestion event publisher (Level 4 — Redis pub/sub only)."""

import time

import redis.asyncio as redis

from core.events import Event

_SOURCE = "congestion"


async def _publish(redis_client: redis.Redis, event_type: str, payload: dict) -> None:
    event = Event(event_type=event_type, payload=payload, source_service=_SOURCE)
    await redis_client.publish(event_type, event.to_json())


async def publish_congestion_flagged(
    redis_client: redis.Redis,
    zone: str,
    ping_count: int,
    severity: str,
) -> None:
    await _publish(redis_client, "congestion.flagged", {
        "zone": zone,
        "ping_count": ping_count,
        "severity": severity,
        "flagged_at": int(time.time()),
    })


async def publish_congestion_confirmed(
    redis_client: redis.Redis,
    zone: str,
    ping_count: int,
    severity: str,
) -> None:
    await _publish(redis_client, "congestion.confirmed", {
        "zone": zone,
        "ping_count": ping_count,
        "severity": severity,
        "confirmed_at": int(time.time()),
    })


async def publish_congestion_cleared(
    redis_client: redis.Redis,
    zone: str,
) -> None:
    await _publish(redis_client, "congestion.cleared", {
        "zone": zone,
        "cleared_at": int(time.time()),
    })


async def publish_congestion_anticipated(
    redis_client: redis.Redis,
    zone: str,
    hotspot_name: str,
    program_end_time: str,
) -> None:
    await _publish(redis_client, "congestion.anticipated", {
        "zone": zone,
        "hotspot_name": hotspot_name,
        "program_end_time": program_end_time,
        "anticipated_at": int(time.time()),
    })
