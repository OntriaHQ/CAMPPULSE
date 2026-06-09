import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from core.redis import get_redis
from services.auth.security import blacklist_key, hash_password
from services.user.models import User
from tests.conftest import unique_email


BASE = "/api/v1"


@pytest.mark.asyncio
async def test_register_hashes_password(client: AsyncClient):
    email = unique_email()
    password = "testpass123"
    response = await client.post(
        f"{BASE}/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Test User",
            "role": "resident",
        },
    )
    assert response.status_code == 201

    factory = __import__("core.database", fromlist=["get_session_factory"]).get_session_factory()
    async with factory() as session:
        user = await session.scalar(select(User).where(User.email == email))
        assert user is not None
        assert user.password_hash != password
        assert user.password_hash.startswith("$2")


@pytest.mark.asyncio
async def test_login_returns_valid_jwt(client: AsyncClient):
    email = unique_email()
    await client.post(
        f"{BASE}/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "full_name": "JWT User",
            "role": "resident",
        },
    )

    response = await client.post(
        f"{BASE}/auth/login",
        json={"email": email, "password": "testpass123"},
    )
    assert response.status_code == 200
    access = response.json()["data"]["tokens"]["access_token"]
    claims = jwt.decode(access, algorithms=["HS256"], options={"verify_signature": False})
    assert claims["role"] == "resident"
    assert "jti" in claims


@pytest.mark.asyncio
async def test_duplicate_email_returns_email_taken(client: AsyncClient):
    email = unique_email()
    payload = {
        "email": email,
        "password": "testpass123",
        "full_name": "Dup User",
        "role": "resident",
    }
    assert (await client.post(f"{BASE}/auth/register", json=payload)).status_code == 201
    response = await client.post(f"{BASE}/auth/register", json=payload)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_TAKEN"


@pytest.mark.asyncio
async def test_refresh_rotates_token(client: AsyncClient):
    email = unique_email()
    register = await client.post(
        f"{BASE}/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "full_name": "Refresh User",
            "role": "resident",
        },
    )
    refresh = register.json()["data"]["tokens"]["refresh_token"]

    refreshed = await client.post(f"{BASE}/auth/refresh", json={"refresh_token": refresh})
    assert refreshed.status_code == 200
    assert "access_token" in refreshed.json()["data"]
    assert refreshed.json()["data"]["access_token"]

    stale = await client.post(f"{BASE}/auth/refresh", json={"refresh_token": refresh})
    assert stale.status_code == 401


@pytest.mark.asyncio
async def test_logout_blacklists_jti(client: AsyncClient):
    email = unique_email()
    register = await client.post(
        f"{BASE}/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "full_name": "Logout User",
            "role": "resident",
        },
    )
    access = register.json()["data"]["tokens"]["access_token"]
    claims = jwt.decode(access, algorithms=["HS256"], options={"verify_signature": False})

    logout = await client.post(
        f"{BASE}/auth/logout",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert logout.status_code == 204

    redis_client = get_redis()
    assert await redis_client.exists(blacklist_key(claims["jti"]))

    me = await client.get(f"{BASE}/users/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 401


@pytest.mark.asyncio
async def test_require_role_admin_rejects_resident(client: AsyncClient):
    email = unique_email()
    register = await client.post(
        f"{BASE}/auth/register",
        json={
            "email": email,
            "password": "testpass123",
            "full_name": "Resident User",
            "role": "resident",
        },
    )
    access = register.json()["data"]["tokens"]["access_token"]

    response = await client.get(
        f"{BASE}/users/_rbac-check",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "INSUFFICIENT_ROLE"


@pytest.mark.asyncio
async def test_rate_limit_returns_429(client: AsyncClient):
    last_status = 200
    for _ in range(61):
        response = await client.get(f"{BASE}/auth/login")
        last_status = response.status_code
    assert last_status == 429
