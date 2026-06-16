import pytest

@pytest.mark.asyncio
async def test_graphql_dashboard_summary(client):
    query = """
    query {
      dashboardSummary {
        totalIncidents
        openIncidents
        inProgressIncidents
        activeZones
        congestionZonesCount
      }
    }
    """
    response = await client.post("/graphql", json={"query": query})
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    summary = data["data"]["dashboardSummary"]
    assert "totalIncidents" in summary
    assert "activeZones" in summary


@pytest.mark.asyncio
async def test_graphql_incidents(client):
    query = """
    query {
      incidents(limit: 5) {
        id
        type
        status
        location {
          lat
          lon
        }
      }
    }
    """
    response = await client.post("/graphql", json={"query": query})
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert isinstance(data["data"]["incidents"], list)


@pytest.mark.asyncio
async def test_rest_live_map(client):
    response = await client.get("/api/v1/admin/map/live")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "incidents" in data["data"]
    assert "users" in data["data"]


@pytest.mark.asyncio
async def test_rest_live_drivers(client):
    response = await client.get("/api/v1/admin/drivers/live")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "drivers" in data["data"]
