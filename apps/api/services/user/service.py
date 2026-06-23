import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db.queries.drivers import (
    find_nearest_available_drivers as find_nearest_drivers_query,
)
from core.exceptions import AppError, NotFoundError
from services.user.models import DriverProfile, KycStatus, User, UserRole, VehicleType


async def get_nearest_available_drivers(
    lat: float,
    lon: float,
    radius_metres: int,
    session: AsyncSession,
) -> list[dict]:
    rows = await find_nearest_drivers_query(lon, lat, radius_metres, 5, session)
    return [
        {
            "user_id": str(r[0]),
            "full_name": r[1],
            "vehicle_type": r[2],
            "distance_metres": float(r[3]),
            "current_location": {"lat": float(r[4]), "lon": float(r[5])} if r[4] else None,
        }
        for r in rows
    ]


async def update_user_role(
    user_id: uuid.UUID,
    new_role: str,
    session: AsyncSession,
) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError("USER_NOT_FOUND", f"No user found with ID {user_id}.")

    valid_roles = {e.value for e in UserRole}
    if new_role not in valid_roles:
        raise AppError(
            "INVALID_ROLE",
            f"Invalid role '{new_role}'. Must be one of: {', '.join(sorted(valid_roles))}.",
            status_code=400,
        )

    user.role = UserRole(new_role)

    if user.role == UserRole.driver:
        existing_profile = await session.scalar(
            select(DriverProfile).where(DriverProfile.user_id == user.id)
        )
        if existing_profile is None:
            profile = DriverProfile(
                user_id=user.id,
                vehicle_type=VehicleType.tricycle,  # default
                is_available=True
            )
            session.add(profile)
            
    await session.commit()

    return {
        "id": str(user.id),
        "role": user.role.value,
    }


async def update_user_kyc(
    user_id: uuid.UUID,
    new_kyc_status: str,
    session: AsyncSession,
) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError("USER_NOT_FOUND", f"No user found with ID {user_id}.")

    valid_statuses = {e.value for e in KycStatus}
    if new_kyc_status not in valid_statuses:
        raise AppError(
            "INVALID_KYC_STATUS",
            f"Invalid KYC status '{new_kyc_status}'. Must be one of: {', '.join(sorted(valid_statuses))}.",
            status_code=400,
        )

    user.kyc_status = KycStatus(new_kyc_status)
    await session.commit()

    return {
        "id": str(user.id),
        "kyc_status": user.kyc_status.value,
    }
