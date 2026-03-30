-- 5분봉 차트 데이터 테이블 생성
CREATE TABLE IF NOT EXISTS market_candle (
    candle_id BIGSERIAL PRIMARY KEY,
    item_id INT NOT NULL,
    open_price BIGINT NOT NULL,
    high_price BIGINT NOT NULL,
    low_price BIGINT NOT NULL,
    close_price BIGINT NOT NULL,
    volume BIGINT NOT NULL,
    candle_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uk_candle UNIQUE(item_id, candle_time)
);

-- 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_candle_item_time ON market_candle(item_id, candle_time DESC);