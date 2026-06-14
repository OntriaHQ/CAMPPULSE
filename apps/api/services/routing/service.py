import uuid

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.db.queries.routes import (
    clear_segment_restriction,
    get_all_segments,
    get_restricted_segments,
    get_segment_by_id,
    get_segments_intersecting_point,
    restrict_segment,
)
from core.exceptions import AppError, NotFoundError
from services.routing.cache import (
    get_cached_route,
    invalidate_route_cache,
    record_route_request,
    set_cached_route,
)
from services.routing.mapbox_client import calculate_route as mapbox_calculate_route
from services.routing.schemas import RouteCalculateRequest, RoutePoint, RouteRerouteRequest, RouteResponse


async def calculate_route(
    request: RouteCalculateRequest,
    redis_client: redis.Redis,
    session: AsyncSession,
    user_id: str | None = None,
) -> RouteResponse:
    origin_dict = request.origin.model_dump()
    dest_dict = request.destination.model_dump()

    cached = await get_cached_route(redis_client, origin_dict, dest_dict, request.mode)
    if cached is not None:
        cached.cache_hit = True
        await record_route_request(redis_client, user_id, origin_dict, dest_dict, request.mode)
        return cached

    restricted_segments = await get_restricted_segments(session)
    avoid_waypoints = []
    if restricted_segments:
        for seg in restricted_segments:
            avoid_waypoints.append(
                ((request.origin.lat + request.destination.lat) / 2,
                 (request.origin.lon + request.destination.lon) / 2)
            )

    result = await mapbox_calculate_route(
        origin=(request.origin.lat, request.origin.lon),
        destination=(request.destination.lat, request.destination.lon),
        mode=request.mode,
        avoid_waypoints=avoid_waypoints if avoid_waypoints else None,
    )

    if result is None:
        raise AppError(
            code="NO_ROUTE_FOUND",
            message="Could not find a route between the specified locations.",
            status_code=422,
        )

    route = RouteResponse(
        polyline=result["polyline"],
        distance_metres=result["distance_metres"],
        duration_seconds=result["duration_seconds"],
        origin=request.origin,
        destination=request.destination,
        mode=request.mode,
        cache_hit=False,
        segments=[{"id": s["id"], "road_id": s["road_id"]} for s in restricted_segments],
    )

    await set_cached_route(redis_client, origin_dict, dest_dict, request.mode, route)
    await record_route_request(redis_client, user_id, origin_dict, dest_dict, request.mode)

    return route


async def reroute(
    request: RouteRerouteRequest,
    redis_client: redis.Redis,
    session: AsyncSession,
    user_id: str | None = None,
) -> RouteResponse:
    origin_dict = request.origin.model_dump()
    dest_dict = request.destination.model_dump()

    cached = await get_cached_route(redis_client, origin_dict, dest_dict, request.mode)
    if cached is not None:
        cached.cache_hit = True
        return cached

    restricted_segments = await get_restricted_segments(session)
    restricted_ids = {s["road_id"] for s in restricted_segments}
    all_avoid_ids = set(request.avoid_segment_ids) | restricted_ids

    avoid_waypoints = []
    if all_avoid_ids:
        for seg in restricted_segments:
            avoid_waypoints.append(
                ((request.origin.lat + request.destination.lat) / 2,
                 (request.origin.lon + request.destination.lon) / 2)
            )

    result = await mapbox_calculate_route(
        origin=(request.origin.lat, request.origin.lon),
        destination=(request.destination.lat, request.destination.lon),
        mode=request.mode,
        avoid_waypoints=avoid_waypoints if avoid_waypoints else None,
    )

    if result is None:
        raise AppError(
            code="NO_ROUTE_FOUND",
            message="Could not find an alternative route.",
            status_code=422,
        )

    route = RouteResponse(
        polyline=result["polyline"],
        distance_metres=result["distance_metres"],
        duration_seconds=result["duration_seconds"],
        origin=request.origin,
        destination=request.destination,
        mode=request.mode,
        cache_hit=False,
    )

    await set_cached_route(redis_client, origin_dict, dest_dict, request.mode, route)
    return route


async def list_restricted_segments(session: AsyncSession) -> list[dict]:
    return await get_restricted_segments(session)


async def list_all_segments(session: AsyncSession) -> list[dict]:
    return await get_all_segments(session)


async def apply_restriction(
    segment_id: uuid.UUID,
    reason: str,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> dict:
    segment = await get_segment_by_id(session, segment_id)
    if segment is None:
        raise NotFoundError("SEGMENT_NOT_FOUND", f"No road segment found with ID {segment_id}.")

    await restrict_segment(session, segment_id, reason)
    await session.commit()

    zone = segment.get("zone")
    count = await invalidate_route_cache(redis_client, zone)

    return {
        "segment_id": str(segment_id),
        "is_restricted": True,
        "restriction_reason": reason,
        "cache_entries_invalidated": count,
    }


async def clear_restriction(
    segment_id: uuid.UUID,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> dict:
    segment = await get_segment_by_id(session, segment_id)
    if segment is None:
        raise NotFoundError("SEGMENT_NOT_FOUND", f"No road segment found with ID {segment_id}.")

    await clear_segment_restriction(session, segment_id)
    await session.commit()

    zone = segment.get("zone")
    count = await invalidate_route_cache(redis_client, zone)

    return {
        "segment_id": str(segment_id),
        "is_restricted": False,
        "cache_entries_invalidated": count,
    }


async def get_segments_near_incident(
    session: AsyncSession,
    lon: float,
    lat: float,
    radius: float = 0.001,
) -> list[dict]:
    return await get_segments_intersecting_point(session, lon, lat, radius)
