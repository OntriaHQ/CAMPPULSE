from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

INCIDENT_TYPES = Literal[
    "flooding", "pothole", "streetlight", "water_leak",
    "trash", "security", "congestion", "other",
]

SEVERITY_LEVELS = Literal["low", "medium", "high", "critical"]

STATUS_VALUES = Literal["submitted", "assigned", "in_progress", "resolved", "closed"]


class IncidentCreate(BaseModel):
    type: str
    description: str | None = None
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    severity: str = "low"


class IncidentCreateResponse(BaseModel):
    incident_id: str | None = None
    is_duplicate: bool = False
    parent_incident_id: str | None = None
    parent_upvote_count: int | None = None
    status: str | None = None
    department: str | None = None
    photo_url: str | None = None
    estimated_response_window: str | None = None
    message: str | None = None


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class CommentResponse(BaseModel):
    id: str
    body: str
    author_name: str
    created_at: datetime


class StatusUpdate(BaseModel):
    status: str
    note: str | None = None


class AssignRequest(BaseModel):
    assigned_to: str
    department: str | None = None


class IncidentDetail(BaseModel):
    id: str
    type: str
    description: str | None = None
    photo_url: str | None = None
    location: dict
    address_label: str | None = None
    zone: str | None = None
    severity: str
    status: str
    department: str | None = None
    upvote_count: int
    is_duplicate: bool
    reporter_name: str | None = None
    assignee_name: str | None = None
    comments: list[dict] = []
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None


class IncidentNearbyItem(BaseModel):
    id: str
    type: str
    severity: str
    status: str
    address_label: str | None = None
    upvote_count: int
    distance_metres: float


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    has_next: bool


class UpvoteResponse(BaseModel):
    incident_id: str
    upvote_count: int
