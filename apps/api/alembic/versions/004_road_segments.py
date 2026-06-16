"""004_road_segments — road segments table with seed data."""

from alembic import op
import json
import os

revision = "004_road_segments"
down_revision = "003_incidents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE road_segments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            road_id VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            geom GEOMETRY(LineString, 4326) NOT NULL,
            zone VARCHAR(100),
            speed_limit INTEGER,
            is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
            restriction_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_road_segments_geom ON road_segments USING GIST(geom)")
    op.execute("CREATE INDEX idx_road_segments_restricted ON road_segments(is_restricted) WHERE is_restricted = true")
    op.execute("CREATE INDEX idx_road_segments_zone ON road_segments(zone)")

    roads_path = os.path.join(os.path.dirname(__file__), "../../../packages/map-config/src/roads.json")
    roads_abs = os.path.abspath(roads_path)
    if os.path.exists(roads_abs):
        with open(roads_abs) as f:
            data = json.load(f)
        features = data.get("features", [])
        for feature in features:
            props = feature.get("properties", {})
            geom = feature.get("geometry", {})
            road_id = props.get("road_id", "unknown")
            name = props.get("name", "Unnamed Road")
            geom_json = json.dumps(geom)
            op.execute(
                f"""
                INSERT INTO road_segments (road_id, name, geom)
                VALUES (
                    '{road_id}',
                    '{name}',
                    ST_SetSRID(ST_GeomFromGeoJSON('''{geom_json}'''), 4326)
                )
                """
            )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS road_segments")
