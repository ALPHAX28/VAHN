"""set default warehouse to home

Revision ID: v7w8x9y0z1a2
Revises: u6v7w8x9y0z1
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = 'v7w8x9y0z1a2'
down_revision = 'u6v7w8x9y0z1'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Deactivate 'Primary' warehouse from being primary
    op.execute(
        sa.text("UPDATE warehouse_locations SET is_primary = false WHERE pickup_location = 'Primary'")
    )

    # 2. Insert or update 'Home' warehouse with active phone-verified details
    op.execute(
        sa.text("""
            INSERT INTO warehouse_locations (
                pickup_location, name, email, phone, address, address_2, city, state, country, pin_code, is_primary, shiprocket_pickup_id, created_at, updated_at
            ) VALUES (
                'Home', 'Abhinandan Mitra', 'abhinandan.mitra@vahnsports.com', '8013340567',
                '1931/19a, Vishwakarma Mandir Marg, Govindpuri Extension, Kalkaji', 'Near Vishwakarma mandir',
                'Delhi', 'Delhi', 'India', '110019', true, '110332741', now(), now()
            )
            ON CONFLICT (pickup_location) DO UPDATE SET
                is_primary = true,
                phone = '8013340567',
                name = 'Abhinandan Mitra',
                email = 'abhinandan.mitra@vahnsports.com',
                pin_code = '110019',
                updated_at = now()
        """)
    )

def downgrade() -> None:
    op.execute(
        sa.text("UPDATE warehouse_locations SET is_primary = true WHERE pickup_location = 'Primary'")
    )
    op.execute(
        sa.text("UPDATE warehouse_locations SET is_primary = false WHERE pickup_location = 'Home'")
    )
