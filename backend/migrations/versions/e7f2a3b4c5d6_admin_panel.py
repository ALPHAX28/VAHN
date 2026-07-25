"""admin panel - role, is_active, suspension, colour groups, media assets, refund, review moderation

Revision ID: e7f2a3b4c5d6
Revises: c98a31e84012
Create Date: 2026-07-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7f2a3b4c5d6'
down_revision = 'd9f1a2b3c4e5'
branch_labels = None
depends_on = None


def upgrade():
    # ---- Users: add role, is_active, suspension fields ----
    op.add_column('users', sa.Column('role', sa.String(), nullable=True, server_default='customer'))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('users', sa.Column('suspended_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('suspension_reason', sa.String(), nullable=True))

    # ---- Orders: add refund fields, updated_at ----
    op.add_column('orders', sa.Column('refund_status', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('refund_note', sa.Text(), nullable=True))
    op.add_column('orders', sa.Column('updated_at', sa.DateTime(), nullable=True))

    # ---- Product Variants: add timestamps ----
    op.add_column('product_variants', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('product_variants', sa.Column('updated_at', sa.DateTime(), nullable=True))

    # ---- Products: add timestamps ----
    op.add_column('products', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('products', sa.Column('updated_at', sa.DateTime(), nullable=True))

    # ---- Product Reviews: add moderation fields, user_id, timestamps ----
    op.add_column('product_reviews', sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('product_reviews', sa.Column('is_approved', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('product_reviews', sa.Column('is_hidden', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('product_reviews', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('product_reviews', sa.Column('updated_at', sa.DateTime(), nullable=True))

    # ---- Create product_colour_groups table ----
    op.create_table(
        'product_colour_groups',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('colour_value', sa.String(), nullable=False),
        sa.Column('images', sa.JSON(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # ---- Create media_assets table ----
    op.create_table(
        'media_assets',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('url', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=True, server_default='uploadthing'),
        sa.Column('key', sa.String(), nullable=True),
        sa.Column('size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(), nullable=True),
        sa.Column('alt_text', sa.String(), nullable=True),
        sa.Column('uploaded_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table('media_assets')
    op.drop_table('product_colour_groups')

    op.drop_column('product_reviews', 'updated_at')
    op.drop_column('product_reviews', 'created_at')
    op.drop_column('product_reviews', 'is_hidden')
    op.drop_column('product_reviews', 'is_approved')
    op.drop_column('product_reviews', 'user_id')

    op.drop_column('products', 'updated_at')
    op.drop_column('products', 'created_at')

    op.drop_column('product_variants', 'updated_at')
    op.drop_column('product_variants', 'created_at')

    op.drop_column('orders', 'updated_at')
    op.drop_column('orders', 'refund_note')
    op.drop_column('orders', 'refund_status')

    op.drop_column('users', 'suspension_reason')
    op.drop_column('users', 'suspended_at')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'role')
