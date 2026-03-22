CREATE TABLE IF NOT EXISTS external_news (
    external_news_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(500),
    content TEXT,
    source VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    original_url VARCHAR(1000) NOT NULL UNIQUE,
    published_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_external_news_published_at
    ON external_news(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_news_source
    ON external_news(source);

CREATE TABLE IF NOT EXISTS internal_news (
    internal_news_id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL,
    signal_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    severity_score DOUBLE PRECISION NOT NULL,
    reference_time TIMESTAMP NOT NULL,
    published_at TIMESTAMP NOT NULL,
    dedupe_key VARCHAR(255) NOT NULL UNIQUE,
    llm_model VARCHAR(100),
    source_metrics_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_internal_news_item FOREIGN KEY (item_id) REFERENCES item(item_id)
);

CREATE INDEX IF NOT EXISTS idx_internal_news_published_at
    ON internal_news(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_news_item_signal_published_at
    ON internal_news(item_id, signal_type, published_at DESC);
