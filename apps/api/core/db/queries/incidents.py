import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def find_duplicate(
    incident_type: str,
    lon: float,
    lat: float,
    radius: int,
    session: AsyncSession,
) -> dict | None:
    result = await session.execute(
        text("""
            SELECT id, upvote_count, status
            FROM incidents
            WHERE status NOT IN ('resolved', 'closed')
              AND type = :incident_type
              AND ST_DWithin(
                  location::geography,
                  ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
                  :radius
              )
            ORDER BY ST_Distance(
                location::geography,
                ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography
            ) ASC
            LIMIT 1
        """),
        {
            "incident_type": incident_type,
            "lat": lat,
            "lon": lon,
            "radius": radius,
        },
    )
    row = result.fetchone()
    if row is None:
        return None
    return {
        "id": str(row[0]),
        "upvote_count": row[1],
        "status": row[2],
    }


async def insert_incident(
    reporter_id: uuid.UUID | None,
    type: str,
    description: str | None,
    photo_url: str | None,
    lon: float,
    lat: float,
    zone: str | None,
    severity: str,
    department: str,
    session: AsyncSession,
) -> dict:
    result = await session.execute(
        text("""
            INSERT INTO incidents (
                reporter_id, type, description, photo_url,
                location, zone, severity, department
            )
            VALUES (
                :reporter_id, :type, :description, :photo_url,
                ST_SetSRID(ST_Point(:lon, :lat), 4326),
                :zone, :severity, :department
            )
            RETURNING id, status, department, created_at
        """),
        {
            "reporter_id": reporter_id,
            "type": type,
            "description": description,
            "photo_url": photo_url,
            "lat": lat,
            "lon": lon,
            "zone": zone,
            "severity": severity,
            "department": department,
        },
    )
    row = result.fetchone()
    return {
        "id": row[0],
        "status": row[1],
        "department": row[2],
        "created_at": row[3],
    }


async def get_incident_detail(
    incident_id: uuid.UUID,
    session: AsyncSession,
) -> dict | None:
    row = await session.execute(
        text("""
            SELECT
                i.id, i.type, i.description, i.photo_url,
                ST_Y(i.location::geometry) AS lat,
                ST_X(i.location::geometry) AS lon,
                i.address_label, i.zone, i.severity, i.status,
                i.department, i.upvote_count, i.is_duplicate,
                i.created_at, i.updated_at, i.resolved_at,
                u.full_name AS reporter_name,
                a.full_name AS assignee_name,
                i.assigned_to
            FROM incidents i
            LEFT JOIN users u ON u.id = i.reporter_id
            LEFT JOIN users a ON a.id = i.assigned_to
            WHERE i.id = :incident_id
        """),
        {"incident_id": incident_id},
    )
    return row.fetchone()


async def get_incident_comments(
    incident_id: uuid.UUID,
    session: AsyncSession,
) -> list[Any]:
    result = await session.execute(
        text("""
            SELECT c.id, c.body, u.full_name AS author_name, c.created_at
            FROM incident_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.incident_id = :incident_id
            ORDER BY c.created_at ASC
        """),
        {"incident_id": incident_id},
    )
    return result.fetchall()


async def count_nearby_incidents(
    lat: float,
    lon: float,
    radius: int,
    session: AsyncSession,
) -> int:
    result = await session.execute(
        text("""
            SELECT COUNT(*) FROM incidents
            WHERE status NOT IN ('resolved', 'closed')
              AND ST_DWithin(
                  location::geography,
                  ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
                  :radius
              )
        """),
        {"lat": lat, "lon": lon, "radius": radius},
    )
    return result.scalar()


async def select_nearby_incidents(
    lat: float,
    lon: float,
    radius: int,
    limit: int,
    offset: int,
    session: AsyncSession,
) -> list[Any]:
    result = await session.execute(
        text("""
            SELECT
                id, type, severity, status,
                address_label, upvote_count,
                ST_Distance(
                    location::geography,
                    ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography
                ) AS distance_metres
            FROM incidents
            WHERE status NOT IN ('resolved', 'closed')
              AND ST_DWithin(
                  location::geography,
                  ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
                  :radius
              )
            ORDER BY distance_metres ASC
            LIMIT :limit OFFSET :offset
        """),
        {
            "lat": lat,
            "lon": lon,
            "radius": radius,
            "limit": limit,
            "offset": offset,
        },
    )
    return result.fetchall()


async def count_incidents_by_zone(
    where_clause: str,
    params: dict,
    session: AsyncSession,
) -> int:
    result = await session.execute(
        text(f"SELECT COUNT(*) FROM incidents WHERE {where_clause}"),
        params,
    )
    return result.scalar()


async def select_incidents_by_zone(
    where_clause: str,
    params: dict,
    session: AsyncSession,
) -> list[Any]:
    result = await session.execute(
        text(f"""
            SELECT id, type, severity, status, address_label,
                   upvote_count, created_at
            FROM incidents
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return result.fetchall()


async def get_incident_for_upvote(
    incident_id: uuid.UUID,
    session: AsyncSession,
) -> Any:
    result = await session.execute(
        text("SELECT id, upvote_count, status FROM incidents WHERE id = :id"),
        {"id": incident_id},
    )
    return result.fetchone()


async def insert_upvote(
    incident_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    await session.execute(
        text("""
            INSERT INTO incident_upvotes (incident_id, user_id)
            VALUES (:incident_id, :user_id)
        """),
        {"incident_id": incident_id, "user_id": user_id},
    )


async def increment_upvote_count(
    incident_id: uuid.UUID,
    session: AsyncSession,
) -> int:
    await session.execute(
        text("""
            UPDATE incidents
            SET upvote_count = upvote_count + 1, updated_at = NOW()
            WHERE id = :id
        """),
        {"id": incident_id},
    )
    result = await session.execute(
        text("SELECT upvote_count FROM incidents WHERE id = :id"),
        {"id": incident_id},
    )
    return result.scalar()


async def insert_comment(
    incident_id: uuid.UUID,
    user_id: uuid.UUID,
    body: str,
    session: AsyncSession,
) -> dict:
    result = await session.execute(
        text("""
            INSERT INTO incident_comments (incident_id, user_id, body)
            VALUES (:incident_id, :user_id, :body)
            RETURNING id, created_at
        """),
        {"incident_id": incident_id, "user_id": user_id, "body": body},
    )
    row = result.fetchone()
    return {"id": row[0], "created_at": row[1]}


async def get_incident_status(
    incident_id: uuid.UUID,
    session: AsyncSession,
) -> Any:
    result = await session.execute(
        text("SELECT id, status, reporter_id FROM incidents WHERE id = :id"),
        {"id": incident_id},
    )
    return result.fetchone()


async def update_status_sql(
    incident_id: uuid.UUID,
    status: str,
    session: AsyncSession,
) -> None:
    await session.execute(
        text(f"""
            UPDATE incidents
            SET status = :status,
                updated_at = NOW(),
                resolved_at = CASE WHEN :status = 'resolved' THEN NOW() ELSE resolved_at END
            WHERE id = :id
        """),
        {"id": incident_id, "status": status},
    )


async def update_assignment_sql(
    incident_id: uuid.UUID,
    assigned_to: uuid.UUID,
    department: str | None,
    session: AsyncSession,
) -> None:
    await session.execute(
        text("""
            UPDATE incidents
            SET assigned_to = :assigned_to,
                department = COALESCE(:department, department),
                updated_at = NOW()
            WHERE id = :id
        """),
        {"id": incident_id, "assigned_to": assigned_to, "department": department},
    )


async def get_user_exists_sql(
    user_id: uuid.UUID,
    session: AsyncSession,
) -> bool:
    result = await session.execute(
        text("SELECT 1 FROM users WHERE id = :id"),
        {"id": user_id},
    )
    return result.fetchone() is not None
