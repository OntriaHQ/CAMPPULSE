"""006_camp_events — camp_events table for event management."""

from alembic import op

revision = "006_camp_events"
down_revision = "005_driver_and_notification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE event_category AS ENUM "
        "('service', 'conference', 'youth', 'special')"
    )
    op.execute(
        "CREATE TYPE event_status AS ENUM "
        "('upcoming', 'ongoing', 'past', 'cancelled')"
    )

    op.execute(
        """
        CREATE TABLE camp_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            date VARCHAR(100) NOT NULL,
            time VARCHAR(100) NOT NULL,
            area VARCHAR(255) NOT NULL,
            category event_category NOT NULL,
            status event_status NOT NULL DEFAULT 'upcoming',
            attendance VARCHAR(50),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_events_status ON camp_events(status)"
    )
    op.execute(
        "CREATE INDEX idx_events_category ON camp_events(category)"
    )
    op.execute(
        "CREATE INDEX idx_events_date ON camp_events(date)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS camp_events")
    op.execute("DROP TYPE IF EXISTS event_category")
    op.execute("DROP TYPE IF EXISTS event_status")
