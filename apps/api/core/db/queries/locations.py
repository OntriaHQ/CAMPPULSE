"""Zone determination SQL helper (Level 4 — data only)."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_zone_for_point(session: AsyncSession, lat: float, lon: float) -> str | None:
    """Return the camp zone name for a point via PostGIS ST_Within.

    Returns None if the point falls in no known zone.
    """
    row = await session.execute(
        text("""
            SELECT name
            FROM camp_zones
            WHERE ST_Within(
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                boundary
            )
            LIMIT 1
        """),
        {"lat": lat, "lon": lon},
    )
    result = row.first()
    return result[0] if result else None
