-- Spark 기업 가치 계산 상태와 최신 가치. 운영 PostgreSQL이 단일 조회 저장소다.

CREATE TABLE IF NOT EXISTS company_cash_state (
    company_id BIGINT PRIMARY KEY,
    cash BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_price_state (
    item_id BIGINT PRIMARY KEY,
    last_price BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_item_qty_state (
    company_id BIGINT NOT NULL,
    item_id BIGINT NOT NULL,
    qty BIGINT NOT NULL CHECK (qty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_company_item_qty_state_item
    ON company_item_qty_state (item_id, company_id);

CREATE TABLE IF NOT EXISTS company_valuation (
    company_id BIGINT PRIMARY KEY,
    cash BIGINT NOT NULL,
    inventory_value BIGINT NOT NULL,
    market_cap BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_valuation_ranking
    ON company_valuation (market_cap DESC, company_id ASC);

-- Kafka는 적어도 한 번 전달될 수 있으므로 재시도 시 재고가 중복 합산되지 않게 한다.
CREATE TABLE IF NOT EXISTS valuation_processed_event (
    event_id VARCHAR(255) PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
