"""remove dummy primary warehouse and enforce single primary

Revision ID: w8x9y0z1a2b3
Revises: v7w8x9y0z1a2
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'w8x9y0z1a2b3'
down_revision = 'v7w8x9y0z1a2'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Permanently delete the dummy/unverified 'Primary' warehouse
    op.execute(
        sa.text("DELETE FROM warehouse_locations WHERE pickup_location = 'Primary' OR phone = '9876543210' OR pin_code = '110016'")
    )

    # 2. Ensure all warehouses have is_primary = false first
    op.execute(
        sa.text("UPDATE warehouse_locations SET is_primary = false")
    )

    # 3. Set the single valid warehouse ('Home') as the primary hub
    op.execute(
        sa.text("""
            UPDATE warehouse_locations
            SET is_primary = true
            WHERE id = (
                SELECT id FROM warehouse_locations
                ORDER BY (pickup_location = 'Home') DESC, created_at ASC
                LIMIT 1
            )
        """)
    )

def downgrade() -> None:
    pass
