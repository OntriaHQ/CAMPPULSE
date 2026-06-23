import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_RIDE_SELECT_FIELDS = """
    r.id, r.status, r.vehicle_type, r.rider_id, ru.full_name AS rider_name,
    r.driver_id, du.full_name AS driver_name,
    dp.vehicle_type::text AS driver_vehicle_type,
    ST_Y(r.pickup_location::geometry) AS pickup_lat,
    ST_X(r.pickup_location::geometry) AS pickup_lon,
    r.pickup_label,
    ST_Y(r.dropoff_location::geometry) AS dropoff_lat,
    ST_X(r.dropoff_location::geometry) AS dropoff_lon,
    r.dropoff_label,
    r.distance_metres, r.fare_estimate, r.eta_seconds,
    r.cancel_reason,
    r.requested_at, r.accepted_at, r.started_at, r.completed_at, r.cancelled_at
"""

_RIDE_FROM = """
    FROM rides r
    JOIN users ru ON ru.id = r.rider_id
    LEFT JOIN users du ON du.id = r.driver_id
    LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id
"""


def _row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "status": row[1],
        "vehicle_type": row[2],
        "rider_id": row[3],
        "rider_name": row[4],
        "driver_id": row[5],
        "driver_name": row[6],
        "driver_vehicle_type": row[7],
        "pickup_lat": row[8],
        "pickup_lon": row[9],
        "pickup_label": row[10],
        "dropoff_lat": row[11],
        "dropoff_lon": row[12],
        "dropoff_label": row[13],
        "distance_metres": row[14],
        "fare_estimate": row[15],
        "eta_seconds": row[16],
        "cancel_reason": row[17],
        "requested_at": row[18],
        "accepted_at": row[19],
        "started_at": row[20],
        "completed_at": row[21],
        "cancelled_at": row[22],
    }


async def insert_ride(
    rider_id: uuid.UUID,
    vehicle_type: str,
    pickup_lat: float,
    pickup_lon: float,
    pickup_label: str | None,
    dropoff_lat: float,
    dropoff_lon: float,
    dropoff_label: str | None,
    distance_metres: float,
    fare_estimate: float,
    session: AsyncSession,
) -> uuid.UUID:
    result = await session.execute(
        text("""
            INSERT INTO rides (
                rider_id, vehicle_type, pickup_location, pickup_label,
                dropoff_location, dropoff_label, distance_metres, fare_estimate
            )
            VALUES (
                :rider_id, :vehicle_type,
                ST_SetSRID(ST_Point(:pickup_lon, :pickup_lat), 4326),
                :pickup_label,
                ST_SetSRID(ST_Point(:dropoff_lon, :dropoff_lat), 4326),
                :dropoff_label, :distance_metres, :fare_estimate
            )
            RETURNING id
        """),
        {
            "rider_id": rider_id,
            "vehicle_type": vehicle_type,
            "pickup_lat": pickup_lat,
            "pickup_lon": pickup_lon,
            "pickup_label": pickup_label,
            "dropoff_lat": dropoff_lat,
            "dropoff_lon": dropoff_lon,
            "dropoff_label": dropoff_label,
            "distance_metres": distance_metres,
            "fare_estimate": fare_estimate,
        },
    )
    return result.fetchone()[0]


async def get_ride_by_id(ride_id: uuid.UUID, session: AsyncSession) -> dict | None:
    result = await session.execute(
        text(f"SELECT {_RIDE_SELECT_FIELDS} {_RIDE_FROM} WHERE r.id = :ride_id"),
        {"ride_id": ride_id},
    )
    row = result.fetchone()
    return _row_to_dict(row) if row else None


async def get_ride_for_update(ride_id: uuid.UUID, session: AsyncSession) -> dict | None:
    """Locks the ride row to prevent two drivers accepting concurrently."""
    result = await session.execute(
        text("SELECT id, status, rider_id, driver_id FROM rides WHERE id = :ride_id FOR UPDATE"),
        {"ride_id": ride_id},
    )
    row = result.fetchone()
    if row is None:
        return None
    return {"id": row[0], "status": row[1], "rider_id": row[2], "driver_id": row[3]}


async def accept_ride_sql(
    ride_id: uuid.UUID,
    driver_id: uuid.UUID,
    eta_seconds: int,
    session: AsyncSession,
) -> None:
    await session.execute(
        text("""
            UPDATE rides
            SET status = 'accepted', driver_id = :driver_id, eta_seconds = :eta_seconds,
                accepted_at = NOW(), updated_at = NOW()
            WHERE id = :ride_id
        """),
        {"ride_id": ride_id, "driver_id": driver_id, "eta_seconds": eta_seconds},
    )


async def start_ride_sql(ride_id: uuid.UUID, session: AsyncSession) -> None:
    await session.execute(
        text("""
            UPDATE rides SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
            WHERE id = :ride_id
        """),
        {"ride_id": ride_id},
    )


async def complete_ride_sql(ride_id: uuid.UUID, session: AsyncSession) -> None:
    await session.execute(
        text("""
            UPDATE rides SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE id = :ride_id
        """),
        {"ride_id": ride_id},
    )


async def cancel_ride_sql(
    ride_id: uuid.UUID,
    reason: str | None,
    session: AsyncSession,
) -> None:
    await session.execute(
        text("""
            UPDATE rides
            SET status = 'cancelled', cancel_reason = :reason, cancelled_at = NOW(), updated_at = NOW()
            WHERE id = :ride_id
        """),
        {"ride_id": ride_id, "reason": reason},
    )


async def list_rides_for_user(
    user_id: uuid.UUID,
    as_driver: bool,
    session: AsyncSession,
    limit: int = 20,
) -> list[dict]:
    column = "r.driver_id" if as_driver else "r.rider_id"
    result = await session.execute(
        text(f"""
            SELECT {_RIDE_SELECT_FIELDS} {_RIDE_FROM}
            WHERE {column} = :user_id
            ORDER BY r.requested_at DESC
            LIMIT :limit
        """),
        {"user_id": user_id, "limit": limit},
    )
    return [_row_to_dict(row) for row in result.fetchall()]
