-- 마켓 캔들 테이블에 타입(1분봉/5분봉) 컬럼 추가
ALTER TABLE market_candle ADD COLUMN IF NOT EXISTS candle_type VARCHAR(10) DEFAULT 'MIN_5';

-- 기존 유니크 제약 조건 삭제 및 (item_id, candle_time, candle_type) 복합 제약 조건 추가
ALTER TABLE market_candle DROP CONSTRAINT IF EXISTS uk_candle;
ALTER TABLE market_candle ADD CONSTRAINT uk_candle_item_time_type UNIQUE (item_id, candle_time, candle_type);
