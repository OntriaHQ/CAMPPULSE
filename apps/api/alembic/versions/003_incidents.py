"""003_incidents — incidents, upvotes, comments, camp_zones, enums."""

from alembic import op

revision = "003_incidents"
down_revision = "002_users_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')

    op.execute(
        "CREATE TYPE incident_type AS ENUM ("
        "'flooding', 'pothole', 'streetlight', 'water_leak',"
        "'trash', 'security', 'congestion', 'other')"
    )
    op.execute(
        "CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical')"
    )
    op.execute(
        "CREATE TYPE incident_status AS ENUM ("
        "'submitted', 'assigned', 'in_progress', 'resolved', 'closed')"
    )
    op.execute(
        "CREATE TYPE department AS ENUM ("
        "'infrastructure', 'sanitation', 'security', 'utilities', 'emergency')"
    )

    op.execute(
        """
        CREATE TABLE camp_zones (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL UNIQUE,
            boundary GEOMETRY(Polygon, 4326) NOT NULL,
            zone_type VARCHAR(50),
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_zone_boundary ON camp_zones USING GIST(boundary)")

    op.execute(
        """
        CREATE TABLE incidents (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
            type incident_type NOT NULL,
            description TEXT,
            photo_url VARCHAR(500),
            location GEOMETRY(Point, 4326) NOT NULL,
            address_label VARCHAR(255),
            zone VARCHAR(100),
            severity incident_severity NOT NULL DEFAULT 'low',
            status incident_status NOT NULL DEFAULT 'submitted',
            department department,
            assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
            upvote_count INTEGER NOT NULL DEFAULT 0,
            is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
            parent_incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
            resolved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_incident_location ON incidents USING GIST(location)")
    op.execute(
        "CREATE INDEX idx_incident_active ON incidents(type, zone, status) "
        "WHERE status NOT IN ('resolved', 'closed')"
    )
    op.execute("CREATE INDEX idx_incident_department ON incidents(department, status, created_at DESC)")
    op.execute("CREATE INDEX idx_incident_reporter ON incidents(reporter_id, created_at DESC)")

    op.execute(
        """
        CREATE TABLE incident_upvotes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(incident_id, user_id)
        )
        """
    )
    op.execute("CREATE INDEX idx_upvotes_incident ON incident_upvotes(incident_id)")

    op.execute(
        """
        CREATE TABLE incident_comments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_comments_incident ON incident_comments(incident_id, created_at ASC)")

    op.execute(
        """
        INSERT INTO camp_zones (name, boundary, zone_type, description) VALUES
        ('boundary', ST_SetSRID(ST_GeomFromGeoJSON('{
            "type": "Polygon",
            "coordinates": [[[3.3900,6.9220],[3.4020,6.9220],[3.4020,6.9320],[3.3900,6.9320],[3.3900,6.9220]]]
        }'), 4326), 'boundary', 'Redemption City camp boundary'),
        ('Zone A', ST_SetSRID(ST_GeomFromGeoJSON('{
            "type": "Polygon",
            "coordinates": [[[3.3900,6.9220],[3.3960,6.9220],[3.3960,6.9270],[3.3900,6.9270],[3.3900,6.9220]]]
        }'), 4326), 'residential', 'Western residential zone'),
        ('Zone B', ST_SetSRID(ST_GeomFromGeoJSON('{
            "type": "Polygon",
            "coordinates": [[[3.3960,6.9220],[3.4020,6.9220],[3.4020,6.9270],[3.3960,6.9270],[3.3960,6.9220]]]
        }'), 4326), 'residential', 'Eastern residential zone')
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS incident_comments")
    op.execute("DROP TABLE IF EXISTS incident_upvotes")
    op.execute("DROP TABLE IF EXISTS incidents")
    op.execute("DROP TABLE IF EXISTS camp_zones")
    op.execute("DROP TYPE IF EXISTS department")
    op.execute("DROP TYPE IF EXISTS incident_status")
    op.execute("DROP TYPE IF EXISTS incident_severity")
    op.execute("DROP TYPE IF EXISTS incident_type")
