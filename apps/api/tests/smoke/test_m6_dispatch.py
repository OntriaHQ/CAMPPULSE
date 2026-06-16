import asyncio
import json
import time
import uuid

import httpx
import websockets

BASE = "http://localhost:8000/api/v1"
WS_BASE = "ws://localhost:8000/ws"


async def register_user(email: str, role: str = "resident"):
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{BASE}/auth/register",
            json={
                "email": email,
                "password": "testpass123",
                "full_name": f"Test {role.capitalize()}",
                "role": role,
            },
        )
        assert r.status_code == 201
        return r.json()["data"]["tokens"]["access_token"], r.json()["data"]["user_id"]


async def test_m6_dispatch():
    print("Starting M6 dispatch smoke test...")
    ts = int(time.time())
    
    # 1. Setup Admin, Resident, and Driver
    admin_token, admin_id = await register_user(f"admin-{ts}@test.com", "admin")
    resident_token, resident_id = await register_user(f"res-{ts}@test.com", "resident")
    driver_token, driver_id = await register_user(f"driver-{ts}@test.com", "resident")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    async with httpx.AsyncClient() as client:
        # 2. Promote resident to driver
        r = await client.patch(
            f"{BASE}/users/{driver_id}/role",
            json={"role": "driver"},
            headers=headers
        )
        assert r.status_code == 200
        
        # 3. Position driver via WebSocket
        # We need to use the driver's token to connect
        driver_auth_token, _ = await register_user(f"driver-login-{ts}@test.com", "driver")
        # Wait, the previous driver_id was resident, now it's driver. 
        # I'll just login to get a fresh token with correct role
        r = await client.post(
            f"{BASE}/auth/login",
            json={"email": f"driver-{ts}@test.com", "password": "testpass123"}
        )
        driver_token = r.json()["data"]["tokens"]["access_token"]
        
        ws_uri = f"{WS_BASE}/location?token={driver_token}"
        async with websockets.connect(ws_uri) as ws:
            # Send location ping
            ping = {
                "type": "location_ping",
                "payload": {
                    "lat": 6.9280,
                    "lon": 3.3965,
                    "accuracy": 10.0,
                    "timestamp": int(time.time())
                }
            }
            await ws.send(json.dumps(ping))
            # Give it a moment to hit Redis
            await asyncio.sleep(1)

        # 4. Submit critical incident
        res_headers = {"Authorization": f"Bearer {resident_token}"}
        incident_data = {
            "type": "security",
            "lat": 6.9271,
            "lon": 3.3958,
            "severity": "critical",
            "description": "Critical security issue for smoke test"
        }
        r = await client.post(
            f"{BASE}/incidents",
            data=incident_data,
            headers=res_headers
        )
        assert r.status_code == 201
        data = r.json()["data"]
        incident_id = data["incident_id"]
        
        print(f"Incident created: {incident_id}")
        assert data["dispatch"] is not None
        assert data["dispatch"]["dispatched"] is True
        assert data["dispatch"]["driver_id"] == driver_id
        assert "eta_seconds" in data["dispatch"]
        assert "encoded_polyline" in data["dispatch"]
        
        # 5. Verify driver is now unavailable
        r = await client.get(
            f"{BASE}/users/drivers/available?lat=6.9271&lon=3.3958",
            headers=res_headers
        )
        available_drivers = r.json()["data"]["drivers"]
        driver_ids = [d["user_id"] for d in available_drivers]
        assert driver_id not in driver_ids, "Dispatched driver should be unavailable"
        
        # 6. Resolve incident and verify driver is available again
        r = await client.patch(
            f"{BASE}/incidents/{incident_id}/status",
            json={"status": "resolved"},
            headers=headers
        )
        assert r.status_code == 200
        
        r = await client.get(
            f"{BASE}/users/drivers/available?lat=6.9271&lon=3.3958",
            headers=res_headers
        )
        available_drivers = r.json()["data"]["drivers"]
        driver_ids = [d["user_id"] for d in available_drivers]
        assert driver_id in driver_ids, "Resolved driver should be available again"

    print("M6 dispatch smoke test: PASSED")


if __name__ == "__main__":
    asyncio.run(test_m6_dispatch())
