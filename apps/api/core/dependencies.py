from collections.abc import AsyncGenerator

import asyncpg
import redis.asyncio as redis
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_pool, get_session_factory
from core.redis import get_redis


async def get_db() -> AsyncGenerator[asyncpg.Pool, None]:
    yield get_pool()


async def get_redis_client() -> AsyncGenerator[redis.Redis, None]:
    yield get_redis()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    factory = get_session_factory()
    async with factory() as session:
        yield session
