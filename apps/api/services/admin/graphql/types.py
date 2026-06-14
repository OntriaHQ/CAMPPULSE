import strawberry
from datetime import datetime
from typing import Optional, List


@strawberry.type
class IncidentLocation:
    lat: float
    lon: float


@strawberry.type
class IncidentType:
    id: str
    type: str
    severity: str
    status: str
    zone: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    address_label: Optional[str] = None
    upvote_count: int = 0
    department: Optional[str] = None
    reporter_name: Optional[str] = None
    assignee_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    location: Optional[IncidentLocation] = None


@strawberry.type
class DashboardSummaryType:
    total_incidents: int
    open_incidents: int
    in_progress_incidents: int
    active_zones: int
    congestion_zones_count: int


@strawberry.type
class HotspotType:
    zone: str
    incident_count: int
    lat: float
    lon: float


@strawberry.type
class EquityMetricType:
    zone: str
    total_incidents: int
    avg_resolution_time_minutes: float


@strawberry.type
class UserType:
    id: str
    email: str
    full_name: str
    role: str
    zone: Optional[str] = None


@strawberry.type
class MutationResponse:
    success: bool
    message: Optional[str] = None
    id: Optional[str] = None
