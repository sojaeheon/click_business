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

-- 5) 회사별 재고 가치 상태
CREATE TABLE IF NOT EXISTS company_inventory_value_state (
    company_id        BIGINT PRIMARY KEY,
    inventory_value   BIGINT NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6) 랭킹 반영 아웃박스
-- 같은 회사는 최신 값만 유지
CREATE TABLE IF NOT EXISTS ranking_outbox (
    company_id        BIGINT PRIMARY KEY,
    market_cap        BIGINT NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at         TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ranking_outbox_unsynced
    ON ranking_outbox (synced_at, updated_at);

-- 7) foreachBatch 재시도 중복 반영 방지용 체크포인트
CREATE TABLE IF NOT EXISTS stream_batch_checkpoint (
    stream_name       TEXT NOT NULL,
    batch_id          BIGINT NOT NULL,
    processed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (stream_name, batch_id)
);

-- 8) 가격 변경 시 item_id로 회사 수량 상태를 자주 조인하므로 보조 인덱스
CREATE INDEX IF NOT EXISTS idx_company_item_qty_state_item_id
    ON company_item_qty_state (item_id);

-- 9) inventory 상태/valuation 조회 보조 인덱스 (선택)
CREATE INDEX IF NOT EXISTS idx_company_inventory_value_state_updated_at
    ON company_inventory_value_state (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_cash_state_updated_at
    ON company_cash_state (updated_at DESC);