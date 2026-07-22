"""add_users_and_orders_tables

Revision ID: d9f1a2b3c4e5
Revises: c98a31e84012
Create Date: 2026-07-23 00:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9f1a2b3c4e5'
down_revision: Union[str, None] = 'c98a31e84012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('salt', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('otp_code', sa.String(), nullable=True),
        sa.Column('otp_expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create orders table
    op.create_table(
        'orders',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(), nullable=True, server_default='PROCESSING'),
        sa.Column('subtotal_amount', sa.Float(), nullable=False),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(), nullable=True, server_default='INR'),
        sa.Column('shipping_address', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index(op.f('ix_orders_id'), 'orders', ['id'], unique=False)

    # Create order_items table
    op.create_table(
        'order_items',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('order_id', sa.String(), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', sa.String(), nullable=True),
        sa.Column('product_title', sa.String(), nullable=False),
        sa.Column('variant_title', sa.String(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('price_amount', sa.Float(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=True, server_default='1'),
    )
    op.create_index(op.f('ix_order_items_id'), 'order_items', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_order_items_id'), table_name='order_items')
    op.drop_table('order_items')
    op.drop_index(op.f('ix_orders_id'), table_name='orders')
    op.drop_table('orders')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
