"""add warehouse locations table

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = 't5u6v7w8x9y0'
down_revision = 's4t5u6v7w8x9'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'warehouse_locations',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('pickup_location', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('phone', sa.String(), nullable=False),
        sa.Column('address', sa.String(), nullable=False),
        sa.Column('address_2', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('country', sa.String(), nullable=False, server_default='India'),
        sa.Column('pin_code', sa.String(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('shiprocket_pickup_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )

def downgrade() -> None:
    op.drop_table('warehouse_locations')
