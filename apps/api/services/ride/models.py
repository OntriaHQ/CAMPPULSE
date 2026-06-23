import enum
import uuid
from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.models import Base
from services.user.models import VehicleType


class RideStatus(str, enum.Enum):
    requested = "requested"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Ride(Base):
    __tablename__ = "rides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    rider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    driver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[RideStatus] = mapped_column(
        Enum(RideStatus, name="ride_status", create_type=False),
        nullable=False,
        server_default="requested",
    )
    vehicle_type: Mapped[VehicleType] = mapped_column(
        Enum(VehicleType, name="vehicle_type", create_type=False),
        nullable=False,
        server_default="car",
    )
    pickup_location = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    pickup_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dropoff_location = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    dropoff_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    distance_metres: Mapped[float | None] = mapped_column(nullable=True)
    fare_estimate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    eta_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    rider = relationship("User", foreign_keys=[rider_id], lazy="selectin")
    driver = relationship("User", foreign_keys=[driver_id], lazy="selectin")
