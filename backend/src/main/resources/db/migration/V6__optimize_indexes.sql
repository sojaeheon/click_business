-- ===== market_order 성능 최적화 인덱스 =====
CREATE INDEX IF NOT EXISTS idx_market_order_item_id ON market_order(item_id);
CREATE INDEX IF NOT EXISTS idx_market_order_company_id ON market_order(company_id);
CREATE INDEX IF NOT EXISTS idx_market_order_status ON market_order(status);

-- ===== notifications 테이블 보완 (V5에서 누락된 경우 대비) =====
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
