"""
Alembic migration: Add email column to user_addresses table.

Revision ID: l7m8n9o0p1q2
Revises: k6l7m8n9o0p1
Create Date: 2026-08-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'l7m8n9o0p1q2'
down_revision = 'k6l7m8n9o0p1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user_addresses', sa.Column('email', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_addresses', 'email')
