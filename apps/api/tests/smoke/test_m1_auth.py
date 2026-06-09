"""M1 auth smoke test — run against live API at localhost:8000."""

import asyncio

import httpx

BASE = "http://localhost:8000/api/v1"


async def test_auth_flow() -> None:
    email = f"smoke-{int(asyncio.get_running_loop().time())}@example.com"
    async with httpx.AsyncClient(timeout=30.0) as client:
        register = await client.post(
            f"{BASE}/auth/register",
            json={
                "email": email,
                "password": "testpass123",
                "full_name": "Smoke Test",
                "role": "resident",
            },
        )
        assert register.status_code == 201, register.text
        assert "X-RateLimit-Limit" in register.headers
        tokens = register.json()["data"]["tokens"]
        access = tokens["access_token"]
        refresh = tokens["refresh_token"]

        me = await client.get(
            f"{BASE}/users/me",
            headers={"Authorization": f"Bearer {access}"},
        )
        assert me.status_code == 200
        assert me.json()["data"]["email"] == email

        no_token = await client.get(f"{BASE}/users/me")
        assert no_token.status_code == 401

        bad_token = await client.get(
            f"{BASE}/users/me",
            headers={"Authorization": "Bearer invalid.token.value"},
        )
        assert bad_token.status_code == 401

        refreshed = await client.post(
            f"{BASE}/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert refreshed.status_code == 200
        new_access = refreshed.json()["data"]["access_token"]
        assert "tokens" not in refreshed.json()["data"]

        logout = await client.post(
            f"{BASE}/auth/logout",
            headers={"Authorization": f"Bearer {new_access}"},
        )
        assert logout.status_code == 204

        blacklisted = await client.get(
            f"{BASE}/users/me",
            headers={"Authorization": f"Bearer {new_access}"},
        )
        assert blacklisted.status_code == 401

        old_refresh = await client.post(
            f"{BASE}/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert old_refresh.status_code == 401

    print("M1 auth smoke test: PASSED")


if __name__ == "__main__":
    asyncio.run(test_auth_flow())
