import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from gateway.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: uuid.UUID, role: str) -> tuple[str, str, int]:
    jti = str(uuid.uuid4())
    expires_in = settings.access_token_expire_minutes * 60
    exp = datetime.now(UTC) + timedelta(seconds=expires_in)
    payload = {
        "sub": str(user_id),
        "role": role,
        "jti": jti,
        "exp": exp,
        "iat": datetime.now(UTC),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti, expires_in


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid token") from exc


def decode_access_token_for_rate_limit(token: str) -> dict | None:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": True},
        )
    except jwt.PyJWTError:
        return None


def blacklist_key(jti: str) -> str:
    return f"auth:blacklist:{jti}"


def refresh_key(user_id: uuid.UUID | str) -> str:
    return f"auth:refresh:{user_id}"
