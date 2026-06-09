"""002_users_auth — users, auth_sessions, enums."""

from alembic import op

revision = "002_users_auth"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.execute(
        "CREATE TYPE user_role AS ENUM ('guest', 'resident', 'driver', 'admin')"
    )
    op.execute(
        "CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'rejected')"
    )

    op.execute(
        """
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE,
            phone VARCHAR(20),
            full_name VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255),
            role user_role NOT NULL DEFAULT 'resident',
            kyc_status kyc_status NOT NULL DEFAULT 'pending',
            camp_id VARCHAR(100),
            zone VARCHAR(100),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_users_role ON users(role)")
    op.execute("CREATE INDEX idx_users_zone ON users(zone)")
    op.execute("CREATE INDEX idx_users_kyc ON users(kyc_status)")

    op.execute(
        """
        CREATE TABLE auth_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            refresh_token_hash VARCHAR(255) NOT NULL,
            device_fingerprint VARCHAR(255),
            issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            revoked BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_sessions_user ON auth_sessions(user_id)")
    op.execute(
        """
        CREATE INDEX idx_sessions_active ON auth_sessions(user_id, revoked)
        WHERE revoked = FALSE
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS auth_sessions")
    op.execute("DROP TABLE IF EXISTS users")
    op.execute("DROP TYPE IF EXISTS kyc_status")
    op.execute("DROP TYPE IF EXISTS user_role")
