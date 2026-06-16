"""SQL queries for road_segments."""

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_all_segments(session: AsyncSession) -> list[dict]:
    rows = await session.execute(
        text("""
            SELECT
                id::text, road_id, name,
                zone, speed_limit,
                is_restricted, restriction_reason,
                ST_AsGeoJSON(geom)::jsonb AS geometry
            FROM road_segments
            ORDER BY road_id
        """)
    )
    return [dict(r._mapping) for r in rows]


async def get_restricted_segments(session: AsyncSession) -> list[dict]:
    rows = await session.execute(
        text("""
            SELECT
                id::text, road_id, name,
                zone, speed_limit,
                restriction_reason
            FROM road_segments
            WHERE is_restricted = true
            ORDER BY road_id
        """)
    )
    return [dict(r._mapping) for r in rows]


async def get_segment_by_id(session: AsyncSession, segment_id: uuid.UUID) -> dict | None:
    rows = await session.execute(
        text("""
            SELECT id::text, road_id, name, zone, is_restricted, restriction_reason
            FROM road_segments
            WHERE id = :sid
        """),
        {"sid": segment_id},
    )
    row = rows.first()
    return dict(row._mapping) if row else None


async def restrict_segment(session: AsyncSession, segment_id: uuid.UUID, reason: str) -> None:
    await session.execute(
        text("""
            UPDATE road_segments
            SET is_restricted = true, restriction_reason = :reason, updated_at = NOW()
            WHERE id = :sid
        """),
        {"sid": segment_id, "reason": reason},
    )


async def clear_segment_restriction(session: AsyncSession, segment_id: uuid.UUID) -> None:
    await session.execute(
        text("""
            UPDATE road_segments
            SET is_restricted = false, restriction_reason = NULL, updated_at = NOW()
            WHERE id = :sid
        """),
        {"sid": segment_id},
    )


async def get_segments_intersecting_point(session: AsyncSession, lon: float, lat: float, radius: float = 0.001) -> list[dict]:
    rows = await session.execute(
        text("""
            SELECT id::text, road_id, name, zone, is_restricted
            FROM road_segments
            WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :radius)
            ORDER BY road_id
        """),
        {"lon": lon, "lat": lat, "radius": radius},
    )
    return [dict(r._mapping) for r in rows]


async def seed_road_segments(session: AsyncSession, segments: list[dict]) -> None:
    for seg in segments:
        coords_json = seg["geometry"]
        await session.execute(
            text("""
                INSERT INTO road_segments (road_id, name, geom, zone, speed_limit)
                VALUES (
                    :road_id, :name,
                    ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326),
                    :zone, :speed_limit
                )
                ON CONFLICT (road_id) DO NOTHING
            """),
            {
                "road_id": seg["road_id"],
                "name": seg["name"],
                "geom": coords_json,
                "zone": seg.get("zone"),
                "speed_limit": seg.get("speed_limit"),
            },
        )
