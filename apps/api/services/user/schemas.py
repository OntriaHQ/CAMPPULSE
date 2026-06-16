from pydantic import BaseModel, Field


class RoleUpdate(BaseModel):
    role: str = Field(..., min_length=1)


class KycUpdate(BaseModel):
    kyc_status: str = Field(..., min_length=1)


class DriverProfileResponse(BaseModel):
    user_id: str
    full_name: str
    vehicle_type: str
    is_available: bool
    current_location: dict | None = None

    model_config = {"from_attributes": True}


class DriverAvailableItem(BaseModel):
    user_id: str
    full_name: str
    vehicle_type: str
    distance_metres: float
    current_location: dict | None = None


class DriversAvailableResponse(BaseModel):
    drivers: list[DriverAvailableItem]
    total: int
