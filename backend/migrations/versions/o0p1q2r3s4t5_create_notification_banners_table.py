"""
Alembic migration: Create notification_banners table.

Revision ID: o0p1q2r3s4t5
Revises: n9o0p1q2r3s4
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = 'o0p1q2r3s4t5'
down_revision = 'n9o0p1q2r3s4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notification_banners',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.String(), nullable=False),
        sa.Column('link_url', sa.String(), nullable=True),
        sa.Column('link_text', sa.String(), nullable=True),
        sa.Column('banner_type', sa.String(), server_default='ANNOUNCEMENT', nullable=False),
        sa.Column('bg_color', sa.String(), nullable=True),
        sa.Column('text_color', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_closable', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('notification_banners')
