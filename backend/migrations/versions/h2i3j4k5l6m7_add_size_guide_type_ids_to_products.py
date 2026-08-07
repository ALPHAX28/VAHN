"""add size_guide_type_ids to products

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa

revision = 'h2i3j4k5l6m7'
down_revision = 'g1h2i3j4k5l6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('size_guide_type_ids', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('products', 'size_guide_type_ids')
