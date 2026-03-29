import os
import time
from typing import List, Dict, Optional

import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import execute_values
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import (
    col,
    from_json,
    to_timestamp,
    coalesce,
    lit,
    current_timestamp,
    sum as spark_sum,
    max as spark_max,
)
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, MapType

# -----------------------------
# Spark 세션
# -----------------------------
spark = (
    SparkSession.builder
    .appName("CompanyValuationStream-Step4-StateAndValuation")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")

# -----------------------------
# DB 설정 (환경변수)
# -----------------------------
AN_DB_CONFIG = dict(
    host     = os.getenv("ANALYTICS_DB_HOST", "analytics-postgres"),
    port     = int(os.getenv("ANALYTICS_DB_PORT", "5432")),
    dbname   = os.getenv("ANALYTICS_DB_NAME", "ecosim_analytics"),
    user     = os.getenv("ANALYTICS_DB_USER", "ecosim"),
    password = os.getenv("ANALYTICS_DB_PASSWORD", "ecosim"),
)

OP_DB_CONFIG = dict(
    host     = os.getenv("OP_DB_HOST", "postgres-db"),
    port     = int(os.getenv("OP_DB_PORT", "5432")),
    dbname   = os.getenv("OP_DB_NAME", "ecosim"),
    user     = os.getenv("OP_DB_USER", "ecosim"),
    password = os.getenv("OP_DB_PASSWORD", "ecosim"),
)

POOL_MIN         = int(os.getenv("DB_POOL_MIN", "2"))
POOL_MAX         = int(os.getenv("DB_POOL_MAX", "10"))
TRIGGER_INTERVAL = os.getenv("TRIGGER_INTERVAL_SECONDS", "5 seconds")
# 쿼리 시작 시점 분산 간격 (초) — 3개 쿼리가 동시에 배치를 안 터뜨리게
QUERY_START_OFFSET = int(os.getenv("QUERY_START_OFFSET_SECONDS", "1"))
KAFKA_BOOTSTRAP  = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPICS     = os.getenv(
    "KAFKA_TOPICS_STREAM",
    "company.events,warehouse.events,market.trade.events",
)

# -----------------------------
# 커넥션 풀 (Lazy 초기화)
# → 매 배치마다 커넥션을 새로 만들지 않음
# -----------------------------
_an_pool: Optional[ThreadedConnectionPool] = None
_op_pool: Optional[ThreadedConnectionPool] = None


def get_an_pool() -> ThreadedConnectionPool:
    global _an_pool
    if _an_pool is None:
        _an_pool = ThreadedConnectionPool(POOL_MIN, POOL_MAX, **AN_DB_CONFIG)
    return _an_pool


def get_op_pool() -> ThreadedConnectionPool:
    global _op_pool
    if _op_pool is None:
        _op_pool = ThreadedConnectionPool(POOL_MIN, POOL_MAX, **OP_DB_CONFIG)
    return _op_pool


# -----------------------------
# Envelope 스키마
# -----------------------------
envelope_schema = StructType([
    StructField("event_id",      StringType(),                       True),
    StructField("event_type",    StringType(),                       True),
    StructField("event_version", IntegerType(),                      True),
    StructField("occurred_at",   StringType(),                       True),
    StructField("producer",      StringType(),                       True),
    StructField("partition_key", StringType(),                       True),
    StructField("aggregate_id",  StringType(),                       True),
    StructField("payload",       MapType(StringType(), StringType()), True),
])

# -----------------------------
# Kafka Source
# -----------------------------
raw = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
    .option("subscribe", KAFKA_TOPICS)
    .option("startingOffsets", "latest")
    .load()
)

base = (
    raw.selectExpr(
        "CAST(value AS STRING) AS raw_json",
        "timestamp AS kafka_timestamp",
    )
    .withColumn("e", from_json(col("raw_json"), envelope_schema))
    .select(
        col("e.event_type").alias("event_type"),
        col("e.occurred_at").alias("occurred_at"),
        col("e.partition_key").alias("partition_key"),
        col("e.aggregate_id").alias("aggregate_id"),
        col("e.payload").alias("payload"),
        col("kafka_timestamp"),
    )
)

# -----------------------------
# 스트림 분기: company.cash.changed
# -----------------------------
cash_events = (
    base.filter(col("event_type") == "company.cash.changed")
    .select(
        coalesce(
            col("payload").getItem("company_id"),
            col("partition_key"),
            col("aggregate_id"),
        ).cast("bigint").alias("company_id"),
        col("payload").getItem("cash").cast("bigint").alias("cash"),
        to_timestamp(
            coalesce(col("payload").getItem("changed_at"), col("occurred_at"))
        ).alias("updated_at"),
    )
    .filter(col("company_id").isNotNull() & col("cash").isNotNull())
)

# -----------------------------
# 스트림 분기: warehouse.item.*
# -----------------------------
warehouse_events = (
    base.filter(col("event_type").isin("warehouse.item.stored", "warehouse.item.removed"))
    .select(
        col("event_type"),
        col("payload").getItem("company_id").cast("bigint").alias("company_id"),
        col("payload").getItem("item_id").cast("bigint").alias("item_id"),
        col("payload").getItem("quantity_delta").cast("bigint").alias("raw_qty_delta"),
        to_timestamp(
            coalesce(
                col("payload").getItem("stored_at"),
                col("payload").getItem("removed_at"),
                col("occurred_at"),
            )
        ).alias("updated_at"),
    )
    .filter(
        col("company_id").isNotNull()
        & col("item_id").isNotNull()
        & col("raw_qty_delta").isNotNull()
    )
    .withColumn(
        "qty_delta",
        col("raw_qty_delta") * (
            (col("event_type") == "warehouse.item.removed").cast("int") * lit(-2) + lit(1)
        ),
    )
    .select("company_id", "item_id", "qty_delta", "updated_at")
)

# -----------------------------
# 스트림 분기: market.trade.executed
# -----------------------------
trade_events = (
    base.filter(col("event_type") == "market.trade.executed")
    .select(
        col("payload").getItem("item_id").cast("bigint").alias("item_id"),
        coalesce(
            col("payload").getItem("matched_price"),
            col("payload").getItem("price"),
        ).cast("bigint").alias("last_price"),
        coalesce(
            to_timestamp(col("payload").getItem("executed_at")),
            col("kafka_timestamp").cast("timestamp"),
            current_timestamp(),
        ).alias("updated_at"),
    )
    .filter(
        col("item_id").isNotNull()
        & col("last_price").isNotNull()
        & col("updated_at").isNotNull()
    )
)

# ==============================
# 공통 유틸
# ==============================

def normalize_ids(ids) -> List[int]:
    return sorted({int(x) for x in ids if x is not None})


def dedup_by_latest(rows, key_field: str, time_field: str) -> Dict[int, any]:
    """
    Python 레벨에서 최신 레코드만 남김.
    row_number() Window 셔플 없이 동일 효과.
    """
    latest: Dict[int, any] = {}
    for r in rows:
        k = int(r[key_field])
        if k not in latest or r[time_field] > latest[k][time_field]:
            latest[k] = r
    return latest


def recompute_valuation(cur, company_ids: List[int]):
    """변경된 company_id에 대해서만 valuation 재계산 후 upsert."""
    if not company_ids:
        return
    cur.execute("""
        WITH inv AS (
            SELECT
                q.company_id,
                SUM(q.qty * p.last_price)::bigint AS inventory_value
            FROM company_item_qty_state q
            JOIN item_price_state p ON p.item_id = q.item_id
            WHERE q.company_id = ANY(%s)
            GROUP BY q.company_id
        )
        INSERT INTO company_valuation
            (company_id, cash, inventory_value, market_cap, updated_at)
        SELECT
            c.company_id,
            c.cash,
            COALESCE(inv.inventory_value, 0),
            c.cash + COALESCE(inv.inventory_value, 0),
            NOW()
        FROM company_cash_state c
        LEFT JOIN inv ON inv.company_id = c.company_id
        WHERE c.company_id = ANY(%s)
        ON CONFLICT (company_id) DO UPDATE
            SET cash            = EXCLUDED.cash,
                inventory_value = EXCLUDED.inventory_value,
                market_cap      = EXCLUDED.market_cap,
                updated_at      = EXCLUDED.updated_at
    """, (company_ids, company_ids))


def sync_ranking(company_ids: List[int]):
    """
    Analytics DB -> Operation DB ranking_current 동기화.
    FK(company) 보호: JOIN company로 존재 여부 확인 후 upsert.
    """
    if not company_ids:
        return

    an_pool = get_an_pool()
    op_pool = get_op_pool()
    an_conn = an_pool.getconn()
    op_conn = op_pool.getconn()

    try:
        with an_conn.cursor() as an_cur, op_conn.cursor() as op_cur:
            an_cur.execute("""
                SELECT company_id, market_cap
                FROM company_valuation
                WHERE company_id = ANY(%s)
                  AND market_cap IS NOT NULL
            """, (company_ids,))
            rows = an_cur.fetchall()
            if not rows:
                return

            execute_values(
                op_cur,
                """
                INSERT INTO ranking_current
                    (company_id, valuation, ranking_updated_at)
                SELECT v.company_id, v.valuation, NOW()
                FROM (VALUES %s) AS v(company_id, valuation)
                JOIN company USING (company_id)
                ON CONFLICT (company_id) DO UPDATE
                    SET valuation          = EXCLUDED.valuation,
                        ranking_updated_at = EXCLUDED.ranking_updated_at
                """,
                [(int(cid), int(mc)) for cid, mc in rows],
                template="(%s, %s)",
                page_size=1000,
            )
        op_conn.commit()
    except Exception:
        op_conn.rollback()
        raise
    finally:
        an_pool.putconn(an_conn)
        op_pool.putconn(op_conn)


# ==============================
# foreachBatch 핸들러
# ==============================

def upsert_cash_state(batch_df: DataFrame, batch_id: int):
    """
    cash 최신값 upsert.
    dedup: Python dict로 처리 -> Window 셔플 제거.
    """
    rows = (
        batch_df
        .filter(
            col("company_id").isNotNull()
            & col("cash").isNotNull()
            & col("updated_at").isNotNull()
        )
        .collect()
    )
    if not rows:
        return

    latest = dedup_by_latest(rows, "company_id", "updated_at")
    data = [(cid, int(r["cash"]), r["updated_at"]) for cid, r in latest.items()]
    company_ids = list(latest.keys())

    pool = get_an_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO company_cash_state (company_id, cash, updated_at)
                VALUES %s
                ON CONFLICT (company_id) DO UPDATE
                    SET cash       = EXCLUDED.cash,
                        updated_at = EXCLUDED.updated_at
                WHERE company_cash_state.updated_at < EXCLUDED.updated_at
            """, data, page_size=1000)
            recompute_valuation(cur, company_ids)
        conn.commit()
        sync_ranking(company_ids)
        print("[CASH]  batch={0} upserted={1}".format(batch_id, len(data)))
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def upsert_item_qty_state(batch_df: DataFrame, batch_id: int):
    """
    재고 수량 delta 누적 upsert.
    음수 qty 방지: DB 레벨에서 GREATEST(0, ...) 처리 -> 별도 UPDATE 제거.
    """
    agg_df = (
        batch_df
        .filter(
            col("company_id").isNotNull()
            & col("item_id").isNotNull()
            & col("qty_delta").isNotNull()
            & col("updated_at").isNotNull()
        )
        .groupBy("company_id", "item_id")
        .agg(
            spark_sum("qty_delta").alias("qty_delta"),
            spark_max("updated_at").alias("updated_at"),
        )
    )

    rows = agg_df.collect()
    if not rows:
        return

    data = [
        (int(r["company_id"]), int(r["item_id"]), int(r["qty_delta"]), r["updated_at"])
        for r in rows
    ]
    company_ids = normalize_ids([r["company_id"] for r in rows])

    pool = get_an_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO company_item_qty_state
                    (company_id, item_id, qty, updated_at)
                VALUES %s
                ON CONFLICT (company_id, item_id) DO UPDATE
                    SET qty        = GREATEST(
                                        0,
                                        company_item_qty_state.qty + EXCLUDED.qty
                                     ),
                        updated_at = GREATEST(
                                        company_item_qty_state.updated_at,
                                        EXCLUDED.updated_at
                                     )
            """, data, page_size=1000)
            recompute_valuation(cur, company_ids)
        conn.commit()
        sync_ranking(company_ids)
        print("[WH]    batch={0} upserted={1}".format(batch_id, len(data)))
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def upsert_item_price_state(batch_df: DataFrame, batch_id: int):
    """
    아이템 최신 거래가 upsert.
    dedup: Python dict로 처리 -> Window 셔플 제거.
    """
    rows = (
        batch_df
        .filter(
            col("item_id").isNotNull()
            & col("last_price").isNotNull()
            & col("updated_at").isNotNull()
        )
        .collect()
    )
    if not rows:
        return

    latest = dedup_by_latest(rows, "item_id", "updated_at")
    data = [(iid, int(r["last_price"]), r["updated_at"]) for iid, r in latest.items()]
    item_ids = list(latest.keys())

    pool = get_an_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO item_price_state (item_id, last_price, updated_at)
                VALUES %s
                ON CONFLICT (item_id) DO UPDATE
                    SET last_price = EXCLUDED.last_price,
                        updated_at = EXCLUDED.updated_at
                WHERE item_price_state.updated_at < EXCLUDED.updated_at
            """, data, page_size=1000)

            # 가격이 바뀐 아이템을 보유한 회사만 재계산
            cur.execute("""
                SELECT DISTINCT company_id
                FROM company_item_qty_state
                WHERE item_id = ANY(%s)
            """, (item_ids,))
            company_ids = [int(r[0]) for r in cur.fetchall()]

            recompute_valuation(cur, company_ids)
        conn.commit()
        sync_ranking(company_ids)
        print("[PRICE] batch={0} upserted={1}".format(batch_id, len(data)))
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


# ==============================
# Streaming Queries 실행
# → QUERY_START_OFFSET 간격으로 시작 시점 분산
# → 3개 쿼리 배치가 동시에 안 터지도록
# ==============================

# 1. cash (즉시 시작)
q_cash = (
    cash_events.writeStream
    .foreachBatch(upsert_cash_state)
    .outputMode("update")
    .trigger(processingTime=TRIGGER_INTERVAL)
    .option("checkpointLocation", "/tmp/checkpoints/valuation-step4-cash-state")
    .start()
)
print("[INIT] cash query started")

# 2. warehouse (1초 뒤 시작)
time.sleep(QUERY_START_OFFSET)
q_wh = (
    warehouse_events.writeStream
    .foreachBatch(upsert_item_qty_state)
    .outputMode("update")
    .trigger(processingTime=TRIGGER_INTERVAL)
    .option("checkpointLocation", "/tmp/checkpoints/valuation-step4-item-qty-state")
    .start()
)
print("[INIT] warehouse query started")

# 3. trade (2초 뒤 시작)
time.sleep(QUERY_START_OFFSET)
q_tr = (
    trade_events.writeStream
    .foreachBatch(upsert_item_price_state)
    .outputMode("update")
    .trigger(processingTime=TRIGGER_INTERVAL)
    .option("checkpointLocation", "/tmp/checkpoints/valuation-step4-item-price-state")
    .start()
)
print("[INIT] trade query started")

spark.streams.awaitAnyTermination()