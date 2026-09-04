"""migrate legacy lookbook to first colour group

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
import models

revision = 'q2r3s4t5u6v7'
down_revision = 'p1q2r3s4t5u6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        products = session.query(models.Product).all()
        for p in products:
            if p.lookbook and isinstance(p.lookbook, list) and len(p.lookbook) > 0:
                cgs = session.query(models.ProductColourGroup).filter_by(product_id=p.id).order_by(
                    models.ProductColourGroup.display_order.asc(),
                    models.ProductColourGroup.id.asc()
                ).all()
                if cgs:
                    has_group_lookbook = any(cg.lookbook and len(cg.lookbook) > 0 for cg in cgs)
                    if not has_group_lookbook:
                        # Move legacy lookbook items to the product's first colour group
                        first_cg = cgs[0]
                        first_cg.lookbook = p.lookbook
                        p.lookbook = []
                        session.commit()
                    else:
                        # Colour groups already have their own lookbooks, clean up legacy product lookbook
                        p.lookbook = []
                        session.commit()
    finally:
        session.close()


def downgrade() -> None:
    pass
