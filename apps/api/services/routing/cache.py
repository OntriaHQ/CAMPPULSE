"""Redis cache operations for route calculation."""

import hashlib
import json
import logging

import redis.asyncio as redis

from services.routing.schemas import RouteResponse

ROUTE_CACHE_TTL = 300  # 5 minutes
OFFLINE_PROMOTION_THRESHOLD = 3
OFFLINE_SET_TTL = 604800  # 7 days
FREQ_KEY_TTL = 604800  # 7 days

logger = logging.getLogger(__name__)


def _build_cache_key(origin: dict, destination: dict, mode: str) -> str:
    raw = (
        f"{origin['lat']:.4f},{origin['lon']:.4f}|"
        f"{destination['lat']:.4f},{destination['lon']:.4f}|{mode}"
    )
    h = hashlib.md5(raw.encode()).hexdigest()
    return f"route:{h}"


async def get_cached_route(
    redis_client: redis.Redis,
    origin: dict,
    destination: dict,
    mode: str,
) -> RouteResponse | None:
    key = _build_cache_key(origin, destination, mode)
    cached = await redis_client.get(key)
    if cached is None:
        return None
    try:
        data = json.loads(cached)
        return RouteResponse(**data)
    except Exception:
        logger.warning("Failed to decode cached route for key %s", key)
        return None


async def set_cached_route(
    redis_client: redis.Redis,
    origin: dict,
    destination: dict,
    mode: str,
    route: RouteResponse,
) -> None:
    key = _build_cache_key(origin, destination, mode)
    await redis_client.setex(key, ROUTE_CACHE_TTL, route.model_dump_json())


async def record_route_request(
    redis_client: redis.Redis,
    user_id: str | None,
    origin: dict,
    destination: dict,
    mode: str,
) -> None:
    if user_id is None:
        return
    key = _build_cache_key(origin, destination, mode)
    freq_key = f"route:freq:{user_id}:{key}"
    count = await redis_client.incr(freq_key)
    if count == 1:
        await redis_client.expire(freq_key, FREQ_KEY_TTL)
    if count >= OFFLINE_PROMOTION_THRESHOLD:
        await redis_client.sadd(f"route:offline:{user_id}", key)
        await redis_client.expire(f"route:offline:{user_id}", OFFLINE_SET_TTL)


async def invalidate_route_cache(
    redis_client: redis.Redis,
    zone: str | None = None,
) -> int:
    if zone is None:
        count = 0
        async for key in redis_client.scan_iter(match="route:*"):
            if not key.startswith(("route:freq:", "route:offline:")):
                await redis_client.delete(key)
                count += 1
        return count
    count = 0
    async for key in redis_client.scan_iter(match="route:*"):
        if key.startswith(("route:freq:", "route:offline:")):
            continue
        cached = await redis_client.get(key)
        if cached:
            try:
                data = json.loads(cached)
                if data.get("zone") == zone:
                    await redis_client.delete(key)
                    count += 1
            except Exception:
                pass
    return count
