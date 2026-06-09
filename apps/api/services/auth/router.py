from typing import Annotated

import redis.asyncio as redis
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_redis_client, get_session
from core.responses import success_response
from services.auth.dependencies import get_current_user
from services.auth.schemas import LoginRequest, RefreshRequest, RegisterRequest
from services.auth.service import login_user, logout_user, refresh_tokens, register_user
from services.user.models import User

router = APIRouter(tags=["auth"])


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)],
):
    result = await register_user(data, session, redis_client)
    return success_response(result.model_dump(), get_request_id(request))


@router.post("/login")
async def login(
    data: LoginRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)],
):
    result = await login_user(data, session, redis_client)
    return success_response(result.model_dump(), get_request_id(request))


@router.post("/refresh")
async def refresh(
    data: RefreshRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)],
):
    result = await refresh_tokens(data, session, redis_client)
    return success_response(result.model_dump(), get_request_id(request))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)],
):
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    await logout_user(token, current_user.id, session, redis_client)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
