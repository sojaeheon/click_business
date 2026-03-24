ALTER TABLE trade_history
ADD COLUMN IF NOT EXISTS item_id int;

UPDATE trade_history th
SET item_id = mo.item_id
FROM market_order mo
WHERE mo.market_order_id = th.market_order_id
  AND th.item_id IS NULL;
