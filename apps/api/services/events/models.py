import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.models import Base


class EventCategory(str, enum.Enum):
    service = "service"
    conference = "conference"
    youth = "youth"
    special = "special"


class EventStatus(str, enum.Enum):
    upcoming = "upcoming"
    ongoing = "ongoing"
    past = "past"
    cancelled = "cancelled"


class CampEvent(Base):
    __tablename__ = "camp_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    date: Mapped[str] = mapped_column(String(100), nullable=False)
    time: Mapped[str] = mapped_column(String(100), nullable=False)
    area: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[EventCategory] = mapped_column(
        Enum(EventCategory, name="event_category", create_type=False), nullable=False
    )
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status", create_type=False),
        nullable=False, server_default="upcoming",
    )
    attendance: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
