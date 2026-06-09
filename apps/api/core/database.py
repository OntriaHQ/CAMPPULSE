import asyncpg

_pool: asyncpg.Pool | None = None


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


async def check_db_health() -> str:
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT PostGIS_Version()")
        return "ok"
    except Exception:
        return "error"
