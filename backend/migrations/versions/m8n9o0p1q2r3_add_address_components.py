"""
Alembic migration: Add address components (house_flat_no, building_name, floor_no, block_wing) to user_addresses table.

Revision ID: m8n9o0p1q2r3
Revises: l7m8n9o0p1q2
Create Date: 2026-08-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'm8n9o0p1q2r3'
down_revision = 'l7m8n9o0p1q2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user_addresses', sa.Column('house_flat_no', sa.String(), nullable=True))
    op.add_column('user_addresses', sa.Column('building_name', sa.String(), nullable=True))
    op.add_column('user_addresses', sa.Column('floor_no', sa.String(), nullable=True))
    op.add_column('user_addresses', sa.Column('block_wing', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_addresses', 'block_wing')
    op.drop_column('user_addresses', 'floor_no')
    op.drop_column('user_addresses', 'building_name')
    op.drop_column('user_addresses', 'house_flat_no')
