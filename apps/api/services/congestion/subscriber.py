"""Congestion subscriber — Level 2.

Subscribes to location.ping events, runs two-window congestion detection,
and broadcasts zone_alert / zone_clearing messages to connected WebSocket clients.

W1 (Detection):  90-second rolling window, threshold 50 pings per zone.
                 Evaluated on every 5th ping per zone.
W2 (Revalidation): 60-second window started after W1 flags.
                   Confirms if still ≥ threshold, clears if ≤ clear threshold.
"""

import asyncio
import json
import logging
import time
import uuid

import redis.asyncio as redis

from core.subscriber import BaseSubscriber
from services.congestion.detection import (
    compute_severity,
    should_clear,
    should_confirm,
    should_flag,
)
from services.congestion.mobility import update_mobility
from services.congestion.publisher import (
    publish_congestion_cleared,
    publish_congestion_confirmed,
    publish_congestion_flagged,
)

logger = logging.getLogger(__name__)

_EVAL_EVERY_N = 5  # evaluate W1 every N-th ping

# Zone ping counter (in-memory, reset each W1 window)
_zone_ping_counters: dict[str, int] = {}
# Zones currently in flagged/confirmed state  {zone: task}
_revalidation_tasks: dict[str, asyncio.Task] = {}


class CongestionSubscriber(BaseSubscriber):
    channels = ["location.ping"]

    def __init__(
        self,
        redis_client: redis.Redis,
        threshold: int = 50,
        w1_window: int = 90,
        w2_window: int = 60,
    ):
        super().__init__(redis_client)
        self.threshold = threshold
        self.w1_window = w1_window
        self.w2_window = w2_window

    async def handle(self, channel: str, payload: dict) -> None:
        if channel == "location.ping":
            await self._on_location_ping(payload)

    async def _on_location_ping(self, payload: dict) -> None:
        zone = payload.get("zone")
        if not zone:
            return  # Pings outside any seeded zone — skip detection

        user_id = payload.get("user_id", "")
        lat = payload.get("lat")
        lon = payload.get("lon")

        # Mobility index update
        if lat is not None and lon is not None:
            try:
                await update_mobility(self.redis, zone, user_id, float(lat), float(lon))
            except Exception:
                logger.exception("Mobility update failed for zone %s", zone)

        # W1 ping counter
        _zone_ping_counters[zone] = _zone_ping_counters.get(zone, 0) + 1
        count = _zone_ping_counters[zone]

        window_key = f"congestion:window:{zone}:w1"
        now = time.time()

        # Add every ping to the W1 sorted set with TTL
        member = f"{user_id}:{now}"
        await self.redis.zadd(window_key, {member: now})
        await self.redis.expire(window_key, self.w1_window)

        # Evaluate (zcount + threshold check) every N-th ping to limit Redis load
        if count % _EVAL_EVERY_N != 0:
            return

        # Count pings within W1 window
        cutoff = now - self.w1_window
        w1_count = await self.redis.zcount(window_key, cutoff, "+inf")

        logger.debug("Zone %s W1 count: %d", zone, w1_count)

        if should_flag(w1_count, self.threshold) and zone not in _revalidation_tasks:
            severity = compute_severity(w1_count, self.threshold)
            logger.info("Zone %s crossed W1 threshold (%d pings) — severity: %s", zone, w1_count, severity.value)
            await publish_congestion_flagged(self.redis, zone, w1_count, severity.value)
            # Start W2 revalidation
            task = asyncio.create_task(self._revalidate(zone, severity.value))
            _revalidation_tasks[zone] = task

    async def _revalidate(self, zone: str, initial_severity: str) -> None:
        """W2 revalidation: wait 60s then check ping count to confirm or clear."""
        logger.info("W2 revalidation started for zone %s", zone)
        try:
            await asyncio.sleep(self.w2_window)

            window_key = f"congestion:window:{zone}:w1"
            now = time.time()
            cutoff = now - self.w2_window
            w2_count = await self.redis.zcount(window_key, cutoff, "+inf")
            logger.info("Zone %s W2 revalidation count: %d", zone, w2_count)

            if should_confirm(w2_count, self.threshold):
                severity = compute_severity(w2_count, self.threshold)
                logger.info("Zone %s congestion CONFIRMED (severity: %s)", zone, severity.value)
                await publish_congestion_confirmed(self.redis, zone, w2_count, severity.value)

                # Store congestion state in Redis
                state_key = f"congestion:state:{zone}"
                await self.redis.hset(state_key, mapping={
                    "status": "congested",
                    "severity": severity.value,
                    "flagged_at": str(int(now)),
                    "ping_count": str(w2_count),
                })

                # Broadcast zone_alert to all connected WS clients in this zone
                await _broadcast_zone_alert(zone, severity.value, w2_count)

            elif should_clear(w2_count, self.threshold):
                logger.info("Zone %s congestion CLEARED", zone)
                await publish_congestion_cleared(self.redis, zone)

                # Remove state
                await self.redis.delete(f"congestion:state:{zone}")

                # Broadcast zone_clearing to all connected WS clients
                await _broadcast_zone_clearing(zone)

            else:
                # Between clear and confirm threshold — extend revalidation
                logger.info("Zone %s in limbo (%d pings) — extending revalidation", zone, w2_count)
                # Restart revalidation in background (pop first to avoid duplicate)
                _revalidation_tasks.pop(zone, None)
                task = asyncio.create_task(self._revalidate(zone, initial_severity))
                _revalidation_tasks[zone] = task
                return  # Don't pop from dict here

        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Error during W2 revalidation for zone %s", zone)
        finally:
            _revalidation_tasks.pop(zone, None)


async def _broadcast_zone_alert(zone: str, severity: str, ping_count: int) -> None:
    """Fan-out zone_alert to the given zone and to _unzoned (guest) connections."""
    try:
        from core.connection_manager import connection_manager
        await connection_manager.broadcast_to_zone(zone, {
            "type": "zone_alert",
            "payload": {
                "zone": zone,
                "severity": severity,
                "status": "congested",
                "ping_count": ping_count,
            },
        })
        await connection_manager.broadcast_to_zone("_unzoned", {
            "type": "zone_alert",
            "payload": {
                "zone": zone,
                "severity": severity,
                "status": "congested",
                "ping_count": ping_count,
            },
        })
    except Exception:
        logger.exception("Failed to broadcast zone_alert to zone %s", zone)


async def _broadcast_zone_clearing(zone: str) -> None:
    """Fan-out zone_clearing to the given zone and to _unzoned (guest) connections."""
    try:
        from core.connection_manager import connection_manager
        await connection_manager.broadcast_to_zone(zone, {
            "type": "zone_clearing",
            "payload": {
                "zone": zone,
                "status": "normal",
            },
        })
        await connection_manager.broadcast_to_zone("_unzoned", {
            "type": "zone_clearing",
            "payload": {
                "zone": zone,
                "status": "normal",
            },
        })
    except Exception:
        logger.exception("Failed to broadcast zone_clearing to zone %s", zone)
