"""Initial schema migration

Revision ID: 001_initial_migration
Revises: None
Create Date: 2026-07-18 16:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_initial_migration'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Create collections table
    op.create_table(
        'collections',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('handle', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('description_html', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('image_alt', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_collections_handle'), 'collections', ['handle'], unique=True)
    op.create_index(op.f('ix_collections_id'), 'collections', ['id'], unique=False)

    # 2. Create products table
    op.create_table(
        'products',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('handle', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('description_html', sa.Text(), nullable=True),
        sa.Column('vendor', sa.String(), nullable=True),
        sa.Column('product_type', sa.String(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('available_for_sale', sa.Boolean(), nullable=True),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('featured_image_url', sa.String(), nullable=True),
        sa.Column('featured_image_alt', sa.String(), nullable=True),
        sa.Column('images', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_products_handle'), 'products', ['handle'], unique=True)
    op.create_index(op.f('ix_products_id'), 'products', ['id'], unique=False)

    # 3. Create collection_products association table
    op.create_table(
        'collection_products',
        sa.Column('collection_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['collection_id'], ['collections.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('collection_id', 'product_id')
    )

    # 4. Create product_variants table
    op.create_table(
        'product_variants',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('available_for_sale', sa.Boolean(), nullable=True),
        sa.Column('price_amount', sa.Float(), nullable=False),
        sa.Column('price_currency', sa.String(), nullable=True),
        sa.Column('compare_at_price_amount', sa.Float(), nullable=True),
        sa.Column('compare_at_price_currency', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('selected_options', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_product_variants_id'), 'product_variants', ['id'], unique=False)

    # 5. Create carts table
    op.create_table(
        'carts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_carts_id'), 'carts', ['id'], unique=False)

    # 6. Create cart_items table
    op.create_table(
        'cart_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('cart_id', sa.String(), nullable=False),
        sa.Column('variant_id', sa.String(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['cart_id'], ['carts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cart_items_id'), 'cart_items', ['id'], unique=False)


def downgrade() -> None:
    op.drop_table('cart_items')
    op.drop_table('carts')
    op.drop_table('product_variants')
    op.drop_table('collection_products')
    op.drop_index(op.f('ix_products_id'), table_name='products')
    op.drop_index(op.f('ix_products_handle'), table_name='products')
    op.drop_table('products')
    op.drop_index(op.f('ix_collections_id'), table_name='collections')
    op.drop_index(op.f('ix_collections_handle'), table_name='collections')
    op.drop_table('collections')
