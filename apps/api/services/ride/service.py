import logging
import uuid

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.db.queries.drivers import (
    find_nearest_available_drivers,
    get_driver_distance_to_point,
    mark_driver_availability,
)
from core.db.queries.rides import (
    accept_ride_sql,
    cancel_ride_sql,
    complete_ride_sql,
    get_ride_by_id,
    get_ride_for_update,
    insert_ride,
    list_rides_for_user,
    start_ride_sql,
)
from core.exceptions import AppError, AuthorisationError, ConflictError, NotFoundError
from services.ride.pricing import estimate_duration_seconds, estimate_fare, haversine_distance_metres
from services.ride.schemas import RideRequestCreate, RideResponse

logger = logging.getLogger(__name__)

_CANDIDATES_TTL = 90  # seconds a ride request stays open to nearby drivers


def _candidates_key(ride_id: uuid.UUID) -> str:
    return f"ride:{ride_id}:candidates"


def _to_response(row: dict, candidate_driver_count: int | None = None) -> RideResponse:
    return RideResponse(
        id=str(row["id"]),
        status=row["status"],
        vehicle_type=row["vehicle_type"],
        rider_id=str(row["rider_id"]),
        rider_name=row["rider_name"],
        driver_id=str(row["driver_id"]) if row["driver_id"] else None,
        driver_name=row["driver_name"],
        driver_vehicle_type=row["driver_vehicle_type"],
        pickup_lat=float(row["pickup_lat"]),
        pickup_lon=float(row["pickup_lon"]),
        pickup_label=row["pickup_label"],
        dropoff_lat=float(row["dropoff_lat"]),
        dropoff_lon=float(row["dropoff_lon"]),
        dropoff_label=row["dropoff_label"],
        distance_metres=row["distance_metres"],
        fare_estimate=row["fare_estimate"],
        eta_seconds=row["eta_seconds"],
        candidate_driver_count=candidate_driver_count,
        requested_at=row["requested_at"],
        accepted_at=row["accepted_at"],
        started_at=row["started_at"],
        completed_at=row["completed_at"],
        cancelled_at=row["cancelled_at"],
        cancel_reason=row["cancel_reason"],
    )


async def request_ride(
    rider_id: uuid.UUID,
    data: RideRequestCreate,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> RideResponse:
    distance = haversine_distance_metres(
        data.pickup_lat, data.pickup_lon, data.dropoff_lat, data.dropoff_lon
    )
    fare = estimate_fare(distance, data.vehicle_type)

    ride_id = await insert_ride(
        rider_id,
        data.vehicle_type,
        data.pickup_lat,
        data.pickup_lon,
        data.pickup_label,
        data.dropoff_lat,
        data.dropoff_lon,
        data.dropoff_label,
        distance,
        float(fare),
        session,
    )
    await session.commit()

    candidates: list = []
    for radius in (2000, 5000):
        candidates = await find_nearest_available_drivers(
            data.pickup_lon, data.pickup_lat, radius, 5, session
        )
        if candidates:
            break

    candidate_ids = [str(c[0]) for c in candidates]
    if candidate_ids:
        await redis_client.sadd(_candidates_key(ride_id), *candidate_ids)
        await redis_client.expire(_candidates_key(ride_id), _CANDIDATES_TTL)

    from core.connection_manager import connection_manager

    for candidate in candidates:
        driver_user_id = str(candidate[0])
        await connection_manager.send_to_user(driver_user_id, {
            "type": "ride_request",
            "payload": {
                "ride_id": str(ride_id),
                "pickup_lat": data.pickup_lat,
                "pickup_lon": data.pickup_lon,
                "pickup_label": data.pickup_label,
                "dropoff_lat": data.dropoff_lat,
                "dropoff_lon": data.dropoff_lon,
                "dropoff_label": data.dropoff_label,
                "distance_metres": distance,
                "fare_estimate": str(fare),
                "vehicle_type": data.vehicle_type,
                "pickup_distance_metres": float(candidate[3]),
            },
        })

    row = await get_ride_by_id(ride_id, session)
    return _to_response(row, candidate_driver_count=len(candidate_ids))


async def accept_ride(
    ride_id: uuid.UUID,
    driver_id: uuid.UUID,
    session: AsyncSession,
    redis_client: redis.Redis,
) -> RideResponse:
    locked = await get_ride_for_update(ride_id, session)
    if locked is None:
        raise NotFoundError("RIDE_NOT_FOUND", f"No ride found with ID {ride_id}.")
    if locked["status"] != "requested":
        raise ConflictError("RIDE_ALREADY_TAKEN", "This ride is no longer available.")

    row = await get_ride_by_id(ride_id, session)
    pickup_distance = await get_driver_distance_to_point(
        driver_id, row["pickup_lon"], row["pickup_lat"], session
    )
    eta_seconds = estimate_duration_seconds(pickup_distance or 1000, row["vehicle_type"])

    await accept_ride_sql(ride_id, driver_id, eta_seconds, session)
    await mark_driver_availability(driver_id, False, session)
    await session.commit()

    updated = await get_ride_by_id(ride_id, session)

    from core.connection_manager import connection_manager

    await connection_manager.send_to_user(str(updated["rider_id"]), {
        "type": "ride_accepted",
        "payload": {
            "ride_id": str(ride_id),
            "driver_name": updated["driver_name"],
            "driver_vehicle_type": updated["driver_vehicle_type"],
            "eta_seconds": updated["eta_seconds"],
        },
    })

    candidates_key = _candidates_key(ride_id)
    other_candidates = await redis_client.smembers(candidates_key)
    for candidate_id in other_candidates:
        if candidate_id != str(driver_id):
            await connection_manager.send_to_user(candidate_id, {
                "type": "ride_unavailable",
                "payload": {"ride_id": str(ride_id)},
            })
    await redis_client.delete(candidates_key)

    return _to_response(updated)


async def _transition_ride(
    ride_id: uuid.UUID,
    driver_id: uuid.UUID,
    from_status: str,
    to_status: str,
    sql_fn,
    session: AsyncSession,
) -> RideResponse:
    row = await get_ride_by_id(ride_id, session)
    if row is None:
        raise NotFoundError("RIDE_NOT_FOUND", f"No ride found with ID {ride_id}.")
    if row["driver_id"] is None or str(row["driver_id"]) != str(driver_id):
        raise AuthorisationError("NOT_ASSIGNED_DRIVER", "You are not the assigned driver for this ride.")
    if row["status"] != from_status:
        raise ConflictError("INVALID_RIDE_TRANSITION", f"Ride must be '{from_status}' to perform this action.")

    await sql_fn(ride_id, session)
    await session.commit()

    updated = await get_ride_by_id(ride_id, session)

    from core.connection_manager import connection_manager

    await connection_manager.send_to_user(str(updated["rider_id"]), {
        "type": "ride_status",
        "payload": {"ride_id": str(ride_id), "status": to_status},
    })

    return _to_response(updated)


async def start_ride(ride_id: uuid.UUID, driver_id: uuid.UUID, session: AsyncSession) -> RideResponse:
    return await _transition_ride(ride_id, driver_id, "accepted", "in_progress", start_ride_sql, session)


async def complete_ride(ride_id: uuid.UUID, driver_id: uuid.UUID, session: AsyncSession) -> RideResponse:
    response = await _transition_ride(
        ride_id, driver_id, "in_progress", "completed", complete_ride_sql, session
    )
    await mark_driver_availability(driver_id, True, session)
    await session.commit()
    return response


async def cancel_ride(
    ride_id: uuid.UUID,
    user_id: uuid.UUID,
    reason: str | None,
    session: AsyncSession,
) -> RideResponse:
    row = await get_ride_by_id(ride_id, session)
    if row is None:
        raise NotFoundError("RIDE_NOT_FOUND", f"No ride found with ID {ride_id}.")

    is_rider = str(row["rider_id"]) == str(user_id)
    is_driver = row["driver_id"] is not None and str(row["driver_id"]) == str(user_id)
    if not (is_rider or is_driver):
        raise AuthorisationError("NOT_RIDE_PARTICIPANT", "You are not part of this ride.")
    if row["status"] in ("completed", "cancelled"):
        raise ConflictError("RIDE_ALREADY_FINISHED", "This ride has already finished.")

    await cancel_ride_sql(ride_id, reason, session)
    if row["driver_id"] is not None:
        await mark_driver_availability(row["driver_id"], True, session)
    await session.commit()

    updated = await get_ride_by_id(ride_id, session)

    from core.connection_manager import connection_manager

    notify_id = str(row["driver_id"]) if is_rider and row["driver_id"] else str(row["rider_id"])
    if notify_id:
        await connection_manager.send_to_user(notify_id, {
            "type": "ride_cancelled",
            "payload": {"ride_id": str(ride_id), "reason": reason},
        })

    return _to_response(updated)


async def get_ride(ride_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession) -> RideResponse:
    row = await get_ride_by_id(ride_id, session)
    if row is None:
        raise NotFoundError("RIDE_NOT_FOUND", f"No ride found with ID {ride_id}.")
    if str(row["rider_id"]) != str(user_id) and str(row["driver_id"]) != str(user_id):
        raise AuthorisationError("NOT_RIDE_PARTICIPANT", "You are not part of this ride.")
    return _to_response(row)


async def list_my_rides(user_id: uuid.UUID, as_driver: bool, session: AsyncSession) -> list[RideResponse]:
    rows = await list_rides_for_user(user_id, as_driver, session)
    return [_to_response(row) for row in rows]
