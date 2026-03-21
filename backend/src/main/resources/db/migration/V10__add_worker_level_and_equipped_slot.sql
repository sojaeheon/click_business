-- V10: 일꾼 레벨 및 장착 슬롯 컬럼 추가

-- item 테이블에 worker_level 추가 (일꾼 아이템만 사용, 나머지는 NULL)
ALTER TABLE item ADD COLUMN worker_level INT;

-- workstation 테이블에 장착된 일꾼의 인벤토리 슬롯 인덱스 추가 (NULL = 미장착)
ALTER TABLE workstation ADD COLUMN equipped_worker_slot_index INT;
