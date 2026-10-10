-- Extends the valuation verification data set from 20 to 100 companies.
-- Safe to run repeatedly; it only creates missing companies and warehouse rows.

BEGIN;

WITH missing_companies AS MATERIALIZED (
    SELECT n,
           CASE WHEN n = 100 THEN 'valuation-test-100'
                ELSE format('valuation-test-%s', lpad(n::text, 2, '0')) END AS name
    FROM generate_series(21, 100) AS n
    WHERE NOT EXISTS (
        SELECT 1 FROM company
        WHERE company.name = CASE WHEN n = 100 THEN 'valuation-test-100'
                                  ELSE format('valuation-test-%s', lpad(n::text, 2, '0')) END
    )
), inserted_users AS (
    INSERT INTO users (is_guest, created_at, updated_at)
    SELECT false, NOW(), NOW() FROM missing_companies
    RETURNING user_id
), numbered_users AS (
    SELECT user_id, row_number() OVER (ORDER BY user_id) AS row_num FROM inserted_users
), numbered_companies AS (
    SELECT n, name, row_number() OVER (ORDER BY n) AS row_num FROM missing_companies
)
INSERT INTO company (
    user_id, name, industry_id, input_item_id, output_item_id,
    level, cash, total_asset, minigame_paid, created_at, updated_at
)
SELECT
    numbered_users.user_id, numbered_companies.name, 1, 1, 2, 1,
    5000000 + (numbered_companies.n * 100000),
    5000000 + (numbered_companies.n * 100000), false, NOW(), NOW()
FROM numbered_companies
JOIN numbered_users ON numbered_users.row_num = numbered_companies.row_num;

INSERT INTO warehouse (company_id, max_slot)
SELECT company_id, 20 FROM company
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
SET item_id = seeded.item_id, quantity = seeded.quantity
FROM (
    SELECT warehouse.warehouse_id,
           CASE slot.slot_index WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3 END AS item_id,
           CASE slot.slot_index
               WHEN 0 THEN 100 + ((company.company_id % 5) * 10)
               WHEN 1 THEN 50 + ((company.company_id % 4) * 10)
               WHEN 2 THEN 5 + (company.company_id % 3)
           END AS quantity,
           slot.slot_id
    FROM warehouse
    JOIN company ON company.company_id = warehouse.company_id
    JOIN warehouse_slot AS slot ON slot.warehouse_id = warehouse.warehouse_id
    WHERE company.name LIKE 'valuation-test-%' AND slot.slot_index IN (0, 1, 2)
) AS seeded
WHERE slot.slot_id = seeded.slot_id;

COMMIT;

SELECT count(DISTINCT company.company_id) AS seeded_companies
FROM company
WHERE company.name LIKE 'valuation-test-%';
