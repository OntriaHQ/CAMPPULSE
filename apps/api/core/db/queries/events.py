import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def select_events(
    session: AsyncSession,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Any]:
    conditions = []
    params: dict = {"limit": limit, "offset": offset}

    if category:
        conditions.append("e.category = :category")
        params["category"] = category
    if status:
        conditions.append("e.status = :status")
        params["status"] = status
    if search:
        conditions.append("(e.title ILIKE :search OR e.area ILIKE :search)")
        params["search"] = f"%{search}%"

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    result = await session.execute(
        text(f"""
            SELECT e.id::text, e.title, e.description, e.date, e.time,
                   e.area, e.category, e.status, e.attendance,
                   e.created_at, e.updated_at
            FROM camp_events e
            {where_clause}
            ORDER BY
                CASE e.status
                    WHEN 'ongoing' THEN 0
                    WHEN 'upcoming' THEN 1
                    WHEN 'past' THEN 2
                    ELSE 3
                END,
                e.date ASC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return result.fetchall()


async def count_events(
    session: AsyncSession,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> int:
    conditions = []
    params: dict = {}

    if category:
        conditions.append("category = :category")
        params["category"] = category
    if status:
        conditions.append("status = :status")
        params["status"] = status
    if search:
        conditions.append("(title ILIKE :search OR area ILIKE :search)")
        params["search"] = f"%{search}%"

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    result = await session.execute(
        text(f"SELECT COUNT(*) FROM camp_events {where_clause}"),
        params,
    )
    return result.scalar()


async def get_event_by_id(event_id: uuid.UUID, session: AsyncSession) -> Any:
    result = await session.execute(
        text("""
            SELECT id::text, title, description, date, time,
                   area, category, status, attendance,
                   created_at, updated_at
            FROM camp_events
            WHERE id = :id
        """),
        {"id": event_id},
    )
    return result.fetchone()


async def insert_event(
    title: str,
    description: str,
    date: str,
    time: str,
    area: str,
    category: str,
    status: str,
    attendance: str | None,
    session: AsyncSession,
) -> dict:
    result = await session.execute(
        text("""
            INSERT INTO camp_events (title, description, date, time, area, category, status, attendance)
            VALUES (:title, :description, :date, :time, :area, :category, :status, :attendance)
            RETURNING id::text, title, description, date, time,
                      area, category, status, attendance,
                      created_at, updated_at
        """),
        {
            "title": title,
            "description": description,
            "date": date,
            "time": time,
            "area": area,
            "category": category,
            "status": status,
            "attendance": attendance,
        },
    )
    row = result.fetchone()
    return {
        "id": row[0],
        "title": row[1],
        "description": row[2],
        "date": row[3],
        "time": row[4],
        "area": row[5],
        "category": row[6],
        "status": row[7],
        "attendance": row[8],
        "created_at": row[9],
        "updated_at": row[10],
    }


async def update_event_sql(
    event_id: uuid.UUID,
    fields: dict,
    session: AsyncSession,
) -> dict | None:
    if not fields:
        return None

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = event_id
    fields["updated_at"] = "NOW()"

    result = await session.execute(
        text(f"""
            UPDATE camp_events
            SET {set_clause}, updated_at = NOW()
            WHERE id = :id
            RETURNING id::text, title, description, date, time,
                      area, category, status, attendance,
                      created_at, updated_at
        """),
        {k: v for k, v in fields.items() if k != "updated_at"},
    )
    return result.fetchone()


async def delete_event_sql(event_id: uuid.UUID, session: AsyncSession) -> bool:
    result = await session.execute(
        text("DELETE FROM camp_events WHERE id = :id RETURNING id"),
        {"id": event_id},
    )
    return result.fetchone() is not None
