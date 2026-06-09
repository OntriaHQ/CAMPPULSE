from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_session
from core.responses import success_response
from services.auth.dependencies import get_current_user, require_role
from services.auth.schemas import UserProfile
from services.user.models import User

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
