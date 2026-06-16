import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from core.db.queries.events import (
    count_events,
    delete_event_sql,
    get_event_by_id,
    insert_event,
    select_events,
    update_event_sql,
)
from core.exceptions import NotFoundError
from services.events.schemas import EventCreate, EventResponse, EventUpdate


def _to_response(row) -> EventResponse:
    return EventResponse(
        id=str(row[0]),
        title=row[1],
        description=row[2],
        date=row[3],
        time=row[4],
        area=row[5],
        category=row[6],
        status=row[7],
        attendance=row[8],
        created_at=row[9],
        updated_at=row[10],
    )


async def list_events(
    session: AsyncSession,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    offset = (page - 1) * page_size
    rows = await select_events(session, category, status, search, page_size, offset)
    total = await count_events(session, category, status, search)

    items = [_to_response(r).model_dump(mode="json") for r in rows]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (offset + page_size) < total,
    }


async def get_event(event_id: uuid.UUID, session: AsyncSession) -> EventResponse:
    row = await get_event_by_id(event_id, session)
    if row is None:
        raise NotFoundError("EVENT_NOT_FOUND", f"No event found with ID {event_id}.")
    return _to_response(row)


async def create_event(data: EventCreate, session: AsyncSession) -> EventResponse:
    row = await insert_event(
        title=data.title,
        description=data.description,
        date=data.date,
        time=data.time,
        area=data.area,
        category=data.category,
        status=data.status,
        attendance=data.attendance,
        session=session,
    )
    await session.commit()
    return _to_response(tuple(row.values()))


async def update_event(
    event_id: uuid.UUID,
    data: EventUpdate,
    session: AsyncSession,
) -> EventResponse:
    existing = await get_event_by_id(event_id, session)
    if existing is None:
        raise NotFoundError("EVENT_NOT_FOUND", f"No event found with ID {event_id}.")

    fields = {k: v for k, v in data.model_dump(exclude_none=True).items() if v is not None}
    if not fields:
        return _to_response(existing)

    row = await update_event_sql(event_id, fields, session)
    await session.commit()
    return _to_response(row)


async def delete_event(event_id: uuid.UUID, session: AsyncSession) -> None:
    deleted = await delete_event_sql(event_id, session)
    if not deleted:
        raise NotFoundError("EVENT_NOT_FOUND", f"No event found with ID {event_id}.")
    await session.commit()
