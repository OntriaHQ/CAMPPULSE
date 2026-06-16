import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_pool


async def check_boundary(lon: float, lat: float) -> bool:
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM camp_zones
                WHERE zone_type = 'boundary'
                AND ST_Within(
                    ST_SetSRID(ST_Point($1, $2), 4326),
                    boundary
                )
            )
            """,
            lon,
            lat,
        )
    return result


async def determine_zone(lon: float, lat: float) -> str | None:
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            """
            SELECT name FROM camp_zones
            WHERE zone_type IS DISTINCT FROM 'boundary'
              AND ST_Within(
                  ST_SetSRID(ST_Point($1, $2), 4326),
                  boundary
              )
            LIMIT 1
            """,
            lon,
            lat,
        )
    return result
