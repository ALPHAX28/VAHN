"""
Alembic migration: Add phone/phone_verified to users, drop otp_code/otp_expires_at, make email/password nullable.

Revision ID: j4k5l6m7n8o9
Revises: h2i3j4k5l6m7
Create Date: 2026-08-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'j4k5l6m7n8o9'
down_revision = 'h2i3j4k5l6m7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new columns (nullable to avoid breaking existing rows)
    op.add_column('users', sa.Column('phone', sa.String(), nullable=True))
    op.add_column('users', sa.Column('phone_verified', sa.Boolean(), nullable=False, server_default='false'))

    # 2. Remove OTP columns (OTP now handled by HMAC stateless tokens — never stored)
    op.drop_column('users', 'otp_code')
    op.drop_column('users', 'otp_expires_at')

    # 3. Make email nullable (phone is now the primary identifier)
    op.alter_column('users', 'email', existing_type=sa.String(), nullable=True)

    # 4. Make password_hash and salt nullable (OTP-only users have no password)
    op.alter_column('users', 'password_hash', existing_type=sa.String(), nullable=True)
    op.alter_column('users', 'salt', existing_type=sa.String(), nullable=True)

    # 5. Set is_verified = True for all existing users (migrating to always-verified phone flow)
    op.execute("UPDATE users SET is_verified = TRUE")

    # 6. Create unique index on phone
    op.create_index('ix_users_phone', 'users', ['phone'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_phone', table_name='users')
    op.drop_column('users', 'phone_verified')
    op.drop_column('users', 'phone')

    op.add_column('users', sa.Column('otp_code', sa.String(), nullable=True))
    op.add_column('users', sa.Column('otp_expires_at', sa.DateTime(), nullable=True))

    # Restore non-nullable constraints (best effort — may fail if nulls exist)
    op.alter_column('users', 'email', existing_type=sa.String(), nullable=False)
    op.alter_column('users', 'password_hash', existing_type=sa.String(), nullable=False)
    op.alter_column('users', 'salt', existing_type=sa.String(), nullable=False)
