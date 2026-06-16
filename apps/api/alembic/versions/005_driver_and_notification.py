"""005_driver_and_notification — driver_profiles, notification_log, enums."""

from alembic import op

revision = "005_driver_and_notification"
down_revision = "004_road_segments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE vehicle_type AS ENUM "
        "('bicycle', 'tricycle', 'car', 'van', 'ambulance')"
    )
    op.execute(
        "CREATE TYPE notification_type AS ENUM "
        "('incident_update', 'zone_broadcast', 'emergency_alert', "
        "'congestion_alert', 'dispatch_assignment')"
    )
    op.execute(
        "CREATE TYPE notification_channel AS ENUM ('in_app', 'push', 'both')"
    )

    op.execute(
        """
        CREATE TABLE driver_profiles (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            vehicle_type vehicle_type NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            current_location GEOMETRY(Point, 4326),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_driver_location ON driver_profiles USING GIST(current_location)"
    )
    op.execute(
        "CREATE INDEX idx_driver_available ON driver_profiles(is_available) "
        "WHERE is_available = TRUE"
    )

    op.execute(
        """
        CREATE TABLE notification_log (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type notification_type NOT NULL,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            channel notification_channel NOT NULL DEFAULT 'in_app',
            delivered BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_notification_user ON notification_log(user_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX idx_notification_undelivered ON notification_log(user_id, delivered) "
        "WHERE delivered = FALSE"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notification_log")
    op.execute("DROP TABLE IF EXISTS driver_profiles")
    op.execute("DROP TYPE IF EXISTS notification_channel")
    op.execute("DROP TYPE IF EXISTS notification_type")
    op.execute("DROP TYPE IF EXISTS vehicle_type")
