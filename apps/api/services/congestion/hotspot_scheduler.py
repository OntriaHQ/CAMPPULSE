"""Predictive hotspot scheduler — Level 2.

Loads hotspots.json every 5 minutes and publishes congestion.anticipated
for any hotspot with a program ending within the next 10 minutes.
"""

import asyncio
import calendar
import json
import logging
import os
from datetime import datetime, timezone

from core.redis import get_redis
from services.congestion.publisher import publish_congestion_anticipated

logger = logging.getLogger(__name__)

_SCHEDULER_INTERVAL = 300  # 5 minutes
_ANTICIPATION_LEAD_SECONDS = 600  # 10 minutes before end time
_ALREADY_PUBLISHED: set[str] = set()  # Track (hotspot_id, schedule_entry) already published

_DEFAULT_HOTSPOTS_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../../../packages/map-config/src/hotspots.json",
)


def _load_hotspots(path: str) -> list[dict]:
    """Load hotspots JSON file."""
    try:
        with open(os.path.normpath(path)) as f:
            data = json.load(f)
        return data.get("hotspots", [])
    except Exception:
        logger.exception("Failed to load hotspots from %s", path)
        return []


def _should_anticipate(end_time_str: str, lead_seconds: int = _ANTICIPATION_LEAD_SECONDS) -> bool:
    """Return True if the program end time is within the lead window from now."""
    try:
        # Support ISO 8601 format or HH:MM
        now = datetime.now(tz=timezone.utc)
        if "T" in end_time_str:
            end_dt = datetime.fromisoformat(end_time_str)
        else:
            # HH:MM — use today's date in UTC
            hour, minute = map(int, end_time_str.split(":"))
            end_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
        seconds_until_end = (end_dt - now).total_seconds()
        return 0 < seconds_until_end <= lead_seconds
    except Exception:
        return False


class HotspotScheduler:
    """Periodically checks hotspots and publishes congestion.anticipated events."""

    def __init__(self, hotspots_path: str = _DEFAULT_HOTSPOTS_PATH) -> None:
        self._hotspots_path = hotspots_path
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run())
        logger.info("HotspotScheduler started (interval=%ds)", _SCHEDULER_INTERVAL)

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        try:
            while True:
                await self._check_hotspots()
                await asyncio.sleep(_SCHEDULER_INTERVAL)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("HotspotScheduler fatal error")

    async def _check_hotspots(self) -> None:
        redis_client = get_redis()
        hotspots = _load_hotspots(self._hotspots_path)

        for hotspot in hotspots:
            hotspot_id = hotspot.get("id", "unknown")
            zone = hotspot.get("zone_id", "")
            name = hotspot.get("name", hotspot_id)
            schedule = hotspot.get("schedule", [])

            for entry in schedule:
                end_time = entry.get("end_time") or entry.get("ends_at") or entry.get("end")
                if not end_time:
                    continue

                cache_key = f"{hotspot_id}:{end_time}"
                if cache_key in _ALREADY_PUBLISHED:
                    continue

                if _should_anticipate(end_time):
                    logger.info(
                        "Anticipating congestion at hotspot '%s' (zone: %s, end: %s)",
                        name, zone, end_time,
                    )
                    await publish_congestion_anticipated(redis_client, zone, name, end_time)
                    _ALREADY_PUBLISHED.add(cache_key)
