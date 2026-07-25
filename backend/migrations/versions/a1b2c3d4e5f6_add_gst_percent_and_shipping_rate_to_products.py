"""add_gst_percent_and_shipping_rate_to_products

Revision ID: a1b2c3d4e5f6
Revises: f8a9b0c1d2e3
Create Date: 2026-07-25 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add gst_percent column with a default of 12.0 (Standard GST rate for garments in India)
    op.add_column('products', sa.Column('gst_percent', sa.Float(), nullable=True))
    # Set default for existing rows
    op.execute("UPDATE products SET gst_percent = 12.0 WHERE gst_percent IS NULL")
    # Alter column to NOT NULL to match models.py
    op.alter_column('products', 'gst_percent', existing_type=sa.Float(), nullable=False)
    # Add shipping_rate column — NULL means use the global shipping rule
    op.add_column('products', sa.Column('shipping_rate', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'shipping_rate')
    op.drop_column('products', 'gst_percent')
