"""add restock_subscriptions table

Revision ID: 3f6a89c1d2e4
Revises: 2e5b33fa1859
Create Date: 2026-07-29

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '3f6a89c1d2e4'
down_revision = '2e5b33fa1859'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'restock_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('product_title', sa.String(), nullable=False),
        sa.Column('product_handle', sa.String(), nullable=False),
        sa.Column('colour_value', sa.String(), nullable=True),
        sa.Column('variant_id', sa.String(), nullable=True),
        sa.Column('notified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_restock_subscriptions_id'), 'restock_subscriptions', ['id'], unique=False)
    op.create_index(op.f('ix_restock_subscriptions_email'), 'restock_subscriptions', ['email'], unique=False)
    op.create_index(op.f('ix_restock_subscriptions_product_id'), 'restock_subscriptions', ['product_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_restock_subscriptions_product_id'), table_name='restock_subscriptions')
    op.drop_index(op.f('ix_restock_subscriptions_email'), table_name='restock_subscriptions')
    op.drop_index(op.f('ix_restock_subscriptions_id'), table_name='restock_subscriptions')
    op.drop_table('restock_subscriptions')
