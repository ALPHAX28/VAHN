"""add replacement fields to orders

Revision ID: u6v7w8x9y0z1
Revises: t5u6v7w8x9y0
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'u6v7w8x9y0z1'
down_revision = 't5u6v7w8x9y0'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('orders', sa.Column('return_type', sa.String(), nullable=True, server_default='RETURN'))
    op.add_column('orders', sa.Column('replacement_variant_id', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('replacement_variant_title', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('replacement_status', sa.String(), nullable=False, server_default='NONE'))
    op.add_column('orders', sa.Column('replacement_shipment_id', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('replacement_awb', sa.String(), nullable=True))
    op.create_index(op.f('ix_orders_replacement_awb'), 'orders', ['replacement_awb'], unique=False)
    op.add_column('orders', sa.Column('replacement_courier_name', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('replacement_tracking_url', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_index(op.f('ix_orders_replacement_awb'), table_name='orders')
    op.drop_column('orders', 'replacement_tracking_url')
    op.drop_column('orders', 'replacement_courier_name')
    op.drop_column('orders', 'replacement_awb')
    op.drop_column('orders', 'replacement_shipment_id')
    op.drop_column('orders', 'replacement_status')
    op.drop_column('orders', 'replacement_variant_title')
    op.drop_column('orders', 'replacement_variant_id')
    op.drop_column('orders', 'return_type')
