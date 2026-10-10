"""migrate legacy lookbook to first colour group

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-09-04
"""
import json
from alembic import op
import sqlalchemy as sa

revision = 'q2r3s4t5u6v7'
down_revision = 'p1q2r3s4t5u6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # Use explicit table constructs with only the necessary columns to avoid querying future columns like 'category'
    products_table = sa.table(
        'products',
        sa.column('id', sa.Integer),
        sa.column('lookbook', sa.JSON)
    )
    colour_groups_table = sa.table(
        'product_colour_groups',
        sa.column('id', sa.Integer),
        sa.column('product_id', sa.Integer),
        sa.column('lookbook', sa.JSON),
        sa.column('display_order', sa.Integer)
    )

    rows = bind.execute(
        sa.select(products_table.c.id, products_table.c.lookbook)
    ).fetchall()

    for p_id, p_lookbook in rows:
        lb_data = p_lookbook
        if isinstance(lb_data, str):
            try:
                lb_data = json.loads(lb_data)
            except Exception:
                lb_data = []

        if lb_data and isinstance(lb_data, list) and len(lb_data) > 0:
            cgs = bind.execute(
                sa.select(colour_groups_table.c.id, colour_groups_table.c.lookbook)
                .where(colour_groups_table.c.product_id == p_id)
                .order_by(colour_groups_table.c.display_order.asc(), colour_groups_table.c.id.asc())
            ).fetchall()

            if cgs:
                def is_non_empty(val):
                    if isinstance(val, str):
                        try:
                            val = json.loads(val)
                        except Exception:
                            return False
                    return isinstance(val, list) and len(val) > 0

                has_group_lookbook = any(is_non_empty(cg[1]) for cg in cgs)
                if not has_group_lookbook:
                    first_cg_id = cgs[0][0]
                    bind.execute(
                        colour_groups_table.update()
                        .where(colour_groups_table.c.id == first_cg_id)
                        .values(lookbook=lb_data)
                    )
                bind.execute(
                    products_table.update()
                    .where(products_table.c.id == p_id)
                    .values(lookbook=[])
                )


def downgrade() -> None:
    pass

