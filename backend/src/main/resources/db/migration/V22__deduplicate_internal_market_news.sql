-- Keep game time for publication ordering, but track generation and signal
-- identity separately so an accelerated game clock cannot bypass cooldowns.
ALTER TABLE internal_news
    ADD COLUMN IF NOT EXISTS item_id BIGINT,
    ADD COLUMN IF NOT EXISTS signal_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(160);

ALTER TABLE internal_news
    ADD CONSTRAINT fk_internal_news_item
    FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE SET NULL;

ALTER TABLE internal_news
    ADD CONSTRAINT uq_internal_news_dedupe_key UNIQUE (dedupe_key);

CREATE INDEX IF NOT EXISTS idx_internal_news_created_at
    ON internal_news(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_news_signal_created
    ON internal_news(item_id, signal_type, created_at DESC);

CREATE TABLE IF NOT EXISTS market_news_signal_state (
    item_id BIGINT NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,
    signal_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    activation_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cleared_at TIMESTAMP,
    last_published_at TIMESTAMP,
    last_severity DOUBLE PRECISION NOT NULL DEFAULT 0,
    PRIMARY KEY (item_id, signal_type)
);

-- Existing rows used game time for created_at. Keep only the latest row for
-- each repeated headline, then mark the retained rows as migrated now so the
-- first post-migration batch does not immediately republish the same alert.
WITH ranked AS (
    SELECT
        internal_news_id,
        ROW_NUMBER() OVER (
            PARTITION BY title
            ORDER BY published_at DESC, internal_news_id DESC
        ) AS duplicate_rank
    FROM internal_news
)
DELETE FROM internal_news news
USING ranked
WHERE news.internal_news_id = ranked.internal_news_id
  AND ranked.duplicate_rank > 1;

UPDATE internal_news
SET created_at = CURRENT_TIMESTAMP;
