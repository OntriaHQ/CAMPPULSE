import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.models import Base


class RoadSegment(Base):
    __tablename__ = "road_segments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    road_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    geom = mapped_column(Geometry("LINESTRING", srid=4326), nullable=False)
    zone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    speed_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_restricted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    restriction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
