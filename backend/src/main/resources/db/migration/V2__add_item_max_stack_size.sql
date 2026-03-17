-- ===== item 테이블에 max_stack_size 컬럼 추가 =====
-- 아이템별 슬롯당 최대 보유 수량. 기존 데이터는 100으로 초기화.
ALTER TABLE item
    ADD COLUMN IF NOT EXISTS max_stack_size bigint NOT NULL DEFAULT 100;
