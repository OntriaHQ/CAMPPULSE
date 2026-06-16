import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_session
from core.responses import success_response
from services.auth.dependencies import get_current_user, require_role
from services.auth.schemas import UserProfile
from services.user.models import User
from services.user.schemas import KycUpdate, RoleUpdate
from services.user.service import (
    get_nearest_available_drivers,
    update_user_kyc,
    update_user_role,
)

router = APIRouter(tags=["users"])
rbac_router = APIRouter(tags=["users-dev"])


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _user_profile(user: User) -> UserProfile:
    return UserProfile(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role.value,
        kyc_status=user.kyc_status.value,
        camp_id=user.camp_id,
        zone=user.zone,
        created_at=user.created_at,
    )


@router.get("/me")
async def get_me(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
):
    return success_response(_user_profile(current_user).model_dump(mode="json"), get_request_id(request))


@rbac_router.get("/_rbac-check")
async def rbac_check(
    request: Request,
    _: Annotated[User, Depends(require_role("admin"))],
):
    return success_response({"ok": True}, get_request_id(request))


@router.get("/drivers/available")
async def drivers_available(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_metres: int = Query(default=2000, ge=1, le=5000),
    current_user: Annotated[User, Depends(require_role("resident"))] = None,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    drivers = await get_nearest_available_drivers(lat, lon, radius_metres, session)
    return success_response(
        {"drivers": drivers, "total": len(drivers)},
        get_request_id(request),
    )


@router.patch("/{user_id}/role")
async def patch_user_role(
    request: Request,
    data: RoleUpdate,
    user_id: uuid.UUID = Path(...),
    _: Annotated[User, Depends(require_role("admin"))] = None,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await update_user_role(user_id, data.role, session)
    return success_response(result, get_request_id(request))


@router.patch("/{user_id}/kyc")
async def patch_user_kyc(
    request: Request,
    data: KycUpdate,
    user_id: uuid.UUID = Path(...),
    _: Annotated[User, Depends(require_role("admin"))] = None,
    session: Annotated[AsyncSession, Depends(get_session)] = ...,
):
    result = await update_user_kyc(user_id, data.kyc_status, session)
    return success_response(result, get_request_id(request))
