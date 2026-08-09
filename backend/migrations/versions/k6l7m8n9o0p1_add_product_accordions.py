"""
Alembic migration: Add size_fit_details, care_instructions, and product_details to products table.

Revision ID: k6l7m8n9o0p1
Revises: j4k5l6m7n8o9
Create Date: 2026-08-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'k6l7m8n9o0p1'
down_revision = 'j4k5l6m7n8o9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('size_fit_details', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('care_instructions', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('product_details', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'product_details')
    op.drop_column('products', 'care_instructions')
    op.drop_column('products', 'size_fit_details')
