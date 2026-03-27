"""Migrate asset tags to JSONB and backfill performance indexes.

Revision ID: 20260327_0002
Revises: 20260327_0001
Create Date: 2026-03-27 13:25:00
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260327_0002"
down_revision = "20260327_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'assets'
                  AND column_name = 'tags'
                  AND data_type = 'json'
            ) THEN
                ALTER TABLE assets
                ALTER COLUMN tags TYPE jsonb
                USING tags::jsonb;
            END IF;
        END
        $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_assets_tags_gin ON assets USING gin (tags)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_assets_source_type_media_type_taken_at ON assets (source_type, media_type, taken_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_sent_at ON chat_messages (sent_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_memory_items_asset_taken_at_position ON memory_items (asset_id, taken_at, position)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_story_items_collection_position ON story_items (collection_id, position)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_story_items_collection_position")
    op.execute("DROP INDEX IF EXISTS ix_memory_items_asset_taken_at_position")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_sent_at")
    op.execute("DROP INDEX IF EXISTS ix_assets_source_type_media_type_taken_at")
    op.execute("DROP INDEX IF EXISTS ix_assets_tags_gin")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'assets'
                  AND column_name = 'tags'
                  AND data_type = 'jsonb'
            ) THEN
                ALTER TABLE assets
                ALTER COLUMN tags TYPE json
                USING tags::json;
            END IF;
        END
        $$;
        """
    )
