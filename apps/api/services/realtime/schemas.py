"""WebSocket message schemas for the realtime service."""

from typing import Any

from pydantic import BaseModel


class LocationPingPayload(BaseModel):
    lat: float
    lon: float
    accuracy: float | None = None
    timestamp: int | None = None


class WsInboundMessage(BaseModel):
    """Generic inbound WebSocket message envelope."""

    type: str
    payload: dict[str, Any] = {}


class WsOutboundMessage(BaseModel):
    """Generic outbound WebSocket message envelope."""

    type: str
    payload: dict[str, Any] = {}


class ZoneAlertPayload(BaseModel):
    zone: str
    severity: str
    status: str
    ping_count: int | None = None
    flagged_at: int | None = None
