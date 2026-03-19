-- company 테이블에 input_item_id, output_item_id 컬럼 추가
-- JPA Entity의 @Column(name = "input_item_id"), @Column(name = "output_item_id") 와 매핑
ALTER TABLE company
    ADD COLUMN IF NOT EXISTS input_item_id  bigint,
    ADD COLUMN IF NOT EXISTS output_item_id bigint;
