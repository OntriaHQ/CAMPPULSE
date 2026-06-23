from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

VEHICLE_TYPES = ("bicycle", "tricycle", "car", "van", "ambulance")


class RideRequestCreate(BaseModel):
    pickup_lat: float = Field(..., ge=-90, le=90)
    pickup_lon: float = Field(..., ge=-180, le=180)
    pickup_label: str | None = None
    dropoff_lat: float = Field(..., ge=-90, le=90)
    dropoff_lon: float = Field(..., ge=-180, le=180)
    dropoff_label: str | None = None
    vehicle_type: str = "car"


class RideCancelRequest(BaseModel):
    reason: str | None = None


class RideResponse(BaseModel):
    id: str
    status: str
    vehicle_type: str
    rider_id: str
    rider_name: str | None = None
    driver_id: str | None = None
    driver_name: str | None = None
    driver_vehicle_type: str | None = None
    pickup_lat: float
    pickup_lon: float
    pickup_label: str | None = None
    dropoff_lat: float
    dropoff_lon: float
    dropoff_label: str | None = None
    distance_metres: float | None = None
    fare_estimate: Decimal | None = None
    eta_seconds: int | None = None
    candidate_driver_count: int | None = None
    requested_at: datetime
    accepted_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None


class RideListResponse(BaseModel):
    items: list[RideResponse]
    total: int
