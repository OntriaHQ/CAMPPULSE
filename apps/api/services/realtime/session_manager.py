"""Active session registry for WebSocket connections (Level 4 — Redis only)."""

import redis.asyncio as redis

_ACTIVE_SESSIONS_KEY = "location:active_sessions"


async def add_session(redis_client: redis.Redis, user_id: str) -> None:
    """Add a user to the active session registry."""
    await redis_client.sadd(_ACTIVE_SESSIONS_KEY, user_id)


async def remove_session(redis_client: redis.Redis, user_id: str) -> None:
    """Remove a user from the active session registry."""
    await redis_client.srem(_ACTIVE_SESSIONS_KEY, user_id)


async def get_active_sessions(redis_client: redis.Redis) -> set[str]:
    """Return the set of currently active user IDs."""
    return await redis_client.smembers(_ACTIVE_SESSIONS_KEY)


async def get_active_session_count(redis_client: redis.Redis) -> int:
    """Return count of active sessions."""
    return await redis_client.scard(_ACTIVE_SESSIONS_KEY)
