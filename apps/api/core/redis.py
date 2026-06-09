import redis.asyncio as redis

_client: redis.Redis | None = None


async def create_redis(redis_url: str) -> redis.Redis:
    global _client
    _client = redis.from_url(redis_url, decode_responses=True)
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
