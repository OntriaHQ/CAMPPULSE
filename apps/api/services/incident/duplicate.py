import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from core.db.queries.incidents import find_duplicate as find_duplicate_sql
from core.db.queries.incidents import increment_upvote_count, insert_upvote

DUPLICATE_RADIUS_METRES = 50


async def find_duplicate(
    incident_type: str,
    lat: float,
    lon: float,
    session: AsyncSession,
) -> dict | None:
    return await find_duplicate_sql(
        incident_type=incident_type,
        lon=lon,
        lat=lat,
        radius=DUPLICATE_RADIUS_METRES,
        session=session,
    )


async def increment_parent_upvote(
    parent_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    await increment_upvote_count(parent_id, session)


async def link_reporter_to_parent(
    parent_id: uuid.UUID,
    reporter_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    await insert_upvote(parent_id, reporter_id, session)
