-- V13: Create internal_news and external_news tables

CREATE TABLE IF NOT EXISTS internal_news (
    internal_news_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_news (
    external_news_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient filtering and sorting
CREATE INDEX idx_internal_news_published_at ON internal_news(published_at DESC);
CREATE INDEX idx_external_news_published_at ON external_news(published_at DESC);
