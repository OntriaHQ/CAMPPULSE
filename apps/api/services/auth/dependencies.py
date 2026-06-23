import uuid
from typing import Annotated, Callable, Optional

import redis.asyncio as redis
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_redis_client, get_session
from core.exceptions import AuthenticationError, AuthorisationError
from core.roles import role_satisfies
from services.auth.security import blacklist_key, decode_access_token
from services.user.models import User


async def get_current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)],
) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthenticationError("MISSING_TOKEN", "Authentication token is required.")

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise AuthenticationError("MISSING_TOKEN", "Authentication token is required.")

    try:
        claims = decode_access_token(token)
    except ValueError as exc:
        raise AuthenticationError("INVALID_TOKEN", "Token is invalid or expired.") from exc

    jti = claims.get("jti")
    if jti and await redis_client.exists(blacklist_key(jti)):
        raise AuthenticationError("INVALID_TOKEN", "Token has been revoked.")

    user_id = claims.get("sub")
    if not user_id:
        raise AuthenticationError("INVALID_TOKEN", "Token is invalid or expired.")

    user = await session.get(User, uuid.UUID(user_id))
    if user is None:
        raise AuthenticationError("INVALID_TOKEN", "Token is invalid or expired.")

    if not user.is_active:
        raise AuthorisationError("ACCOUNT_DISABLED", "This account has been disabled.")

    return user


async def optional_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis_client: Annotated[redis.Redis, Depends(get_redis_client)],
) -> Optional[User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    return await get_current_user(request, session, redis_client)


def require_role(minimum_role: str) -> Callable:
    async def dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not role_satisfies(current_user.role.value, minimum_role):
            raise AuthorisationError(
                "INSUFFICIENT_ROLE",
                f"This endpoint requires {minimum_role} role or higher.",
            )
        return current_user

    return dependency
