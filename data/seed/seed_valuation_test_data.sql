-- Creates a small, idempotent data set for company-valuation verification.
-- It intentionally does not delete existing production-like data.

BEGIN;

WITH missing_companies AS MATERIALIZED (
    SELECT n, format('valuation-test-%s', lpad(n::text, 2, '0')) AS name
    FROM generate_series(1, 20) AS n
    WHERE NOT EXISTS (
        SELECT 1
        FROM company
        WHERE company.name = format('valuation-test-%s', lpad(n::text, 2, '0'))
    )
), inserted_users AS (
    INSERT INTO users (is_guest, created_at, updated_at)
    SELECT false, NOW(), NOW()
    FROM missing_companies
    RETURNING user_id
), numbered_users AS (
    SELECT user_id, row_number() OVER (ORDER BY user_id) AS row_num
    FROM inserted_users
), numbered_companies AS (
    SELECT n, name, row_number() OVER (ORDER BY n) AS row_num
    FROM missing_companies
)
INSERT INTO company (
    user_id, name, industry_id, input_item_id, output_item_id,
    level, cash, total_asset, minigame_paid, created_at, updated_at
)
SELECT
    numbered_users.user_id,
    numbered_companies.name,
    1,
    1,
    2,
    1,
    5000000 + (numbered_companies.n * 100000),
    5000000 + (numbered_companies.n * 100000),
    false,
    NOW(),
    NOW()
FROM numbered_companies
JOIN numbered_users ON numbered_users.row_num = numbered_companies.row_num;

INSERT INTO warehouse (company_id, max_slot)
SELECT company_id, 20
FROM company
WHERE name LIKE 'valuation-test-%'
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO warehouse_slot (warehouse_id, slot_index, item_id, quantity)
SELECT warehouse.warehouse_id, slot_index, NULL, 0
FROM warehouse
JOIN company ON company.company_id = warehouse.company_id
CROSS JOIN generate_series(0, 19) AS slot_index
WHERE company.name LIKE 'valuation-test-%'
ON CONFLICT (warehouse_id, slot_index) DO NOTHING;

UPDATE warehouse_slot AS slot
SET item_id = seeded.item_id,
    quantity = seeded.quantity
FROM (
    SELECT
        warehouse.warehouse_id,
        CASE slot.slot_index
            WHEN 0 THEN 1
            WHEN 1 THEN 2
            WHEN 2 THEN 3
        END AS item_id,
        CASE slot.slot_index
            WHEN 0 THEN 100 + ((company.company_id % 5) * 10)
            WHEN 1 THEN 50 + ((company.company_id % 4) * 10)
            WHEN 2 THEN 5 + (company.company_id % 3)
        END AS quantity,
        slot.slot_id
    FROM warehouse
    JOIN company ON company.company_id = warehouse.company_id
    JOIN warehouse_slot AS slot ON slot.warehouse_id = warehouse.warehouse_id
    WHERE company.name LIKE 'valuation-test-%'
      AND slot.slot_index IN (0, 1, 2)
) AS seeded
WHERE slot.slot_id = seeded.slot_id;

COMMIT;

SELECT
    count(DISTINCT company.company_id) AS seeded_companies,
    sum(DISTINCT company.cash) AS total_cash,
    count(warehouse_slot.slot_id) FILTER (
        WHERE warehouse_slot.item_id IS NOT NULL AND warehouse_slot.quantity > 0
    ) AS stocked_slots
FROM company
JOIN warehouse ON warehouse.company_id = company.company_id
JOIN warehouse_slot ON warehouse_slot.warehouse_id = warehouse.warehouse_id
WHERE company.name LIKE 'valuation-test-%';
