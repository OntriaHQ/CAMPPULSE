from datetime import datetime

from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    date: str = Field(..., min_length=1, max_length=100)
    time: str = Field(..., min_length=1, max_length=100)
    area: str = Field(..., min_length=1, max_length=255)
    category: str = Field(...)
    status: str = "upcoming"
    attendance: str | None = None


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    date: str | None = Field(default=None, min_length=1, max_length=100)
    time: str | None = Field(default=None, min_length=1, max_length=100)
    area: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = None
    status: str | None = None
    attendance: str | None = None


class EventResponse(BaseModel):
    id: str
    title: str
    description: str
    date: str
    time: str
    area: str
    category: str
    status: str
    attendance: str | None = None
    created_at: datetime
    updated_at: datetime
