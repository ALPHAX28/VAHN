"""user_addresses, store_settings, and order fees/tax fields

Revision ID: f8a9b0c1d2e3
Revises: e7f2a3b4c5d6
Create Date: 2026-07-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f8a9b0c1d2e3'
down_revision = 'e7f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    # ---- Create user_addresses table ----
    op.create_table(
        'user_addresses',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('label', sa.String(), nullable=True, server_default='Home'),
        sa.Column('first_name', sa.String(), nullable=False),
        sa.Column('last_name', sa.String(), nullable=False),
        sa.Column('street_address', sa.String(), nullable=False),
        sa.Column('apartment', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('pincode', sa.String(), nullable=False),
        sa.Column('country', sa.String(), nullable=True, server_default='India'),
        sa.Column('phone', sa.String(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # ---- Create store_settings table ----
    op.create_table(
        'store_settings',
        sa.Column('key', sa.String(), primary_key=True, index=True),
        sa.Column('value', sa.String(), nullable=False),
    )

    # ---- Orders: add shipping_amount, tax_amount, discount_amount ----
    op.add_column('orders', sa.Column('shipping_amount', sa.Float(), nullable=True, server_default='0.0'))
    op.add_column('orders', sa.Column('tax_amount', sa.Float(), nullable=True, server_default='0.0'))
    op.add_column('orders', sa.Column('discount_amount', sa.Float(), nullable=True, server_default='0.0'))


def downgrade():
    op.drop_column('orders', 'discount_amount')
    op.drop_column('orders', 'tax_amount')
    op.drop_column('orders', 'shipping_amount')
    op.drop_table('store_settings')
    op.drop_table('user_addresses')
