import json

from core.events import Event
from core.redis import get_redis

SOURCE_SERVICE = "incident"


async def publish_event(event_type: str, payload: dict) -> None:
    event = Event(event_type, payload, SOURCE_SERVICE)
    try:
        redis = get_redis()
        await redis.publish(event_type, event.to_json())
    except Exception:
        pass


async def publish_incident_created(
    incident_id: str,
    incident_type: str,
    location: dict,
    severity: str,
    zone: str | None,
    reporter_id: str | None = None,
) -> None:
    await publish_event("incident.created", {
        "incident_id": incident_id,
        "type": incident_type,
        "location": location,
        "severity": severity,
        "zone": zone,
        "reporter_id": reporter_id,
    })


async def publish_incident_status_changed(
    incident_id: str,
    status: str,
    reporter_id: str | None = None,
    note: str | None = None,
) -> None:
    await publish_event("incident.status", {
        "incident_id": incident_id,
        "status": status,
        "reporter_id": reporter_id,
        "note": note,
    })


async def publish_incident_resolved(
    incident_id: str,
    incident_type: str,
    location: dict,
    zone: str | None,
) -> None:
    await publish_event("incident.resolved", {
        "incident_id": incident_id,
        "type": incident_type,
        "location": location,
        "zone": zone,
    })
