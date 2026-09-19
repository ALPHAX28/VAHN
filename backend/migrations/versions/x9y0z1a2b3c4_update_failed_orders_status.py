"""update failed orders status to FAILED

Revision ID: x9y0z1a2b3c4
Revises: w8x9y0z1a2b3
Create Date: 2026-09-19
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'x9y0z1a2b3c4'
down_revision = 'w8x9y0z1a2b3'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Update all orders where payment_status is FAILED (and not CANCELLED) to have status = 'FAILED'
    op.execute(
        sa.text("UPDATE orders SET status = 'FAILED' WHERE payment_status = 'FAILED' AND status != 'CANCELLED'")
    )

def downgrade() -> None:
    # Rollback can revert FAILED status back to PENDING_PAYMENT if needed
    op.execute(
        sa.text("UPDATE orders SET status = 'PENDING_PAYMENT' WHERE status = 'FAILED' AND payment_status = 'FAILED'")
    )
