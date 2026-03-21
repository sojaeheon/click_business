-- 외부 시장 지수(금, 금괴, 금드릴 등) 히스토리 테이블 생성
CREATE TABLE external_index (
    external_index_id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL,
    price_date DATE NOT NULL,
    open_price BIGINT NOT NULL,
    close_price BIGINT NOT NULL,
    high_price BIGINT NOT NULL,
    low_price BIGINT NOT NULL,
    fluct_rate DECIMAL(5,2),
    volume BIGINT,
    transaction_amount BIGINT,
    open_high_fluct_rate DECIMAL(5,2),
    open_low_fluct_rate DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_external_index_item FOREIGN KEY (item_id) REFERENCES item(item_id),
    CONSTRAINT uk_external_index_item_date UNIQUE (item_id, price_date)
);

-- 인덱스 생성 (조회 최적화)
CREATE INDEX idx_external_index_item_date ON external_index(item_id, price_date);
