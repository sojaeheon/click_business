-- 금괴, 금 드릴을 MATERIAL 타입으로 통일
-- 이유: 순환 경제에서 같은 아이템이 회사 타입에 따라 input/output 역할이 달라지므로
--       아이템 자체의 타입으로 MATERIAL/PRODUCT를 구분하지 않음.
--       MATERIAL/PRODUCT 구분은 company.input_item_id / output_item_id 기준으로 런타임에 결정.
UPDATE item SET type = 'MATERIAL' WHERE name = '금괴';
UPDATE item SET type = 'MATERIAL' WHERE name = '금 드릴';
