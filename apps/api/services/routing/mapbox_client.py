"""Mapbox Directions API client with circuit breaker and fallback providers."""

import asyncio
import logging

import aiohttp

from core.circuit_breakers import get_mapbox_breaker, get_ors_breaker
from gateway.config import settings

logger = logging.getLogger(__name__)

MAPBOX_BASE = "https://api.mapbox.com/directions/v5/mapbox"
ORS_BASE = "https://api.openrouteservice.org/v2/directions"

PROFILE_MAP = {
    "walking": "walking",
    "tricycle": "driving-traffic",
}


async def _mapbox_request(
    origin: tuple[float, float],
    destination: tuple[float, float],
    mode: str,
    avoid_waypoints: list[tuple[float, float]] | None = None,
) -> dict | None:
    profile = PROFILE_MAP.get(mode, "walking")
    coordinates = f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
    url = f"{MAPBOX_BASE}/{profile}/{coordinates}"
    params: dict = {
        "access_token": settings.mapbox_token,
        "geometries": "polyline6",
        "overview": "full",
        "steps": "false",
    }
    if avoid_waypoints:
        avoid_str = ";".join(f"{lon},{lat}" for lat, lon in avoid_waypoints)
        params["waypoints"] = f"0;{len(avoid_waypoints) + 1}"
        params["waypoint_names"] = ";".join(["origin"] + [f"avoid_{i}" for i in range(len(avoid_waypoints))] + ["destination"])
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                text = await resp.text()
                logger.warning("Mapbox API error: %s %s", resp.status, text[:200])
                return None
            return await resp.json()


async def _ors_request(
    origin: tuple[float, float],
    destination: tuple[float, float],
    mode: str,
    avoid_waypoints: list[tuple[float, float]] | None = None,
) -> dict | None:
    profile = "foot-walking" if mode == "walking" else "driving-car"
    url = f"{ORS_BASE}/{profile}/json"
    headers = {
        "Authorization": settings.openroute_service_api_key,
        "Content-Type": "application/json",
    }
    body = {
        "coordinates": [[origin[1], origin[0]], [destination[1], destination[0]]],
        "format-geojson": False,
        "instructions": False,
    }
    if avoid_waypoints:
        body["options"] = {
            "avoid_polygons": {
                "type": "MultiPoint",
                "coordinates": [[lon, lat] for lat, lon in avoid_waypoints],
            }
        }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=body, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                text = await resp.text()
                logger.warning("ORS API error: %s %s", resp.status, text[:200])
                return None
            return await resp.json()


async def _cached_fallback() -> dict | None:
    return None


def _extract_route(data: dict) -> dict | None:
    if data is None:
        return None
    routes = data.get("routes")
    if not routes:
        return None
    route = routes[0]
    geometry = route.get("geometry")
    if isinstance(geometry, str):
        return {"polyline": geometry}
    coords = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if coords:
        from services.routing.polyline import encode_polyline

        polyline = encode_polyline([(c[1], c[0]) for c in coords])
        return {"polyline": polyline}
    return None


def _extract_distance_duration(data: dict) -> tuple[float, float]:
    if data is None:
        return 0.0, 0.0
    routes = data.get("routes")
    if not routes:
        return 0.0, 0.0
    route = routes[0]
    legs = route.get("legs", [])
    if legs:
        return float(legs[0].get("distance", 0)), float(legs[0].get("duration", 0))
    return float(route.get("distance", 0)), float(route.get("duration", 0))


async def calculate_route(
    origin: tuple[float, float],
    destination: tuple[float, float],
    mode: str,
    avoid_waypoints: list[tuple[float, float]] | None = None,
) -> dict | None:
    mapbox_breaker = get_mapbox_breaker()

    result = await mapbox_breaker.call(
        lambda: _mapbox_request(origin, destination, mode, avoid_waypoints),
        fallback=lambda: None,
    )

    if result is not None:
        route_geom = _extract_route(result)
        dist, dur = _extract_distance_duration(result)
        if route_geom:
            return {
                "polyline": route_geom["polyline"],
                "distance_metres": dist,
                "duration_seconds": dur,
                "provider": "mapbox",
            }

    ors_breaker = get_ors_breaker()
    ors_result = await ors_breaker.call(
        lambda: _ors_request(origin, destination, mode, avoid_waypoints),
        fallback=_cached_fallback,
    )

    if ors_result is not None:
        route_geom = _extract_route(ors_result)
        dist, dur = _extract_distance_duration(ors_result)
        if route_geom:
            return {
                "polyline": route_geom["polyline"],
                "distance_metres": dist,
                "duration_seconds": dur,
                "provider": "openrouteservice",
            }

    return None
