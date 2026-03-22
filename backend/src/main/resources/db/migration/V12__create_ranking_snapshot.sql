CREATE TABLE IF NOT EXISTS ranking_current (
    rank_id            BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL,
    valuation          BIGINT NOT NULL,
    ranking_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ranking_current_company
        FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,

    CONSTRAINT uq_ranking_current_company UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_current_order
    ON ranking_current (valuation DESC, company_id ASC);

CREATE INDEX IF NOT EXISTS idx_ranking_current_updated_at
    ON ranking_current (ranking_updated_at DESC);
