"""Event subscriber for routing service.

Listens to incident and congestion events to automatically
restrict road segments and invalidate route caches.
"""

import json
import logging

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.subscriber import BaseSubscriber
from services.routing.cache import invalidate_route_cache
from services.routing.service import apply_restriction, clear_restriction, get_segments_near_incident

logger = logging.getLogger(__name__)


class RoutingSubscriber(BaseSubscriber):
    channels = [
        "incident.created",
        "incident.resolved",
        "congestion.flagged",
        "congestion.confirmed",
        "congestion.cleared",
    ]

    def __init__(self, redis_client: redis.Redis, session_factory):
        super().__init__(redis_client)
        self.session_factory = session_factory

    async def handle(self, channel: str, payload: dict) -> None:
        logger.info("RoutingSubscriber received event on %s", channel)

        if channel == "incident.created":
            await self._on_incident_created(payload)
        elif channel == "incident.resolved":
            await self._on_incident_resolved(payload)
        elif channel == "congestion.confirmed":
            await self._on_congestion_confirmed(payload)
        elif channel == "congestion.flagged":
            await self._on_congestion_flagged(payload)
        elif channel == "congestion.cleared":
            await self._on_congestion_cleared(payload)

    async def _on_incident_created(self, payload: dict) -> None:
        location = payload.get("location", {})
        lat = location.get("lat")
        lon = location.get("lon")
        if lat is None or lon is None:
            return

        async with self.session_factory() as session:
            segments = await get_segments_near_incident(session, lon, lat)
            for seg in segments:
                reason = f"Incident {payload.get('incident_id', 'unknown')}: {payload.get('type', 'unknown')}"
                await apply_restriction(
                    seg["id"],
                    reason,
                    session,
                    self.redis,
                )
            await session.commit()

    async def _on_incident_resolved(self, payload: dict) -> None:
        location = payload.get("location", {})
        lat = location.get("lat")
        lon = location.get("lon")
        if lat is None or lon is None:
            return

        async with self.session_factory() as session:
            segments = await get_segments_near_incident(session, lon, lat)
            for seg in segments:
                await clear_restriction(
                    seg["id"],
                    session,
                    self.redis,
                )
            await session.commit()

    async def _on_congestion_confirmed(self, payload: dict) -> None:
        zone = payload.get("zone", "unknown")
        count = await invalidate_route_cache(self.redis)
        logger.info(
            "Invalidated %d route cache entries due to congestion in zone %s",
            count,
            zone,
        )

    async def _on_congestion_flagged(self, payload: dict) -> None:
        zone = payload.get("zone", "unknown")
        severity = payload.get("severity", "unknown")
        count = await invalidate_route_cache(self.redis)
        logger.info(
            "Invalidated %d route cache entries due to congestion.flagged in zone %s (severity=%s)",
            count,
            zone,
            severity,
        )

    async def _on_congestion_cleared(self, payload: dict) -> None:
        zone = payload.get("zone", "unknown")
        count = await invalidate_route_cache(self.redis)
        logger.info(
            "Invalidated %d route cache entries after congestion cleared in zone %s",
            count,
            zone,
        )
