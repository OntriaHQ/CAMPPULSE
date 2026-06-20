import pytest
from unittest.mock import AsyncMock, patch
from services.routing.service import calculate_route
from services.routing.schemas import RouteCalculateRequest, RoutePoint
import uuid

@pytest.fixture
def mock_redis():
    return AsyncMock()

@pytest.fixture
def mock_session():
    return AsyncMock()

@pytest.mark.asyncio
async def test_calculate_route_cache_hit(mock_redis, mock_session):
    # Setup
    origin = RoutePoint(lat=6.9271, lon=3.3958)
    destination = RoutePoint(lat=6.9304, lon=3.3954)
    request = RouteCalculateRequest(origin=origin, destination=destination, mode="walking")
    
    with patch("services.routing.service.get_cached_route") as mock_get_cache:
        from services.routing.schemas import RouteResponse
        mock_route = RouteResponse(
            polyline="abc",
            distance_metres=100,
            duration_seconds=60,
            origin=origin,
            destination=destination,
            mode="walking"
        )
        mock_get_cache.return_value = mock_route
        
        # Execute
        result = await calculate_route(request, mock_redis, mock_session)
        
        # Verify
        assert result.polyline == "abc"
        assert result.cache_hit is True
        mock_get_cache.assert_called_once()

@pytest.mark.asyncio
async def test_calculate_route_cache_miss_success(mock_redis, mock_session):
    # Setup
    origin = RoutePoint(lat=6.9271, lon=3.3958)
    destination = RoutePoint(lat=6.9304, lon=3.3954)
    request = RouteCalculateRequest(origin=origin, destination=destination, mode="walking")
    
    with patch("services.routing.service.get_cached_route", return_value=None), \
         patch("services.routing.service.get_restricted_segments", return_value=[]), \
         patch("services.routing.service.mapbox_calculate_route") as mock_mapbox, \
         patch("services.routing.service.set_cached_route") as mock_set_cache, \
         patch("services.routing.service.record_route_request"):
        
        mock_mapbox.return_value = {
            "polyline": "encoded_polyline",
            "distance_metres": 500,
            "duration_seconds": 300,
            "provider": "mapbox"
        }
        
        # Execute
        result = await calculate_route(request, mock_redis, mock_session)
        
        # Verify
        assert result.polyline == "encoded_polyline"
        assert result.cache_hit is False
        mock_mapbox.assert_called_once()
        mock_set_cache.assert_called_once()

@pytest.mark.asyncio
async def test_calculate_route_no_route_found_error(mock_redis, mock_session):
    # Setup
    origin = RoutePoint(lat=6.9271, lon=3.3958)
    destination = RoutePoint(lat=0, lon=0) # Far away, no route
    request = RouteCalculateRequest(origin=origin, destination=destination, mode="walking")
    
    with patch("services.routing.service.get_cached_route", return_value=None), \
         patch("services.routing.service.get_restricted_segments", return_value=[]), \
         patch("services.routing.service.mapbox_calculate_route", return_value=None):
        
        from core.exceptions import AppError
        with pytest.raises(AppError) as excinfo:
            await calculate_route(request, mock_redis, mock_session)
        
        assert excinfo.value.code == "NO_ROUTE_FOUND"
