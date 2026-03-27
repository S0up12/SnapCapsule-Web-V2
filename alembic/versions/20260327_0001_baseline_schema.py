"""Baseline schema.

Revision ID: 20260327_0001
Revises:
Create Date: 2026-03-27 11:30:00
"""

from __future__ import annotations

from snapcapsule_core.models import Base

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260327_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
