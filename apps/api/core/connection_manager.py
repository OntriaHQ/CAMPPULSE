import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Maintains active WebSocket connections, keyed by zone."""

    def __init__(self) -> None:
        # zone_name -> set of WebSocket objects
        self._zone_connections: dict[str, set[WebSocket]] = defaultdict(set)
        # ws -> zone mapping for cleanup
        self._ws_zone: dict[WebSocket, str] = {}
        # ws -> user_id (None for guests)
        self._ws_user: dict[WebSocket, str | None] = {}

    def connect(self, ws: WebSocket, zone: str | None, user_id: str | None) -> None:
        zone_key = zone or "_unzoned"
        self._zone_connections[zone_key].add(ws)
        self._ws_zone[ws] = zone_key
        self._ws_user[ws] = user_id

    def disconnect(self, ws: WebSocket) -> None:
        zone_key = self._ws_zone.pop(ws, None)
        if zone_key:
            self._zone_connections[zone_key].discard(ws)
        self._ws_user.pop(ws, None)

    def update_zone(self, ws: WebSocket, new_zone: str | None) -> None:
        old_zone = self._ws_zone.get(ws)
        new_key = new_zone or "_unzoned"
        if old_zone and old_zone != new_key:
            self._zone_connections[old_zone].discard(ws)
            self._zone_connections[new_key].add(ws)
            self._ws_zone[ws] = new_key

    async def broadcast_to_zone(self, zone: str, message: dict[str, Any]) -> None:
        raw = json.dumps(message)
        dead: list[WebSocket] = []
        for ws in list(self._zone_connections.get(zone, set())):
            try:
                await ws.send_text(raw)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_to_all(self, message: dict[str, Any]) -> None:
        raw = json.dumps(message)
        dead: list[WebSocket] = []
        for zone_set in self._zone_connections.values():
            for ws in list(zone_set):
                try:
                    await ws.send_text(raw)
                except Exception:
                    dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_to_user(self, user_id: str, message: dict[str, Any]) -> None:
        """Sends a message to all active WebSocket connections for a specific user."""
        raw = json.dumps(message)
        dead: list[WebSocket] = []
        for ws, uid in list(self._ws_user.items()):
            if uid == user_id:
                try:
                    await ws.send_text(raw)
                except Exception:
                    dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


# Module-level singleton — imported by notification and congestion services
connection_manager = ConnectionManager()
