"""WebSocket router for the realtime location service.

Endpoints:
  GET /ws/location?token={jwt}   — authenticated, can send pings
  GET /ws/location/guest         — anonymous, read-only

Zone connection manager allows congestion subscriber to fan-out alerts
to all connected clients in an affected zone.
"""

import json
import logging
import uuid
from typing import Any

import redis.asyncio as redis
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from core.connection_manager import connection_manager
from core.database import get_session_factory
from core.redis import get_redis
from services.auth.security import decode_access_token
from services.realtime.location_service import (
    deregister_session,
    ingest_ping,
    register_session,
)
from services.realtime.schemas import WsInboundMessage

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_message(msg_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"type": msg_type, "payload": payload}


def _decode_token_query(token: str) -> dict | None:
    try:
        return decode_access_token(token)
    except Exception:
        return None


async def _handle_ping(
    ws: WebSocket,
    payload: dict,
    user_id: str,
    redis_client: redis.Redis,
    session: AsyncSession,
    role: str | None = None,
) -> None:
    lat = payload.get("lat")
    lon = payload.get("lon")
    if lat is None or lon is None:
        return

    accepted = await ingest_ping(
        redis_client=redis_client,
        session=session,
        user_id=user_id,
        lat=float(lat),
        lon=float(lon),
        accuracy=payload.get("accuracy"),
        timestamp=payload.get("timestamp"),
        role=role,
    )

    if accepted:
        # Update zone mapping in connection manager
        # (zone resolved inside ingest_ping, we re-resolve cheaply from cache)
        from services.realtime.location_service import resolve_zone
        zone = await resolve_zone(redis_client, session, float(lat), float(lon))
        connection_manager.update_zone(ws, zone)

    await ws.send_text(
        json.dumps(_build_message(
            "ping_ack",
            {"accepted": accepted},
        ))
    )


# ---------------------------------------------------------------------------
# Authenticated WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/location")
async def ws_location_authenticated(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """Authenticated WebSocket — receives location_ping messages, sends zone alerts."""
    claims = _decode_token_query(token)
    if claims is None:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = claims.get("sub") or str(uuid.uuid4())
    role = claims.get("role")
    redis_client = get_redis()
    session_factory = get_session_factory()

    await websocket.accept()
    connection_manager.connect(websocket, None, user_id)
    await register_session(redis_client, user_id)
    logger.info("WS authenticated: user_id=%s", user_id)

    try:
        async with session_factory() as session:
            async for raw in websocket.iter_text():
                try:
                    data = json.loads(raw)
                    msg = WsInboundMessage.model_validate(data)
                except Exception:
                    await websocket.send_text(
                        json.dumps(_build_message("error", {"detail": "Invalid message format"}))
                    )
                    continue

                if msg.type == "location_ping":
                    await _handle_ping(websocket, msg.payload, user_id, redis_client, session, role)
                else:
                    await websocket.send_text(
                        json.dumps(_build_message("error", {"detail": f"Unknown message type: {msg.type}"}))
                    )
    except WebSocketDisconnect:
        logger.info("WS disconnected: user_id=%s", user_id)
    finally:
        connection_manager.disconnect(websocket)
        await deregister_session(redis_client, user_id)


# ---------------------------------------------------------------------------
# Guest WebSocket endpoint (read-only)
# ---------------------------------------------------------------------------

@router.websocket("/ws/location/guest")
async def ws_location_guest(websocket: WebSocket) -> None:
    """Anonymous guest WebSocket — read-only. Zone alerts are sent; pings silently ignored."""
    await websocket.accept()
    guest_id = f"guest:{uuid.uuid4().hex[:8]}"
    connection_manager.connect(websocket, None, None)
    logger.info("WS guest connected: %s", guest_id)

    try:
        async for raw in websocket.iter_text():
            # Silently ignore all inbound messages from guests
            try:
                data = json.loads(raw)
                if data.get("type") == "location_ping":
                    # Silently drop — no ack, no error
                    pass
                else:
                    await websocket.send_text(
                        json.dumps(_build_message("error", {"detail": "Guest connections are read-only"}))
                    )
            except Exception:
                pass
    except WebSocketDisconnect:
        logger.info("WS guest disconnected: %s", guest_id)
    finally:
        connection_manager.disconnect(websocket)
