"""add product category and attribute options
Revision ID: y0z1a2b3c4d5
Revises: x9y0z1a2b3c4
Create Date: 2026-10-10
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'y0z1a2b3c4d5'
down_revision = 'x9y0z1a2b3c4'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Add category column to products table
    op.add_column('products', sa.Column('category', sa.String(length=32), nullable=False, server_default='TOPS'))
    op.create_index(op.f('ix_products_category'), 'products', ['category'], unique=False)

    # 2. Backfill existing accessories (e.g. wristbands) to 'ACCESSORIES'
    op.execute(
        sa.text("UPDATE products SET category = 'ACCESSORIES' WHERE LOWER(title) LIKE '%wristband%' OR LOWER(handle) LIKE '%wristband%'")
    )

    # 3. Create product_attribute_options table
    op.create_table(
        'product_attribute_options',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('attribute_type', sa.String(length=32), nullable=False),
        sa.Column('category', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('icon_url', sa.String(length=500), nullable=True),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_product_attribute_options_id'), 'product_attribute_options', ['id'], unique=False)
    op.create_index(op.f('ix_product_attribute_options_attribute_type'), 'product_attribute_options', ['attribute_type'], unique=False)
    op.create_index(op.f('ix_product_attribute_options_category'), 'product_attribute_options', ['category'], unique=False)

    # 4. Seed default attribute options referencing existing brand icons
    seed_options = [
        # Fits - TOPS
        ('FIT', 'TOPS', 'Slim Fit', 'SLIM', '/icons/highlights/fits/slim.png', 1),
        ('FIT', 'TOPS', 'Regular Fit', 'REGULAR', '/icons/highlights/fits/regular.png', 2),
        ('FIT', 'TOPS', 'Relaxed Fit', 'RELAXED_FIT', '/icons/highlights/fits/relaxed-fit.png', 3),
        ('FIT', 'TOPS', 'Oversized', 'OVERSIZED', '/icons/highlights/fits/oversized.png', 4),
        ('FIT', 'TOPS', 'Athletic Performance', 'ATHLETIC_PERFORMANCE', '/icons/highlights/fits/athletic-performance.png', 5),

        # Fits - BOTTOMS
        ('FIT', 'BOTTOMS', 'Slim Fit', 'SLIM', '/icons/highlights/fits/slim.png', 1),
        ('FIT', 'BOTTOMS', 'Regular Fit', 'REGULAR', '/icons/highlights/fits/regular.png', 2),
        ('FIT', 'BOTTOMS', 'Relaxed Fit', 'RELAXED_FIT', '/icons/highlights/fits/relaxed-fit.png', 3),
        ('FIT', 'BOTTOMS', 'Tapered Fit', 'TAPERED', '/icons/highlights/fits/regular.png', 4),

        # Kit Types - TOPS
        ('KIT_TYPE', 'TOPS', 'Home', 'HOME', '/icons/highlights/kit_types/home.png', 1),
        ('KIT_TYPE', 'TOPS', 'Away', 'AWAY', '/icons/highlights/kit_types/away.png', 2),
        ('KIT_TYPE', 'TOPS', 'Jersey', 'JERSEY', '/icons/highlights/kit_types/jersey.png', 3),
        ('KIT_TYPE', 'TOPS', 'Signature', 'SIGNATURE', '/icons/highlights/kit_types/signature.png', 4),
        ('KIT_TYPE', 'TOPS', 'Training', 'TRAINING', '/icons/highlights/kit_types/training.png', 5),
        ('KIT_TYPE', 'TOPS', 'Third / Alt', 'THIRD_ALT', '/icons/highlights/kit_types/third-alt.png', 6),

        # Activities - ALL categories
        ('ACTIVITY', 'ALL', 'Football / Soccer', 'FOOTBALL', '/icons/highlights/activities/football-soccer.png', 1),
        ('ACTIVITY', 'ALL', 'Streetwear / Urban', 'STREETWEAR', '/icons/highlights/activities/streetwear.png', 2),
        ('ACTIVITY', 'ALL', 'Lifestyle', 'LIFESTYLE', '/icons/highlights/activities/lifestyle.png', 3),
        ('ACTIVITY', 'ALL', 'Running / Athletics', 'RUNNING', '/icons/highlights/activities/running-athletics.png', 4),
        ('ACTIVITY', 'ALL', 'Gym / Fitness', 'FITNESS', '/icons/highlights/activities/gym-fitness.png', 5),
        ('ACTIVITY', 'ALL', 'Basketball', 'BASKETBALL', '/icons/highlights/activities/basketball.png', 6),
        ('ACTIVITY', 'ALL', 'Cricket', 'CRICKET', '/icons/highlights/activities/cricket.png', 7),
    ]

    for attr_type, cat, name, code, icon_url, order in seed_options:
        op.execute(
            sa.text(
                "INSERT INTO product_attribute_options (attribute_type, category, name, code, icon_url, display_order, is_active) "
                f"VALUES ('{attr_type}', '{cat}', '{name}', '{code}', '{icon_url}', {order}, true)"
            )
        )

def downgrade() -> None:
    op.drop_index(op.f('ix_product_attribute_options_category'), table_name='product_attribute_options')
    op.drop_index(op.f('ix_product_attribute_options_attribute_type'), table_name='product_attribute_options')
    op.drop_index(op.f('ix_product_attribute_options_id'), table_name='product_attribute_options')
    op.drop_table('product_attribute_options')

    op.drop_index(op.f('ix_products_category'), table_name='products')
    op.drop_column('products', 'category')
