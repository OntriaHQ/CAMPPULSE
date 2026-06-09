import asyncpg
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

_pool: asyncpg.Pool | None = None
engine: AsyncEngine | None = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None


def normalize_database_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def create_db_pool(database_url: str) -> asyncpg.Pool:
    global _pool
    normalized = normalize_database_url(database_url)
    _pool = await asyncpg.create_pool(normalized, min_size=1, max_size=10)
    return _pool


async def close_db_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialized")
    return _pool


async def create_sqlalchemy_engine(database_url: str) -> None:
    global engine, async_session_factory
    engine = create_async_engine(database_url, pool_pre_ping=True)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def close_sqlalchemy_engine() -> None:
    global engine, async_session_factory
    if engine is not None:
        await engine.dispose()
        engine = None
        async_session_factory = None


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if async_session_factory is None:
        raise RuntimeError("SQLAlchemy session factory is not initialized")
    return async_session_factory


async def check_db_health() -> str:
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT PostGIS_Version()")
        return "ok"
    except Exception:
        return "error"
