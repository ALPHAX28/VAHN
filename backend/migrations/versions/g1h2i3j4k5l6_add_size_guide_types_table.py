"""add size_guide_types table with seeded defaults

Revision ID: g1h2i3j4k5l6
Revises: 3f6a89c1d2e4
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'g1h2i3j4k5l6'
down_revision = '3f6a89c1d2e4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'size_guide_types',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('unit_label', sa.String(), nullable=True),
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('diagram_image_url', sa.String(), nullable=True),
        sa.Column('columns', sa.JSON(), nullable=True),
        sa.Column('rows', sa.JSON(), nullable=True),
        sa.Column('measuring_tips', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    now = datetime.utcnow()
    op.bulk_insert(
        sa.table(
            'size_guide_types',
            sa.column('name', sa.String),
            sa.column('unit_label', sa.String),
            sa.column('is_visible', sa.Boolean),
            sa.column('display_order', sa.Integer),
            sa.column('diagram_image_url', sa.String),
            sa.column('columns', sa.JSON),
            sa.column('rows', sa.JSON),
            sa.column('measuring_tips', sa.JSON),
            sa.column('created_at', sa.DateTime),
            sa.column('updated_at', sa.DateTime),
        ),
        [
            {
                'name': 'METRIC (CM)',
                'unit_label': 'cm',
                'is_visible': True,
                'display_order': 0,
                'diagram_image_url': None,
                'columns': ['Size', 'A: Chest', 'B: Length', 'C: Sleeve'],
                'rows': [
                    {'Size': 'S',  'A: Chest': '102 cm', 'B: Length': '68 cm', 'C: Sleeve': '22 cm'},
                    {'Size': 'M',  'A: Chest': '108 cm', 'B: Length': '70 cm', 'C: Sleeve': '23 cm'},
                    {'Size': 'L',  'A: Chest': '114 cm', 'B: Length': '72 cm', 'C: Sleeve': '24 cm'},
                    {'Size': 'XL', 'A: Chest': '120 cm', 'B: Length': '74 cm', 'C: Sleeve': '25 cm'},
                ],
                'measuring_tips': [
                    {'title': 'Chest',  'description': 'Measure around the fullest part of your chest, keeping the tape horizontal.'},
                    {'title': 'Length', 'description': 'Measure from the highest point of the shoulder down to the hem.'},
                    {'title': 'Sleeve', 'description': 'Measure from the neck collar point along the shoulder line down to the sleeve hem.'},
                ],
                'created_at': now,
                'updated_at': now,
            },
            {
                'name': 'IMPERIAL (IN)',
                'unit_label': 'in',
                'is_visible': True,
                'display_order': 1,
                'diagram_image_url': None,
                'columns': ['Size', 'A: Chest', 'B: Length', 'C: Sleeve'],
                'rows': [
                    {'Size': 'S',  'A: Chest': '40.2 in', 'B: Length': '26.8 in', 'C: Sleeve': '8.7 in'},
                    {'Size': 'M',  'A: Chest': '42.5 in', 'B: Length': '27.6 in', 'C: Sleeve': '9.1 in'},
                    {'Size': 'L',  'A: Chest': '44.9 in', 'B: Length': '28.3 in', 'C: Sleeve': '9.4 in'},
                    {'Size': 'XL', 'A: Chest': '47.2 in', 'B: Length': '29.1 in', 'C: Sleeve': '9.8 in'},
                ],
                'measuring_tips': [
                    {'title': 'Chest',  'description': 'Measure around the fullest part of your chest, keeping the tape horizontal.'},
                    {'title': 'Length', 'description': 'Measure from the highest point of the shoulder down to the hem.'},
                    {'title': 'Sleeve', 'description': 'Measure from the neck collar point along the shoulder line down to the sleeve hem.'},
                ],
                'created_at': now,
                'updated_at': now,
            },
        ]
    )


def downgrade():
    op.drop_table('size_guide_types')
