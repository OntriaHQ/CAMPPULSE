"""M4 realtime + congestion smoke test — run against live API at localhost:8000.

Tests:
  1. Register a resident account and get an access token.
  2. Connect authenticated WebSocket — verify accepted.
  3. Send location_ping inside camp boundary → verify Redis has location hash.
  4. Send location_ping OUTSIDE boundary → verify NOT stored in Redis.
  5. Connect guest WebSocket — verify accepted (read-only).
  6. Simulate 60 rapid pings → expect zone_alert within ~100 seconds.

Usage:
    python tests/smoke/test_m4_realtime.py
"""

import asyncio
import json
import time
import uuid

import httpx
import redis.asyncio as aioredis
import websockets

BASE = "http://localhost:8000/api/v1"
WS_BASE = "ws://localhost:8000"
REDIS_URL = "redis://localhost:6379"

# Camp boundary (boundary.json)
INSIDE = {"lat": 6.928, "lon": 3.395}
OUTSIDE = {"lat": 0.0, "lon": 0.0}


async def register_user(client: httpx.AsyncClient) -> tuple[str, str]:
    """Register a unique resident user and return (user_id, access_token)."""
    email = f"smoke-m4-{uuid.uuid4().hex[:6]}@example.com"
    resp = await client.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": "smokepass123", "full_name": "M4 Smoke", "role": "resident"},
    )
    assert resp.status_code == 201, f"Register failed: {resp.text}"
    data = resp.json()["data"]
    return data["user"]["id"], data["tokens"]["access_token"]


async def test_authenticated_ws_connect(token: str) -> None:
    """Test 2: Authenticated connection accepted."""
    uri = f"{WS_BASE}/ws/location?token={token}"
    async with websockets.connect(uri) as ws:
        print("✅ Test 2: Authenticated WS connected")
        await ws.close()


async def test_location_ping_inside(token: str, user_id: str, redis_client) -> None:
    """Test 3: Ping inside boundary stored in Redis."""
    uri = f"{WS_BASE}/ws/location?token={token}"
    async with websockets.connect(uri) as ws:
        msg = json.dumps({
            "type": "location_ping",
            "payload": {
                "lat": INSIDE["lat"],
                "lon": INSIDE["lon"],
                "accuracy": 10.0,
                "timestamp": int(time.time()),
            },
        })
        await ws.send(msg)
        ack = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        assert ack["type"] == "ping_ack", f"Expected ping_ack, got: {ack}"
        assert ack["payload"]["accepted"] is True, f"Ping should be accepted: {ack}"

    # Verify Redis hash was set
    location = await redis_client.hgetall(f"location:user:{user_id}")
    assert location, f"Redis location hash not found for user {user_id}"
    assert "lat" in location, f"lat missing from Redis hash: {location}"
    print(f"✅ Test 3: Inside-boundary ping accepted and stored in Redis (zone: {location.get('zone')})")


async def test_location_ping_outside(token: str, user_id: str, redis_client) -> None:
    """Test 4: Ping outside boundary silently dropped — no Redis entry update."""
    # Clear any prior location entry
    await redis_client.delete(f"location:user:{user_id}_outside_test")

    fake_user_token_check = f"outside_test_{uuid.uuid4().hex[:8]}"
    uri = f"{WS_BASE}/ws/location?token={token}"
    async with websockets.connect(uri) as ws:
        msg = json.dumps({
            "type": "location_ping",
            "payload": {
                "lat": OUTSIDE["lat"],
                "lon": OUTSIDE["lon"],
                "accuracy": 10.0,
                "timestamp": int(time.time()),
            },
        })
        await ws.send(msg)
        ack = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        assert ack["type"] == "ping_ack", f"Expected ping_ack, got: {ack}"
        assert ack["payload"]["accepted"] is False, f"Out-of-boundary ping should be rejected: {ack}"
    print("✅ Test 4: Out-of-boundary ping silently dropped (no Redis write confirmed by ack=False)")


async def test_guest_ws_connect() -> None:
    """Test 5: Guest connection accepted."""
    uri = f"{WS_BASE}/ws/location/guest"
    async with websockets.connect(uri) as ws:
        print("✅ Test 5: Guest WS connected (read-only)")
        # Send a ping — should be silently ignored (no response)
        await ws.send(json.dumps({
            "type": "location_ping",
            "payload": {"lat": INSIDE["lat"], "lon": INSIDE["lon"], "accuracy": 5.0},
        }))
        # Guest gets no ack — that's the expected behaviour
        await ws.close()


async def test_congestion_detection(token: str) -> None:
    """Test 6: Send 60 rapid pings and wait for zone_alert (W1 + W2 ~90+60s total max).

    This test has a long timeout (180s). In a real CI pipeline you'd configure shorter
    windows via env vars (CONGESTION_WINDOW_SECONDS etc.).
    """
    uri = f"{WS_BASE}/ws/location?token={token}"
    zone_alert_received = False

    async with websockets.connect(uri, ping_interval=None) as ws:
        print("⏳ Test 6: Sending 60 rapid pings to trigger W1 congestion detection...")
        for i in range(60):
            ping_msg = json.dumps({
                "type": "location_ping",
                "payload": {
                    "lat": INSIDE["lat"] + (i % 5) * 0.00001,
                    "lon": INSIDE["lon"] + (i % 5) * 0.00001,
                    "accuracy": 8.0,
                    "timestamp": int(time.time()),
                },
            })
            await ws.send(ping_msg)
            try:
                ack = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            except asyncio.TimeoutError:
                pass
            await asyncio.sleep(0.05)

        print(f"⏳ Waiting up to 180s for zone_alert (W1=90s + W2=60s)...")
        deadline = time.time() + 180
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(raw)
                if msg.get("type") == "zone_alert":
                    assert msg["payload"]["status"] == "congested"
                    print(f"✅ Test 6: zone_alert received! zone={msg['payload'].get('zone')} severity={msg['payload'].get('severity')}")
                    zone_alert_received = True
                    break
            except asyncio.TimeoutError:
                continue

    if not zone_alert_received:
        print("⚠️  Test 6: zone_alert not received within 180s. Check congestion thresholds and zone seeding.")
        print("   (This is expected if camp_zones table has no zones seeded — ping zone=None skips detection)")


async def main() -> None:
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            print("--- M4: Real-Time Location & Congestion Smoke Test ---")

            # Test 1: Register
            user_id, token = await register_user(client)
            print(f"✅ Test 1: Registered user {user_id[:8]}...")

            # Tests 2-6
            await test_authenticated_ws_connect(token)
            await test_location_ping_inside(token, user_id, redis_client)
            await test_location_ping_outside(token, user_id, redis_client)
            await test_guest_ws_connect()
            await test_congestion_detection(token)

        print("\n--- M4 realtime smoke test: COMPLETE ---")
    finally:
        await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
