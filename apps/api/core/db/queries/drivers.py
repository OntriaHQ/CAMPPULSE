import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def find_nearest_available_drivers(
    lon: float,
    lat: float,
    radius_metres: int,
    limit: int,
    session: AsyncSession,
) -> list:
    result = await session.execute(
        text("""
            SELECT
                u.id,
                u.full_name,
                dp.vehicle_type::text,
                ST_Distance(
                    dp.current_location::geography,
                    ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography
                ) AS distance_metres,
                ST_Y(dp.current_location::geometry) AS lat,
                ST_X(dp.current_location::geometry) AS lon
            FROM driver_profiles dp
            JOIN users u ON u.id = dp.user_id
            WHERE dp.is_available = TRUE
              AND dp.current_location IS NOT NULL
              AND ST_DWithin(
                  dp.current_location::geography,
                  ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
                  :radius
              )
            ORDER BY distance_metres ASC
            LIMIT :limit
        """),
        {
            "lon": lon,
            "lat": lat,
            "radius": radius_metres,
            "limit": limit,
        },
    )
    return result.fetchall()


async def mark_driver_availability(
    user_id: uuid.UUID,
    is_available: bool,
    session: AsyncSession,
) -> bool:
    result = await session.execute(
        text("""
            UPDATE driver_profiles
            SET is_available = :is_available, updated_at = NOW()
            WHERE user_id = :user_id
            RETURNING id
        """),
        {"user_id": user_id, "is_available": is_available},
    )
    return result.fetchone() is not None
