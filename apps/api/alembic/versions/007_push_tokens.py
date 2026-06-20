"""007_push_tokens — add push_token column to users."""

from alembic import op
import sqlalchemy as sa

revision = "007_push_tokens"
down_revision = "006_camp_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("push_token", sa.String(), nullable=True))
    op.create_index(op.f("ix_users_push_token"), "users", ["push_token"])


def downgrade() -> None:
    op.drop_index(op.f("ix_users_push_token"), table_name="users")
    op.drop_column("users", "push_token")
