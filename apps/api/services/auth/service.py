import uuid
from datetime import datetime, timedelta, timezone

import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import (
    AuthenticationError,
    AuthorisationError,
    ConflictError,
)
from core.roles import REGISTERABLE_ROLES
from services.auth.models import AuthSession
from services.auth.schemas import (
    AuthRegisterResponse,
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    TokenPair,
    UserPublic,
)
from services.auth.security import (
    blacklist_key,
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_key,
    verify_password,
)
from services.user.models import KycStatus, User, UserRole
from gateway.config import settings


def _user_public(user: User) -> UserPublic:
    return UserPublic(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        kyc_status=user.kyc_status.value,
    )


async def _issue_tokens(
    user: User,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> TokenPair:
    refresh_token = generate_refresh_token()
    refresh_hash = hash_refresh_token(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    auth_session = AuthSession(
        user_id=user.id,
        refresh_token_hash=refresh_hash,
        expires_at=expires_at,
    )
    session.add(auth_session)
    await session.flush()

    access_token, _, expires_in = create_access_token(user.id, user.role.value)

    await redis_client.set(
        refresh_key(user.id),
        refresh_hash,
        ex=settings.refresh_token_expire_days * 86400,
    )

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


async def register_user(
    data: RegisterRequest,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> AuthRegisterResponse:
    if data.role not in REGISTERABLE_ROLES:
        from core.exceptions import AppError

        raise AppError(
            code="INVALID_ROLE",
            message="Registration is only allowed for resident or driver roles.",
            status_code=400,
        )

    existing = await session.scalar(select(User).where(User.email == data.email))
    if existing is not None:
        raise ConflictError("EMAIL_TAKEN", "Email already registered.")

    user = User(
        email=data.email,
        phone=data.phone,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=UserRole(data.role),
        kyc_status=KycStatus.pending,
        camp_id=data.camp_id,
        zone=data.zone,
    )
    session.add(user)
    await session.flush()

    tokens = await _issue_tokens(user, session, redis_client)
    await session.commit()
    await session.refresh(user)

    return AuthRegisterResponse(user=_user_public(user), tokens=tokens)


async def login_user(
    data: LoginRequest,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> AuthRegisterResponse:
    user = await session.scalar(select(User).where(User.email == data.email))
    if user is None or user.password_hash is None or not verify_password(data.password, user.password_hash):
        raise AuthenticationError("INVALID_CREDENTIALS", "Invalid email or password.")

    if not user.is_active:
        raise AuthorisationError("ACCOUNT_DISABLED", "This account has been disabled.")

    tokens = await _issue_tokens(user, session, redis_client)
    await session.commit()

    return AuthRegisterResponse(user=_user_public(user), tokens=tokens)


async def refresh_tokens(
    data: RefreshRequest,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> RefreshResponse:
    token_hash = hash_refresh_token(data.refresh_token)
    auth_session = await session.scalar(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == token_hash,
            AuthSession.revoked.is_(False),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )
    if auth_session is None:
        raise AuthenticationError("INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.")

    user = await session.get(User, auth_session.user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("SESSION_EXPIRED", "Session is no longer valid.")

    auth_session.revoked = True

    refresh_token = generate_refresh_token()
    refresh_hash = hash_refresh_token(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    new_session = AuthSession(
        user_id=user.id,
        refresh_token_hash=refresh_hash,
        expires_at=expires_at,
    )
    session.add(new_session)
    await session.flush()

    access_token, _, expires_in = create_access_token(user.id, user.role.value)

    await redis_client.set(
        refresh_key(user.id),
        refresh_hash,
        ex=settings.refresh_token_expire_days * 86400,
    )
    await session.commit()

    return RefreshResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


async def logout_user(
    access_token: str,
    user_id: uuid.UUID,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> None:
    from services.auth.security import decode_access_token

    claims = decode_access_token(access_token)
    jti = claims.get("jti")
    exp = claims.get("exp")
    if jti and exp:
        ttl = max(int(exp - datetime.now(timezone.utc).timestamp()), 1)
        await redis_client.set(blacklist_key(jti), "1", ex=ttl)

    result = await session.execute(
        select(AuthSession).where(
            AuthSession.user_id == user_id,
            AuthSession.revoked.is_(False),
        )
    )
    for auth_session in result.scalars():
        auth_session.revoked = True

    await redis_client.delete(refresh_key(user_id))
    await session.commit()
