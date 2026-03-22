-- V14: inventory_slot 테이블에 equipped 컬럼 추가 및 인덱스 생성

ALTER TABLE inventory_slot ADD COLUMN equipped BOOLEAN DEFAULT FALSE NOT NULL;

-- 장착 상태 조회를 위한 인덱스 추가
CREATE INDEX idx_inventory_slot_equipped ON inventory_slot(equipped);
