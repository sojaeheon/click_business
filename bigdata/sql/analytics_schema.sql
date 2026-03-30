-- 1) 회사 현금 상태
CREATE TABLE IF NOT EXISTS company_cash_state (
    company_id      BIGINT PRIMARY KEY,
    cash            BIGINT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) 아이템 최신 가격 상태
CREATE TABLE IF NOT EXISTS item_price_state (
    item_id         BIGINT PRIMARY KEY,
    last_price      BIGINT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) 회사별 아이템 수량 상태
CREATE TABLE IF NOT EXISTS company_item_qty_state (
    company_id      BIGINT NOT NULL,
    item_id         BIGINT NOT NULL,
    qty             BIGINT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, item_id)
);

-- 4) 회사 가치 상태(랭킹 계산 결과)
CREATE TABLE IF NOT EXISTS company_valuation (
    company_id       BIGINT PRIMARY KEY,
    cash             BIGINT NOT NULL,
    inventory_value  BIGINT NOT NULL,
    market_cap       BIGINT NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_valuation_market_cap
    ON company_valuation (market_cap DESC);
