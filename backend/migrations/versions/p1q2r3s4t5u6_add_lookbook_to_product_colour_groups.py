"""add lookbook to product_colour_groups

Revision ID: p1q2r3s4t5u6
Revises: o0p1q2r3s4t5
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa


revision = 'p1q2r3s4t5u6'
down_revision = 'o0p1q2r3s4t5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('product_colour_groups', sa.Column('lookbook', sa.JSON(), nullable=True, server_default='[]'))


def downgrade() -> None:
    op.drop_column('product_colour_groups', 'lookbook')
