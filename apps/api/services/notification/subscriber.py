"""Event subscriber for notification service.

Listens to incident and congestion events to send in-app
and push notifications to affected users.
"""

import logging

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.subscriber import BaseSubscriber
from services.notification.service import (
    send_in_app_notification,
    send_push_notification,
    send_zone_broadcast,
)

logger = logging.getLogger(__name__)


class NotificationSubscriber(BaseSubscriber):
    channels = [
        "incident.created",
        "incident.status",
        "incident.resolved",
        "congestion.confirmed",
        "congestion.cleared",
        "congestion.anticipated",
        "notification.broadcast",
    ]

    def __init__(self, redis_client: redis.Redis, session_factory):
        super().__init__(redis_client)
        self.session_factory = session_factory

    async def handle(self, channel: str, payload: dict) -> None:
        logger.info("NotificationSubscriber received event on %s", channel)

        if channel == "incident.created":
            await self._on_incident_created(payload)
        elif channel == "incident.status":
            await self._on_incident_status(payload)
        elif channel == "incident.resolved":
            await self._on_incident_resolved(payload)
        elif channel == "congestion.confirmed":
            await self._on_congestion_confirmed(payload)
        elif channel == "congestion.cleared":
            await self._on_congestion_cleared(payload)
        elif channel == "congestion.anticipated":
            await self._on_congestion_anticipated(payload)
        elif channel == "notification.broadcast":
            await self._on_notification_broadcast(payload)

    async def _on_incident_created(self, payload: dict) -> None:
        incident_type = payload.get("type", "unknown")
        zone = payload.get("zone", "unknown")
        severity = payload.get("severity", "low")
        reporter_id = payload.get("reporter_id")
        
        async with self.session_factory() as session:
            # Broadcast to all users in the zone
            await send_zone_broadcast(
                session=session,
                zone=zone,
                title=f"New {incident_type} reported",
                body=f"A {severity} severity {incident_type} has been reported in {zone}.",
            )
            
            # If authenticated reporter, send targeted confirmation
            if reporter_id:
                await send_in_app_notification(
                    session=session,
                    user_id=reporter_id,
                    type="incident_update",
                    title="Report received",
                    body=f"Your report of {incident_type} in {zone} has been received.",
                    data={"incident_id": payload.get("incident_id")},
                )

    async def _on_incident_status(self, payload: dict) -> None:
        incident_id = payload.get("incident_id", "unknown")
        status = payload.get("status", "unknown")
        reporter_id = payload.get("reporter_id")

        async with self.session_factory() as session:
            if reporter_id:
                # Targeted to reporter
                await send_in_app_notification(
                    session=session,
                    user_id=reporter_id,
                    type="incident_update",
                    title=f"Incident status updated",
                    body=f"Your incident report {incident_id[:8]}... is now {status}.",
                    data={"incident_id": incident_id, "status": status},
                )
                await send_push_notification(
                    session=session,
                    user_id=reporter_id,
                    type="incident_update",
                    title=f"Incident {status}",
                    body=f"The status of your report has been updated to {status}.",
                    data={"incident_id": incident_id},
                )
            else:
                # Fallback to broadcast if no reporter_id (anonymous)
                await send_in_app_notification(
                    session=session,
                    user_id="*",
                    type="incident_update",
                    title=f"Incident status updated",
                    body=f"Incident {incident_id[:8]}... is now {status}.",
                    data={"incident_id": incident_id, "status": status},
                )

    async def _on_incident_resolved(self, payload: dict) -> None:
        incident_id = payload.get("incident_id", "unknown")
        zone = payload.get("zone", "unknown")
        async with self.session_factory() as session:
            await send_in_app_notification(
                session=session,
                user_id="*",
                type="incident_update",
                title="Incident resolved",
                body=f"An incident in {zone} has been resolved.",
                data={"incident_id": incident_id},
            )

    async def _on_congestion_confirmed(self, payload: dict) -> None:
        zone = payload.get("zone", "unknown")
        severity = payload.get("severity", "low")
        ping_count = payload.get("ping_count", 0)
        async with self.session_factory() as session:
            await send_zone_broadcast(
                session=session,
                zone=zone,
                title="Congestion alert",
                body=f"Zone {zone} is congested ({severity}, {ping_count} pings).",
            )

    async def _on_congestion_cleared(self, payload: dict) -> None:
        zone = payload.get("zone", "unknown")
        async with self.session_factory() as session:
            await send_zone_broadcast(
                session=session,
                zone=zone,
                title="Congestion cleared",
                body=f"Zone {zone} is no longer congested.",
            )

    async def _on_congestion_anticipated(self, payload: dict) -> None:
        zone = payload.get("zone", "unknown")
        eta = payload.get("eta_minutes", 10)
        async with self.session_factory() as session:
            await send_zone_broadcast(
                session=session,
                zone=zone,
                title="Anticipated congestion",
                body=f"Zone {zone} may become congested in ~{eta} minutes.",
            )

    async def _on_notification_broadcast(self, payload: dict) -> None:
        zone = payload.get("zone", "")
        title = payload.get("title", "")
        body = payload.get("body", "")
        async with self.session_factory() as session:
            await send_zone_broadcast(
                session=session,
                zone=zone,
                title=title,
                body=body,
            )
