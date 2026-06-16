import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def dashboard_summary_sql(session: AsyncSession) -> dict:
    """Gets high-level counts for the admin dashboard."""
    result = await session.execute(
        text("""
            SELECT
                COUNT(*) AS total_incidents,
                COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed')) AS open_incidents,
                COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_incidents,
                COUNT(DISTINCT zone) AS active_zones
            FROM incidents
        """)
    )
    row = result.fetchone()
    
    # Get congestion zones count
    # Note: This is a placeholder for actual congestion logic if needed from DB
    # But usually congestion state is in Redis. We'll return what we have here.
    
    return {
        "total_incidents": row[0],
        "open_incidents": row[1],
        "in_progress_incidents": row[2],
        "active_zones": row[3],
    }


async def hotspots_sql(session: AsyncSession) -> list[Any]:
    """Gets incident hotspots based on density."""
    result = await session.execute(
        text("""
            SELECT
                zone,
                COUNT(*) AS incident_count,
                ST_Y(ST_Centroid(ST_Collect(location::geometry))) AS lat,
                ST_X(ST_Centroid(ST_Collect(location::geometry))) AS lon
            FROM incidents
            WHERE status NOT IN ('resolved', 'closed')
              AND zone IS NOT NULL
            GROUP BY zone
            ORDER BY incident_count DESC
        """)
    )
    return result.fetchall()


async def equity_metrics_sql(session: AsyncSession) -> list[Any]:
    """Gets response time metrics per zone."""
    result = await session.execute(
        text("""
            SELECT
                zone,
                COUNT(*) AS total_incidents,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) / 60 AS avg_resolution_time_minutes
            FROM incidents
            WHERE status = 'resolved'
              AND zone IS NOT NULL
            GROUP BY zone
        """)
    )
    return result.fetchall()


async def bulk_update_status_sql(
    incident_ids: list[uuid.UUID],
    status: str,
    session: AsyncSession,
) -> None:
    """Updates status for multiple incidents."""
    await session.execute(
        text("""
            UPDATE incidents
            SET status = :status,
                updated_at = NOW(),
                resolved_at = CASE WHEN :status = 'resolved' THEN NOW() ELSE resolved_at END
            WHERE id = ANY(:ids)
        """),
        {"ids": incident_ids, "status": status},
    )


async def get_incidents_statuses_sql(
    incident_ids: list[uuid.UUID],
    session: AsyncSession,
) -> list[Any]:
    result = await session.execute(
        text("""
            SELECT id, status FROM incidents WHERE id = ANY(:ids)
        """),
        {"ids": incident_ids},
    )
    return result.fetchall()


async def list_users_sql(
    session: AsyncSession,
    role: str | None = None,
    zone: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Any]:
    conditions = []
    params = {"limit": limit, "offset": offset}
    if role:
        conditions.append("u.role = :role")
        params["role"] = role
    if zone:
        conditions.append("u.zone = :zone")
        params["zone"] = zone
    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    result = await session.execute(
        text(f"""
            SELECT id::text, email, full_name, role, zone
            FROM users u
            {where_clause}
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return result.fetchall()


async def get_live_incidents_sql(session: AsyncSession) -> list[Any]:
    """Gets incidents for the live map."""
    result = await session.execute(
        text("""
            SELECT
                id, type, severity, status, zone,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lon,
                created_at
            FROM incidents
            WHERE status NOT IN ('resolved', 'closed')
              OR updated_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
        """)
    )
    return result.fetchall()
