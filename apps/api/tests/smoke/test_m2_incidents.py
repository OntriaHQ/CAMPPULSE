import pytest
import httpx
import uuid
import asyncio

BASE_URL = "http://localhost:8000/api/v1"

@pytest.mark.asyncio
async def test_incident_flow():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Submit incident (anonymous)
        # Coordinates for Redemption City (seeded in M2)
        r = await client.post("/incidents", data={
            "type": "flooding",
            "lat": 6.9271,
            "lon": 3.3958,
            "severity": "high",
            "description": "Heavy flooding near the main gate"
        })
        assert r.status_code == 201
        data = r.json()["data"]
        incident_id = data["incident_id"]
        assert data["is_duplicate"] == False
        assert data["department"] == "infrastructure"
        assert "estimated_response_window" in data

        # 2. Duplicate detection (within 50m)
        r = await client.post("/incidents", data={
            "type": "flooding",
            "lat": 6.92715,   # ~5m away
            "lon": 3.39582,
            "severity": "medium"
        })
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["is_duplicate"] == True
        assert data["parent_incident_id"] == incident_id

        # 3. GET /incidents/:id
        r = await client.get(f"/incidents/{incident_id}")
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["upvote_count"] >= 1  # Incremented by duplicate
        assert data["type"] == "flooding"

        # 4. GET /incidents/nearby
        r = await client.get("/incidents/nearby", params={
            "lat": 6.9271,
            "lon": 3.3958,
            "radius_metres": 500
        })
        assert r.status_code == 200
        assert len(r.json()["data"]["items"]) >= 1

        print("\nM2 incident smoke test: PASSED")

if __name__ == "__main__":
    asyncio.run(test_incident_flow())
