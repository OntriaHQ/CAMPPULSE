import redis.asyncio as redis
from typing import Optional

_client: Optional[redis.Redis] = None


async def create_redis(redis_url: str) -> redis.Redis:
    global _client
    # socket_timeout=None: redis-py 8.x defaults to a 5s read timeout, which
    # kills pub/sub listen() connections on every idle gap longer than 5s.
    _client = redis.from_url(redis_url, decode_responses=True, socket_timeout=None)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def get_redis() -> redis.Redis:
    if _client is None:
        raise RuntimeError("Redis client is not initialized")
    return _client


async def check_redis_health() -> str:
    try:
        client = get_redis()
        pong = await client.ping()
        return "ok" if pong else "error"
    except Exception:
        return "error"
