"""add razorpay and shiprocket to orders

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = 's4t5u6v7w8x9'
down_revision = 'r3s4t5u6v7w8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Make user_id nullable for guest checkout
    op.alter_column('orders', 'user_id', nullable=True)

    # 2. Guest identification
    op.add_column('orders', sa.Column('is_guest', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('orders', sa.Column('guest_name', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('guest_email', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('guest_phone', sa.String(), nullable=True))

    # 3. Refund & Cancellation
    op.add_column('orders', sa.Column('refund_amount', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('orders', sa.Column('refunded_at', sa.DateTime(), nullable=True))
    op.add_column('orders', sa.Column('cancellation_reason', sa.Text(), nullable=True))

    # 4. Razorpay Prepaid Payment tracking
    op.add_column('orders', sa.Column('payment_method', sa.String(), nullable=False, server_default='ONLINE'))
    op.add_column('orders', sa.Column('payment_status', sa.String(), nullable=False, server_default='PENDING'))
    op.add_column('orders', sa.Column('razorpay_order_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_orders_razorpay_order_id'), 'orders', ['razorpay_order_id'], unique=False)
    op.add_column('orders', sa.Column('razorpay_payment_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_orders_razorpay_payment_id'), 'orders', ['razorpay_payment_id'], unique=False)
    op.add_column('orders', sa.Column('razorpay_signature', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('razorpay_refund_id', sa.String(), nullable=True))

    # 5. Shiprocket Forward Logistics & Live Tracking
    op.add_column('orders', sa.Column('shiprocket_order_id', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('shiprocket_shipment_id', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('shiprocket_awb', sa.String(), nullable=True))
    op.create_index(op.f('ix_orders_shiprocket_awb'), 'orders', ['shiprocket_awb'], unique=False)
    op.add_column('orders', sa.Column('shiprocket_courier_name', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('shipping_status', sa.String(), nullable=False, server_default='UNFULFILLED'))
    op.add_column('orders', sa.Column('tracking_url', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('tracking_data', sa.JSON(), nullable=True, server_default='{}'))
    op.add_column('orders', sa.Column('delivered_at', sa.DateTime(), nullable=True))

    # 6. 7-Day Returns & Reverse Logistics
    op.add_column('orders', sa.Column('return_status', sa.String(), nullable=False, server_default='NONE'))
    op.add_column('orders', sa.Column('return_reason', sa.Text(), nullable=True))
    op.add_column('orders', sa.Column('return_notes', sa.Text(), nullable=True))
    op.add_column('orders', sa.Column('return_requested_at', sa.DateTime(), nullable=True))
    op.add_column('orders', sa.Column('reverse_shipment_id', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('reverse_awb', sa.String(), nullable=True))
    op.create_index(op.f('ix_orders_reverse_awb'), 'orders', ['reverse_awb'], unique=False)
    op.add_column('orders', sa.Column('reverse_courier_name', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('reverse_tracking_data', sa.JSON(), nullable=True, server_default='{}'))


def downgrade() -> None:
    op.drop_index(op.f('ix_orders_reverse_awb'), table_name='orders')
    op.drop_column('orders', 'reverse_tracking_data')
    op.drop_column('orders', 'reverse_courier_name')
    op.drop_column('orders', 'reverse_awb')
    op.drop_column('orders', 'reverse_shipment_id')
    op.drop_column('orders', 'return_requested_at')
    op.drop_column('orders', 'return_notes')
    op.drop_column('orders', 'return_reason')
    op.drop_column('orders', 'return_status')

    op.drop_column('orders', 'delivered_at')
    op.drop_column('orders', 'tracking_data')
    op.drop_column('orders', 'tracking_url')
    op.drop_column('orders', 'shipping_status')
    op.drop_column('orders', 'shiprocket_courier_name')
    op.drop_index(op.f('ix_orders_shiprocket_awb'), table_name='orders')
    op.drop_column('orders', 'shiprocket_awb')
    op.drop_column('orders', 'shiprocket_shipment_id')
    op.drop_column('orders', 'shiprocket_order_id')

    op.drop_column('orders', 'razorpay_refund_id')
    op.drop_column('orders', 'razorpay_signature')
    op.drop_index(op.f('ix_orders_razorpay_payment_id'), table_name='orders')
    op.drop_column('orders', 'razorpay_payment_id')
    op.drop_index(op.f('ix_orders_razorpay_order_id'), table_name='orders')
    op.drop_column('orders', 'razorpay_order_id')
    op.drop_column('orders', 'payment_status')
    op.drop_column('orders', 'payment_method')

    op.drop_column('orders', 'cancellation_reason')
    op.drop_column('orders', 'refunded_at')
    op.drop_column('orders', 'refund_amount')

    op.drop_column('orders', 'guest_phone')
    op.drop_column('orders', 'guest_email')
    op.drop_column('orders', 'guest_name')
    op.drop_column('orders', 'is_guest')

    op.alter_column('orders', 'user_id', nullable=False)
