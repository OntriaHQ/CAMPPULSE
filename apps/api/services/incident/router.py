import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_session
from core.responses import success_response
from services.auth.dependencies import get_current_user, optional_user, require_role
from services.incident.schemas import (
    AssignRequest,
    CommentCreate,
    IncidentCreate,
    StatusUpdate,
)
from services.incident.service import (
    add_comment,
    assign_incident,
    create_incident,
    get_incident,
    get_incidents_by_zone,
    get_incidents_nearby,
    update_incident_status,
    upvote_incident,
)
from services.user.models import User

router = APIRouter(tags=["incidents"])


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_incident(
    request: Request,
    type: str = Form(...),
    lat: float = Form(...),
    lon: float = Form(...),
    description: str | None = Form(default=None),
    severity: str = Form(default="low"),
    photo: UploadFile | None = File(default=None),
    current_user: Annotated[User | None, Depends(optional_user)] = None,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    data = IncidentCreate(
        type=type,
        lat=lat,
        lon=lon,
        description=description,
        severity=severity,
    )
    photo_bytes = await photo.read() if photo and photo.filename else None
    photo_filename = photo.filename if photo else None

    result = await create_incident(
        data,
        photo_bytes,
        photo_filename,
        current_user.id if current_user else None,
        session,
    )
    return success_response(result.model_dump(exclude_none=True), get_request_id(request))


@router.get("/{incident_id}")
async def fetch_incident(
    request: Request,
    incident_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await get_incident(incident_id, session)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.get("/nearby")
async def fetch_incidents_nearby(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    radius_metres: int = Query(default=500, ge=1, le=5000),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await get_incidents_nearby(lat, lon, radius_metres, page, page_size, session)
    return success_response(result.model_dump(), get_request_id(request))


@router.get("/zone/{zone}")
async def fetch_incidents_by_zone(
    request: Request,
    zone: str,
    status: str | None = Query(default=None),
    type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: Annotated[User, Depends(get_current_user)] = ...,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await get_incidents_by_zone(zone, status, type, page, page_size, session)
    return success_response(result.model_dump(), get_request_id(request))


@router.post("/{incident_id}/upvote")
async def upvote(
    request: Request,
    incident_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await upvote_incident(incident_id, current_user.id, session)
    return success_response(result.model_dump(), get_request_id(request))


@router.post("/{incident_id}/comments", status_code=status.HTTP_201_CREATED)
async def comment(
    request: Request,
    incident_id: uuid.UUID,
    data: CommentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await add_comment(incident_id, current_user.id, data, session)
    return success_response(result, get_request_id(request))


@router.patch("/{incident_id}/status")
async def update_status(
    request: Request,
    incident_id: uuid.UUID,
    data: StatusUpdate,
    current_user: Annotated[User, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await update_incident_status(incident_id, data.status, data.note, session)
    return success_response(result, get_request_id(request))


@router.patch("/{incident_id}/assign")
async def assign(
    request: Request,
    incident_id: uuid.UUID,
    data: AssignRequest,
    current_user: Annotated[User, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await assign_incident(
        incident_id,
        uuid.UUID(data.assigned_to),
        data.department,
        session,
    )
    return success_response(result, get_request_id(request))
