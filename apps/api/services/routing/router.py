import uuid
from typing import Annotated

import redis.asyncio as redis
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_redis_client, get_session
from core.responses import success_response
from services.auth.dependencies import get_current_user, optional_user, require_role
from services.routing.schemas import (
    RouteCalculateRequest,
    RouteRerouteRequest,
    SegmentRestrictRequest,
    SegmentResponse,
)
from services.routing.service import (
    apply_restriction,
    calculate_route,
    clear_restriction,
    list_all_segments,
    list_restricted_segments,
    reroute,
)
from services.user.models import User

router = APIRouter(tags=["routes"])


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


@router.post("/calculate")
async def calculate(
    request: Request,
    data: RouteCalculateRequest,
    current_user: Annotated[User | None, Depends(optional_user)] = None,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)] = ...,
):
    user_id = str(current_user.id) if current_user else None
    result = await calculate_route(data, redis_client, session, user_id)
    return success_response(result.model_dump(), get_request_id(request))


@router.post("/reroute")
async def recalculate(
    request: Request,
    data: RouteRerouteRequest,
    current_user: Annotated[User | None, Depends(optional_user)] = None,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)] = ...,
):
    user_id = str(current_user.id) if current_user else None
    result = await reroute(data, redis_client, session, user_id)
    return success_response(result.model_dump(), get_request_id(request))


@router.get("/segments")
async def list_segments(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await list_all_segments(session)
    return success_response(result, get_request_id(request))


@router.get("/segments/restricted")
async def restricted_segments(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await list_restricted_segments(session)
    return success_response(result, get_request_id(request))


@router.patch("/segments/{segment_id}/restrict")
async def restrict_segment_route(
    request: Request,
    segment_id: uuid.UUID,
    data: SegmentRestrictRequest,
    current_user: Annotated[User, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)] = ...,
):
    result = await apply_restriction(segment_id, data.reason, session, redis_client)
    return success_response(result, get_request_id(request))


@router.patch("/segments/{segment_id}/clear")
async def clear_segment_route(
    request: Request,
    segment_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)] = ...,
):
    result = await clear_restriction(segment_id, session, redis_client)
    return success_response(result, get_request_id(request))
