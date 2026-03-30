import os
from typing import List

import psycopg2
from psycopg2.extras import execute_values
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col,
    from_json,
    to_timestamp,
    coalesce,
    lit,
    from_unixtime,
    current_timestamp,
    row_number,
    sum as spark_sum,
    max as spark_max,
)
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, MapType
from pyspark.sql.window import Window

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
# Analytics DB 환경변수
# -----------------------------
AN_DB_HOST = os.getenv("ANALYTICS_DB_HOST", "analytics-postgres")
AN_DB_PORT = int(os.getenv("ANALYTICS_DB_PORT", "5432"))
AN_DB_NAME = os.getenv("ANALYTICS_DB_NAME", "ecosim_analytics")
AN_DB_USER = os.getenv("ANALYTICS_DB_USER", "ecosim")
AN_DB_PASSWORD = os.getenv("ANALYTICS_DB_PASSWORD", "ecosim")

# -----------------------------
# Operation DB 환경변수 (ranking_current 저장용)
# -----------------------------
OP_DB_HOST = os.getenv("OP_DB_HOST", "postgres-db")
OP_DB_PORT = int(os.getenv("OP_DB_PORT", "5432"))
OP_DB_NAME = os.getenv("OP_DB_NAME", "ecosim")
OP_DB_USER = os.getenv("OP_DB_USER", "ecosim")
OP_DB_PASSWORD = os.getenv("OP_DB_PASSWORD", "ecosim")

# -----------------------------
# Kafka 환경변수
# -----------------------------
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPICS_STREAM = os.getenv(
    "KAFKA_TOPICS_STREAM",
    "company.events,warehouse.events,market.trade.events"
)

# -----------------------------
# 공통 envelope 스키마
# -----------------------------
envelope_schema = StructType([
    StructField("event_id", StringType(), True),
    StructField("event_type", StringType(), True),
    StructField("event_version", IntegerType(), True),
    StructField("occurred_at", StringType(), True),
    StructField("producer", StringType(), True),
    StructField("partition_key", StringType(), True),
    StructField("aggregate_id", StringType(), True),
    StructField("payload", MapType(StringType(), StringType()), True),
])

# -----------------------------
# Kafka source
# -----------------------------
raw = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
    .option("subscribe", KAFKA_TOPICS_STREAM)
    .option("startingOffsets", "latest")
    .load()
)

base = (
    raw.selectExpr(
        "topic",
        "partition",
        "offset",
        "timestamp as kafka_timestamp",
        "CAST(value AS STRING) as raw_json"
    )
    .withColumn("e", from_json(col("raw_json"), envelope_schema))
    .select(
        col("e.event_type").alias("event_type"),
        col("e.occurred_at").alias("occurred_at"),
        col("e.partition_key").alias("partition_key"),
        col("e.aggregate_id").alias("aggregate_id"),
        col("e.payload").alias("payload"),
        col("topic"),
        col("partition"),
        col("offset"),
        col("kafka_timestamp"),
        col("raw_json")
    )
)

# -----------------------------
# 정규화: company.cash.changed
# -----------------------------
cash_events = (
    base.filter(col("event_type") == "company.cash.changed")
    .select(
        coalesce(
            col("payload").getItem("company_id"),
            col("partition_key"),
            col("aggregate_id")
        ).cast("bigint").alias("company_id"),
        col("payload").getItem("cash").cast("bigint").alias("cash"),
        to_timestamp(
            coalesce(col("payload").getItem("changed_at"), col("occurred_at"))
        ).alias("updated_at")
    )
    .filter(col("company_id").isNotNull() & col("cash").isNotNull())
)

# -----------------------------
# 정규화: warehouse.item.stored / removed
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
                col("occurred_at")
            )
        ).alias("updated_at")
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
        )
    )
    .select("company_id", "item_id", "qty_delta", "updated_at")
)

# -----------------------------
# 정규화: market.trade.executed
# -----------------------------
trade_events = (
    base.filter(col("event_type") == "market.trade.executed")
    .select(
        col("payload").getItem("item_id").cast("bigint").alias("item_id"),
        coalesce(
            col("payload").getItem("matched_price"),
            col("payload").getItem("price")
        ).cast("bigint").alias("last_price"),
        coalesce(
            from_unixtime(
                coalesce(
                    col("payload").getItem("executed_at"),
                    col("occurred_at")
                ).cast("double")
            ).cast("timestamp"),
            col("kafka_timestamp").cast("timestamp"),
            current_timestamp()
        ).alias("updated_at")
    )
    .filter(
        col("item_id").isNotNull()
        & col("last_price").isNotNull()
        & col("updated_at").isNotNull()
    )
)

# -----------------------------
# DB 연결 함수
# -----------------------------
def get_an_conn():
    conn = psycopg2.connect(
        host=AN_DB_HOST,
        port=AN_DB_PORT,
        dbname=AN_DB_NAME,
        user=AN_DB_USER,
        password=AN_DB_PASSWORD
    )
    conn.autocommit = False
    return conn


def get_op_conn():
    conn = psycopg2.connect(
        host=OP_DB_HOST,
        port=OP_DB_PORT,
        dbname=OP_DB_NAME,
        user=OP_DB_USER,
        password=OP_DB_PASSWORD
    )
    conn.autocommit = False
    return conn


def normalize_company_ids(company_ids: List[int]) -> List[int]:
    if not company_ids:
        return []
    return sorted(set(int(x) for x in company_ids if x is not None))

# -----------------------------
# 가치 재계산: 변경된 company_id만
# -----------------------------
def recompute_company_valuation_for_companies(an_cur, company_ids: List[int]):
    target_ids = normalize_company_ids(company_ids)
    if not target_ids:
        return

    an_cur.execute("""
        WITH targets AS (
            SELECT UNNEST(%s::bigint[]) AS company_id
        ),
        inv AS (
            SELECT
                q.company_id,
                SUM(q.qty * p.last_price)::bigint AS inventory_value
            FROM company_item_qty_state q
            JOIN item_price_state p ON p.item_id = q.item_id
            WHERE q.company_id IN (SELECT company_id FROM targets)
            GROUP BY q.company_id
        )
        INSERT INTO company_valuation (company_id, cash, inventory_value, market_cap, updated_at)
        SELECT
            c.company_id,
            c.cash,
            COALESCE(inv.inventory_value, 0) AS inventory_value,
            c.cash + COALESCE(inv.inventory_value, 0) AS market_cap,
            NOW()
        FROM targets t
        JOIN company_cash_state c ON c.company_id = t.company_id
        LEFT JOIN inv ON inv.company_id = c.company_id
        ON CONFLICT (company_id) DO UPDATE
        SET cash = EXCLUDED.cash,
            inventory_value = EXCLUDED.inventory_value,
            market_cap = EXCLUDED.market_cap,
            updated_at = EXCLUDED.updated_at
    """, (target_ids,))

# -----------------------------
# ranking_current 동기화 (FK 보호)
# - 운영 DB company 테이블에 존재하는 company_id만 upsert
# -----------------------------
def sync_ranking_current(company_ids: List[int]):
    target_ids = normalize_company_ids(company_ids)
    if not target_ids:
        return

    an_conn = get_an_conn()
    op_conn = get_op_conn()

    try:
        with an_conn.cursor() as an_cur, op_conn.cursor() as op_cur:
            an_cur.execute("""
                SELECT company_id, market_cap
                FROM company_valuation
                WHERE company_id = ANY(%s)
            """, (target_ids,))
            rows = an_cur.fetchall()

            payload = [
                (int(company_id), int(market_cap))
                for company_id, market_cap in rows
                if market_cap is not None
            ]

            if not payload:
                op_conn.commit()
                return

            execute_values(
                op_cur,
                """
                INSERT INTO ranking_current (company_id, valuation, ranking_updated_at)
                SELECT v.company_id, v.valuation, NOW()
                FROM (VALUES %s) AS v(company_id, valuation)
                JOIN company c ON c.company_id = v.company_id
                ON CONFLICT (company_id) DO UPDATE
                SET valuation = EXCLUDED.valuation,
                    ranking_updated_at = EXCLUDED.ranking_updated_at
                """,
                payload,
                template="(%s, %s)",
                page_size=1000
            )

        op_conn.commit()
    except Exception:
        op_conn.rollback()
        raise
    finally:
        an_conn.close()
        op_conn.close()

# -----------------------------
# foreachBatch: cash state
# -----------------------------
def upsert_cash_state(batch_df, batch_id: int):
    dedup_df = (
        batch_df
        .filter(
            col("company_id").isNotNull()
            & col("cash").isNotNull()
            & col("updated_at").isNotNull()
        )
        .withColumn(
            "rn",
            row_number().over(
                Window.partitionBy("company_id").orderBy(col("updated_at").desc())
            )
        )
        .filter(col("rn") == 1)
        .select("company_id", "cash", "updated_at")
    )

    rows = dedup_df.collect()
    if not rows:
        return

    data = [(int(r["company_id"]), int(r["cash"]), r["updated_at"]) for r in rows]
    changed_company_ids = [int(r["company_id"]) for r in rows]

    an_conn = get_an_conn()
    try:
        with an_conn.cursor() as an_cur:
            execute_values(an_cur, """
                INSERT INTO company_cash_state (company_id, cash, updated_at)
                VALUES %s
                ON CONFLICT (company_id) DO UPDATE
                SET cash = EXCLUDED.cash,
                    updated_at = EXCLUDED.updated_at
            """, data, page_size=1000)

            recompute_company_valuation_for_companies(an_cur, changed_company_ids)

        an_conn.commit()
        sync_ranking_current(changed_company_ids)
        print(f"[CASH] batch={batch_id}, upserted={len(data)}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()

# -----------------------------
# foreachBatch: qty state
# -----------------------------
def upsert_item_qty_state(batch_df, batch_id: int):
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
            spark_max("updated_at").alias("updated_at")
        )
    )

    rows = agg_df.collect()
    if not rows:
        return

    data = [(int(r["company_id"]), int(r["item_id"]), int(r["qty_delta"]), r["updated_at"]) for r in rows]
    changed_company_ids = [int(r["company_id"]) for r in rows]

    an_conn = get_an_conn()
    try:
        with an_conn.cursor() as an_cur:
            execute_values(an_cur, """
                INSERT INTO company_item_qty_state (company_id, item_id, qty, updated_at)
                VALUES %s
                ON CONFLICT (company_id, item_id) DO UPDATE
                SET qty = company_item_qty_state.qty + EXCLUDED.qty,
                    updated_at = GREATEST(company_item_qty_state.updated_at, EXCLUDED.updated_at)
            """, data, page_size=1000)

            an_cur.execute("""
                UPDATE company_item_qty_state
                SET qty = 0
                WHERE qty < 0
            """)

            recompute_company_valuation_for_companies(an_cur, changed_company_ids)

        an_conn.commit()
        sync_ranking_current(changed_company_ids)
        print(f"[WH] batch={batch_id}, upserted={len(data)}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()

# -----------------------------
# foreachBatch: price state
# -----------------------------
def upsert_item_price_state(batch_df, batch_id: int):
    dedup_df = (
        batch_df
        .filter(
            col("item_id").isNotNull()
            & col("last_price").isNotNull()
            & col("updated_at").isNotNull()
        )
        .withColumn(
            "rn",
            row_number().over(
                Window.partitionBy("item_id").orderBy(col("updated_at").desc())
            )
        )
        .filter(col("rn") == 1)
        .select("item_id", "last_price", "updated_at")
    )

    rows = dedup_df.collect()
    if not rows:
        return

    data = [(int(r["item_id"]), int(r["last_price"]), r["updated_at"]) for r in rows]
    changed_item_ids = [int(r["item_id"]) for r in rows]

    if not changed_item_ids:
        return

    an_conn = get_an_conn()
    changed_company_ids: List[int] = []

    try:
        with an_conn.cursor() as an_cur:
            execute_values(an_cur, """
                INSERT INTO item_price_state (item_id, last_price, updated_at)
                VALUES %s
                ON CONFLICT (item_id) DO UPDATE
                SET last_price = EXCLUDED.last_price,
                    updated_at = EXCLUDED.updated_at
            """, data, page_size=1000)

            an_cur.execute("""
                SELECT DISTINCT company_id
                FROM company_item_qty_state
                WHERE item_id = ANY(%s)
            """, (changed_item_ids,))
            changed_company_ids = [int(r[0]) for r in an_cur.fetchall()]

            recompute_company_valuation_for_companies(an_cur, changed_company_ids)

        an_conn.commit()
        sync_ranking_current(changed_company_ids)
        print(f"[PRICE] batch={batch_id}, upserted={len(data)}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()

# -----------------------------
# Streaming Queries
# -----------------------------
q_cash = (
    cash_events.writeStream
    .foreachBatch(upsert_cash_state)
    .outputMode("update")
    .option("checkpointLocation", "/tmp/checkpoints/valuation-step4-cash-state")
    .start()
)

q_wh = (
    warehouse_events.writeStream
    .foreachBatch(upsert_item_qty_state)
    .outputMode("update")
    .option("checkpointLocation", "/tmp/checkpoints/valuation-step4-item-qty-state")
    .start()
)

q_tr = (
    trade_events.writeStream
    .foreachBatch(upsert_item_price_state)
    .outputMode("update")
    .option("checkpointLocation", "/tmp/checkpoints/valuation-step4-item-price-state")
    .start()
)

spark.streams.awaitAnyTermination()
