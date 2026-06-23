import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_redis_client, get_session
from core.responses import success_response
from services.auth.dependencies import get_current_user, require_role
from services.ride.schemas import RideCancelRequest, RideRequestCreate
from services.ride.service import (
    accept_ride,
    cancel_ride,
    complete_ride,
    get_ride,
    list_my_rides,
    request_ride,
    start_ride,
)
from services.user.models import User

router = APIRouter(tags=["rides"])


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


@router.post("")
async def create_ride_request(
    request: Request,
    data: RideRequestCreate,
    current_user: Annotated[User, Depends(require_role("resident"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)],
):
    result = await request_ride(current_user.id, data, session, redis_client)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.get("/mine")
async def fetch_my_rides(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    as_driver: bool = Query(default=False),
):
    results = await list_my_rides(current_user.id, as_driver, session)
    return success_response(
        {"items": [r.model_dump(mode="json") for r in results], "total": len(results)},
        get_request_id(request),
    )


@router.get("/{ride_id}")
async def fetch_ride(
    request: Request,
    ride_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await get_ride(ride_id, current_user.id, session)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.patch("/{ride_id}/accept")
async def accept(
    request: Request,
    ride_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role("driver"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)],
):
    result = await accept_ride(ride_id, current_user.id, session, redis_client)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.patch("/{ride_id}/start")
async def start(
    request: Request,
    ride_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role("driver"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await start_ride(ride_id, current_user.id, session)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.patch("/{ride_id}/complete")
async def complete(
    request: Request,
    ride_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role("driver"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await complete_ride(ride_id, current_user.id, session)
    return success_response(result.model_dump(mode="json"), get_request_id(request))


@router.patch("/{ride_id}/cancel")
async def cancel(
    request: Request,
    ride_id: uuid.UUID,
    data: RideCancelRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await cancel_ride(ride_id, current_user.id, data.reason, session)
    return success_response(result.model_dump(mode="json"), get_request_id(request))
