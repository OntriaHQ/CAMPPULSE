import asyncio
import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

os.environ.setdefault("ENVIRONMENT", "development")

from core.database import (  # noqa: E402
    close_db_pool,
    close_sqlalchemy_engine,
    create_db_pool,
    create_sqlalchemy_engine,
    get_session_factory,
)
from core.redis import close_redis, create_redis  # noqa: E402
from gateway.config import settings  # noqa: E402
from gateway.main import app  # noqa: E402


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def client():
    await create_db_pool(settings.database_url)
    await create_sqlalchemy_engine(settings.database_url)
    await create_redis(settings.redis_url)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await close_redis()
    await close_sqlalchemy_engine()
    await close_db_pool()


@pytest_asyncio.fixture(autouse=True)
async def clean_auth_tables(client):
    factory = get_session_factory()
    async with factory() as session:
        await session.execute(text("DELETE FROM auth_sessions"))
        await session.execute(text("DELETE FROM users"))
        await session.commit()
    yield


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:8]}@example.com"
