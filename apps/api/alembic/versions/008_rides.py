"""008_rides — rides table, ride_status enum."""

from alembic import op

revision = "008_rides"
down_revision = "007_push_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE ride_status AS ENUM "
        "('requested', 'accepted', 'in_progress', 'completed', 'cancelled')"
    )

    op.execute(
        """
        CREATE TABLE rides (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
            status ride_status NOT NULL DEFAULT 'requested',
            vehicle_type vehicle_type NOT NULL DEFAULT 'car',
            pickup_location GEOMETRY(Point, 4326) NOT NULL,
            pickup_label VARCHAR(255),
            dropoff_location GEOMETRY(Point, 4326) NOT NULL,
            dropoff_label VARCHAR(255),
            distance_metres DOUBLE PRECISION,
            fare_estimate NUMERIC(10, 2),
            eta_seconds INTEGER,
            cancel_reason VARCHAR(255),
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            accepted_at TIMESTAMPTZ,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_rides_rider ON rides(rider_id, created_at DESC)")
    op.execute("CREATE INDEX idx_rides_driver ON rides(driver_id, created_at DESC)")
    op.execute(
        "CREATE INDEX idx_rides_requested ON rides(status, requested_at) "
        "WHERE status = 'requested'"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS rides")
    op.execute("DROP TYPE IF EXISTS ride_status")
