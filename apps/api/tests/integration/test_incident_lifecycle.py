import pytest
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.integration


class TestIncidentLifecycle:
    async def _register_and_login(self, client: AsyncClient, email: str, role: str = "resident"):
        r = await client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "testpass123",
            "full_name": "Test User",
            "role": role,
        })
        assert r.status_code == 201
        data = r.json()["data"]
        return data["user"]["id"], data["tokens"]["access_token"]

    async def test_create_incident_anonymous(self, client: AsyncClient):
        r = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
            "severity": "high",
        })
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["is_duplicate"] is False
        assert data["incident_id"] is not None
        assert data["department"] == "infrastructure"
        assert data["status"] == "submitted"

    async def test_create_incident_authenticated(self, client: AsyncClient):
        user_id, token = await self._register_and_login(client, "resident@test.com")

        r = await client.post("/api/v1/incidents", data={
            "type": "pothole",
            "lat": "6.9280",
            "lon": "3.3960",
            "severity": "medium",
        }, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["is_duplicate"] is False
        assert data["incident_id"] is not None

    async def test_create_incident_outside_boundary_rejected(self, client: AsyncClient):
        r = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "51.5074",
            "lon": "-0.1278",
            "severity": "low",
        })
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "LOCATION_OUTSIDE_BOUNDARY"

    async def test_duplicate_detection_within_50m(self, client: AsyncClient):
        user_id, token = await self._register_and_login(client, "dup@test.com")

        r1 = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
            "severity": "high",
        }, headers={"Authorization": f"Bearer {token}"})
        assert r1.status_code == 201
        first_id = r1.json()["data"]["incident_id"]

        r2 = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.92713",
            "lon": "3.39584",
            "severity": "medium",
        }, headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 201
        data2 = r2.json()["data"]
        assert data2["is_duplicate"] is True
        assert data2["parent_incident_id"] == first_id
        assert data2["parent_upvote_count"] is not None

    async def test_duplicate_not_triggered_beyond_50m(self, client: AsyncClient):
        user_id, token = await self._register_and_login(client, "far@test.com")

        await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
            "severity": "high",
        }, headers={"Authorization": f"Bearer {token}"})

        r2 = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9280",
            "lon": "3.3958",
            "severity": "medium",
        }, headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 201
        assert r2.json()["data"]["is_duplicate"] is False

    async def test_get_incident_detail(self, client: AsyncClient):
        user_id, token = await self._register_and_login(client, "detail@test.com")

        create_r = await client.post("/api/v1/incidents", data={
            "type": "streetlight",
            "lat": "6.9271",
            "lon": "3.3958",
            "description": "Streetlight broken near Block C",
            "severity": "low",
        }, headers={"Authorization": f"Bearer {token}"})
        incident_id = create_r.json()["data"]["incident_id"]

        r = await client.get(f"/api/v1/incidents/{incident_id}")
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["type"] == "streetlight"
        assert data["description"] == "Streetlight broken near Block C"
        assert data["severity"] == "low"
        assert data["location"]["lat"] == 6.9271
        assert "comments" in data

    async def test_incident_not_found(self, client: AsyncClient):
        r = await client.get("/api/v1/incidents/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "INCIDENT_NOT_FOUND"

    async def test_upvote_incident(self, client: AsyncClient):
        user_id, token = await self._register_and_login(client, "upvote@test.com")

        create_r = await client.post("/api/v1/incidents", data={
            "type": "trash",
            "lat": "6.9271",
            "lon": "3.3958",
        })
        incident_id = create_r.json()["data"]["incident_id"]

        r = await client.post(
            f"/api/v1/incidents/{incident_id}/upvote",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        assert r.json()["data"]["upvote_count"] >= 1

    async def test_duplicate_upvote_rejected(self, client: AsyncClient):
        user_id, token = await self._register_and_login(client, "dupvote@test.com")

        create_r = await client.post("/api/v1/incidents", data={
            "type": "security",
            "lat": "6.9271",
            "lon": "3.3958",
        })
        incident_id = create_r.json()["data"]["incident_id"]

        await client.post(
            f"/api/v1/incidents/{incident_id}/upvote",
            headers={"Authorization": f"Bearer {token}"},
        )

        r = await client.post(
            f"/api/v1/incidents/{incident_id}/upvote",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 409
        assert r.json()["error"]["code"] == "ALREADY_UPVOTED"

    async def test_add_comment(self, client: AsyncClient):
        user_id, token = await self._register_and_login(client, "comment@test.com")

        create_r = await client.post("/api/v1/incidents", data={
            "type": "water_leak",
            "lat": "6.9271",
            "lon": "3.3958",
        })
        incident_id = create_r.json()["data"]["incident_id"]

        r = await client.post(
            f"/api/v1/incidents/{incident_id}/comments",
            json={"body": "This leak has been here for days"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["body"] == "This leak has been here for days"

    async def test_get_incidents_nearby(self, client: AsyncClient):
        await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
            "severity": "high",
        })
        await client.post("/api/v1/incidents", data={
            "type": "pothole",
            "lat": "6.9280",
            "lon": "3.3965",
        })

        r = await client.get(
            "/api/v1/incidents/nearby?lat=6.9271&lon=3.3958&radius_metres=500"
        )
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["total"] >= 1
        assert len(data["items"]) >= 1
        assert data["page"] == 1

    async def test_admin_status_update_valid(self, client: AsyncClient):
        _, resident_token = await self._register_and_login(client, "res@test.com")
        _, admin_token = await self._register_and_login(client, "admin@test.com", role="admin")

        create_r = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
        }, headers={"Authorization": f"Bearer {resident_token}"})
        incident_id = create_r.json()["data"]["incident_id"]

        r = await client.patch(
            f"/api/v1/incidents/{incident_id}/status",
            json={"status": "assigned", "note": "Team dispatched"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200
        assert r.json()["data"]["status"] == "assigned"

    async def test_admin_status_update_invalid_transition(self, client: AsyncClient):
        _, resident_token = await self._register_and_login(client, "res2@test.com")
        _, admin_token = await self._register_and_login(client, "admin2@test.com", role="admin")

        create_r = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
        }, headers={"Authorization": f"Bearer {resident_token}"})
        incident_id = create_r.json()["data"]["incident_id"]

        r = await client.patch(
            f"/api/v1/incidents/{incident_id}/status",
            json={"status": "resolved"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

    async def test_resident_cannot_update_status(self, client: AsyncClient):
        user_id, token = await self._register_and_login(client, "resident_no@test.com")

        create_r = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
        })
        incident_id = create_r.json()["data"]["incident_id"]

        r = await client.patch(
            f"/api/v1/incidents/{incident_id}/status",
            json={"status": "assigned"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "INSUFFICIENT_ROLE"

    async def test_assign_incident(self, client: AsyncClient):
        _, admin_token = await self._register_and_login(client, "admin3@test.com", role="admin")

        create_r = await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
        })
        incident_id = create_r.json()["data"]["incident_id"]

        assignee_id, _ = await self._register_and_login(client, "assignee@test.com")

        r = await client.patch(
            f"/api/v1/incidents/{incident_id}/assign",
            json={"assigned_to": assignee_id, "department": "infrastructure"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200
        assert r.json()["data"]["assigned_to"] == assignee_id

    async def test_incident_created_event_published(self, client: AsyncClient):
        from core.redis import get_redis

        redis_client = get_redis()
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("incident.created")

        await client.post("/api/v1/incidents", data={
            "type": "flooding",
            "lat": "6.9271",
            "lon": "3.3958",
        })

        import asyncio
        for _ in range(10):
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg is not None:
                import json
                event = json.loads(msg["data"])
                assert event["event_type"] == "incident.created"
                assert event["payload"]["type"] == "flooding"
                break
        else:
            pytest.fail("No incident.created event received")
