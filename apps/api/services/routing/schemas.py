from pydantic import BaseModel, Field


class RoutePoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class RouteCalculateRequest(BaseModel):
    origin: RoutePoint
    destination: RoutePoint
    mode: str = Field(default="walking", pattern=r"^(walking|tricycle)$")


class RouteRerouteRequest(BaseModel):
    origin: RoutePoint
    destination: RoutePoint
    mode: str = Field(default="walking", pattern=r"^(walking|tricycle)$")
    avoid_segment_ids: list[str] = Field(default_factory=list)


class RouteResponse(BaseModel):
    polyline: str
    distance_metres: float
    duration_seconds: float
    origin: RoutePoint
    destination: RoutePoint
    mode: str
    cache_hit: bool = False
    segments: list[dict] = []


class SegmentRestrictRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class SegmentResponse(BaseModel):
    id: str
    road_id: str
    name: str
    zone: str | None = None
    is_restricted: bool
    restriction_reason: str | None = None
