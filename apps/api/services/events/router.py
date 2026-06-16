import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_session
from core.responses import success_response
from services.auth.dependencies import require_role
from services.events.schemas import EventCreate, EventUpdate
from services.events.service import (
    create_event,
    delete_event,
    get_event,
    list_events,
    update_event,
)
from services.user.models import User

router = APIRouter(tags=["events"])


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


@router.get("")
async def fetch_events(
    request: Request,
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await list_events(session, category, status, search, page, page_size)
    return success_response(result, get_request_id(request))


@router.get("/{event_id}")
async def fetch_event(
    request: Request,
    event_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await get_event(event_id, session)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_event(
    request: Request,
    data: EventCreate,
    _: Annotated[User, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await create_event(data, session)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.patch("/{event_id}")
async def patch_event(
    request: Request,
    event_id: uuid.UUID,
    data: EventUpdate,
    _: Annotated[User, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await update_event(event_id, data, session)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_event(
    event_id: uuid.UUID,
    _: Annotated[User, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    await delete_event(event_id, session)
