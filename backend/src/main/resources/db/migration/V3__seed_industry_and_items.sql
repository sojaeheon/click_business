-- ===== 아이템 초기 데이터 =====
-- 순환 경제 구조: 금광석 → 금괴 → 금 드릴 → 금광석 (반복)
INSERT INTO item (item_id, name, type, description, max_stack_size) VALUES
    (1, '금광석', 'MATERIAL',   '채굴한 금 원석. 제련하면 금괴가 된다.',          100),
    (2, '금괴',   'PRODUCT',    '순도 높은 금괴. 드릴 제조에 사용된다.',          50),
    (3, '금 드릴', 'EQUIPMENT', '금을 채굴하는 데 사용되는 드릴. 소모품.',        10);

-- ===== 산업군 초기 데이터 =====
INSERT INTO industry (industry_id, name) VALUES
    (1, '금광업'),
    (2, '금 제련업'),
    (3, '제조업');

-- ===== 산업-아이템 관계 (BUY: 구매, SELL: 판매) =====
-- 금광업(1):   금 드릴 소모 → 금광석 생산
INSERT INTO industry_item_relation (industry_id, item_id, trade_type) VALUES
    (1, 3, 'BUY'),   -- 금광업은 금 드릴을 구매(소모)
    (1, 1, 'SELL'),  -- 금광업은 금광석을 판매
-- 금 제련업(2): 금광석 구매 → 금괴 생산
    (2, 1, 'BUY'),   -- 금 제련업은 금광석을 구매
    (2, 2, 'SELL'),  -- 금 제련업은 금괴를 판매
-- 제조업(3):   금괴 구매 → 금 드릴 생산
    (3, 2, 'BUY'),   -- 제조업은 금괴를 구매
    (3, 3, 'SELL');  -- 제조업은 금 드릴을 판매
