import os
from typing import Iterable, Iterator, List, Sequence, Set, Tuple

import psycopg2
from psycopg2.extras import execute_values
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import (
    col,
    from_json,
    to_timestamp,
    coalesce,
    from_unixtime,
    current_timestamp,
    sum as spark_sum,
    max as spark_max,
    when,
    length,
    struct,
)
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, MapType


# ============================================================
# 목적
# - Kafka 이벤트(company, warehouse, trade)를 실시간으로 읽어서
#   1) 상태 테이블(company_cash_state, company_item_qty_state, item_price_state) 갱신
#   2) 회사 가치(company_valuation) 재계산
#   3) 운영 DB 랭킹(ranking_current) 동기화
#
# 개선 포인트
# - topic별 별도 source 사용
# - collect() 대신 toLocalIterator()+chunk
# - latest 선택 시 tie-break 강화(updated_at, kafka_timestamp, partition, offset)
# - stale event가 최신 상태를 덮지 않도록 upsert guard 추가
# - warehouse 음수 보정을 전체 테이블이 아니라 batch 변경 key에 한정
# - company/item id 수집을 set 기반으로 바꿔 중복 감소
# ============================================================


# -----------------------------
# Spark 세션
# -----------------------------
spark = (
    SparkSession.builder
    .appName("CompanyValuationStream-Step4-StateAndValuation-OptimizedV2")
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
# Operation DB 환경변수
# -----------------------------
OP_DB_HOST = os.getenv("OP_DB_HOST", "postgres-db")
OP_DB_PORT = int(os.getenv("OP_DB_PORT", "5432"))
OP_DB_NAME = os.getenv("OP_DB_NAME", "ecosim")
OP_DB_USER = os.getenv("OP_DB_USER", "ecosim")
OP_DB_PASSWORD = os.getenv("OP_DB_PASSWORD", "ecosim")


# -----------------------------
# Kafka/Streaming 환경변수
# -----------------------------
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")

TOPIC_COMPANY = os.getenv("KAFKA_TOPIC_COMPANY_EVENTS", "company.events")
TOPIC_WAREHOUSE = os.getenv("KAFKA_TOPIC_WAREHOUSE_EVENTS", "warehouse.events")
TOPIC_TRADE = os.getenv("KAFKA_TOPIC_TRADE_EVENTS", "market.trade.events")

MAX_OFFSETS_PER_TRIGGER = int(os.getenv("MAX_OFFSETS_PER_TRIGGER", "5000"))
UPSERT_CHUNK_SIZE = int(os.getenv("UPSERT_CHUNK_SIZE", "1000"))
LOOKUP_CHUNK_SIZE = int(os.getenv("LOOKUP_CHUNK_SIZE", "1000"))
STREAM_TRIGGER = os.getenv("STREAM_TRIGGER", "5 seconds")

CKPT_BASE = os.getenv("VALUATION_CHECKPOINT_BASE", "/tmp/checkpoints")
CKPT_CASH = os.getenv("VALUATION_CASH_CHECKPOINT", f"{CKPT_BASE}/valuation-cash")
CKPT_WH = os.getenv("VALUATION_WH_CHECKPOINT", f"{CKPT_BASE}/valuation-wh")
CKPT_TR = os.getenv("VALUATION_TR_CHECKPOINT", f"{CKPT_BASE}/valuation-tr")


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
# 유틸: 이벤트 시간 파싱
# -----------------------------
def parse_event_ts(primary_col, fallback_col):
    p = primary_col.cast("string")
    return coalesce(
        when(length(p) >= 13, from_unixtime(p.cast("double") / 1000.0)).cast("timestamp"),
        from_unixtime(p.cast("double")).cast("timestamp"),
        to_timestamp(p),
        fallback_col.cast("timestamp"),
        current_timestamp(),
    )


# -----------------------------
# 유틸: chunk
# -----------------------------
def chunked(seq: Sequence[int], size: int) -> Iterator[List[int]]:
    for i in range(0, len(seq), size):
        yield list(seq[i:i + size])


def normalize_int_ids(ids: Iterable[int]) -> List[int]:
    normalized: Set[int] = set()
    for x in ids:
        if x is not None:
            normalized.add(int(x))
    return sorted(normalized)


def normalize_item_keys(keys: Iterable[Tuple[int, int]]) -> List[Tuple[int, int]]:
    normalized: Set[Tuple[int, int]] = set()
    for company_id, item_id in keys:
        if company_id is not None and item_id is not None:
            normalized.add((int(company_id), int(item_id)))
    return sorted(normalized)


def iter_chunks(df: DataFrame, cols: List[str], chunk_size: int) -> Iterable[list]:
    chunk = []
    for r in df.select(*cols).toLocalIterator():
        chunk.append(r)
        if len(chunk) >= chunk_size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


# -----------------------------
# Kafka topic별 source
# -----------------------------
def read_topic_stream(topic_name: str) -> DataFrame:
    return (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe", topic_name)
        .option("startingOffsets", "latest")
        .option("maxOffsetsPerTrigger", MAX_OFFSETS_PER_TRIGGER)
        .option("failOnDataLoss", "false")
        .load()
    )


def parse_envelope(raw_df: DataFrame) -> DataFrame:
    return (
        raw_df.selectExpr(
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
        )
    )


# -----------------------------
# source별 정규화
# -----------------------------
company_base = parse_envelope(read_topic_stream(TOPIC_COMPANY))
warehouse_base = parse_envelope(read_topic_stream(TOPIC_WAREHOUSE))
trade_base = parse_envelope(read_topic_stream(TOPIC_TRADE))

cash_events = (
    company_base
    .filter(col("event_type") == "company.cash.changed")
    .select(
        coalesce(
            col("payload").getItem("company_id"),
            col("partition_key"),
            col("aggregate_id"),
        ).cast("bigint").alias("company_id"),
        col("payload").getItem("cash").cast("bigint").alias("cash"),
        parse_event_ts(
            coalesce(col("payload").getItem("changed_at"), col("occurred_at")),
            col("kafka_timestamp"),
        ).alias("updated_at"),
        col("kafka_timestamp"),
        col("partition").cast("bigint").alias("src_partition"),
        col("offset").cast("bigint").alias("src_offset"),
    )
    .filter(
        col("company_id").isNotNull()
        & col("cash").isNotNull()
        & col("updated_at").isNotNull()
    )
)

warehouse_events = (
    warehouse_base
    .filter(col("event_type").isin("warehouse.item.stored", "warehouse.item.removed"))
    .select(
        col("event_type"),
        col("payload").getItem("company_id").cast("bigint").alias("company_id"),
        col("payload").getItem("item_id").cast("bigint").alias("item_id"),
        col("payload").getItem("quantity_delta").cast("bigint").alias("raw_qty_delta"),
        parse_event_ts(
            coalesce(
                col("payload").getItem("stored_at"),
                col("payload").getItem("removed_at"),
                col("occurred_at"),
            ),
            col("kafka_timestamp"),
        ).alias("updated_at"),
    )
    .filter(
        col("company_id").isNotNull()
        & col("item_id").isNotNull()
        & col("raw_qty_delta").isNotNull()
        & col("updated_at").isNotNull()
    )
    .withColumn(
        "qty_delta",
        when(col("event_type") == "warehouse.item.removed", -col("raw_qty_delta"))
        .otherwise(col("raw_qty_delta"))
    )
    .select("company_id", "item_id", "qty_delta", "updated_at")
)

trade_events = (
    trade_base
    .filter(col("event_type") == "market.trade.executed")
    .select(
        col("payload").getItem("item_id").cast("bigint").alias("item_id"),
        coalesce(
            col("payload").getItem("matched_price"),
            col("payload").getItem("price"),
        ).cast("bigint").alias("last_price"),
        parse_event_ts(
            coalesce(col("payload").getItem("executed_at"), col("occurred_at")),
            col("kafka_timestamp"),
        ).alias("updated_at"),
        col("kafka_timestamp"),
        col("partition").cast("bigint").alias("src_partition"),
        col("offset").cast("bigint").alias("src_offset"),
    )
    .filter(
        col("item_id").isNotNull()
        & col("last_price").isNotNull()
        & col("updated_at").isNotNull()
    )
)


# -----------------------------
# 최신값 dedup helper
# -----------------------------
# tie-break 우선순위:
# 1) updated_at
# 2) kafka_timestamp
# 3) src_partition
# 4) src_offset
def latest_by_key(
    df: DataFrame,
    key_cols: List[str],
    value_cols: List[str],
) -> DataFrame:
    latest_struct = struct(
        col("updated_at").alias("updated_at"),
        col("kafka_timestamp").alias("kafka_timestamp"),
        col("src_partition").alias("src_partition"),
        col("src_offset").alias("src_offset"),
        *[col(c).alias(c) for c in value_cols],
    )

    agg = df.groupBy(*key_cols).agg(
        spark_max(latest_struct).alias("latest")
    )

    select_cols = [col(k) for k in key_cols] + [
        col("latest.updated_at").alias("updated_at"),
        col("latest.kafka_timestamp").alias("kafka_timestamp"),
        col("latest.src_partition").alias("src_partition"),
        col("latest.src_offset").alias("src_offset"),
    ] + [
        col(f"latest.{c}").alias(c) for c in value_cols
    ]

    return agg.select(*select_cols)


# -----------------------------
# DB 연결
# -----------------------------
def get_an_conn():
    conn = psycopg2.connect(
        host=AN_DB_HOST,
        port=AN_DB_PORT,
        dbname=AN_DB_NAME,
        user=AN_DB_USER,
        password=AN_DB_PASSWORD,
    )
    conn.autocommit = False
    return conn


def get_op_conn():
    conn = psycopg2.connect(
        host=OP_DB_HOST,
        port=OP_DB_PORT,
        dbname=OP_DB_NAME,
        user=OP_DB_USER,
        password=OP_DB_PASSWORD,
    )
    conn.autocommit = False
    return conn


# -----------------------------
# 가치 재계산
# -----------------------------
def recompute_company_valuation_for_companies(an_cur, company_ids: List[int]):
    target_ids = normalize_int_ids(company_ids)
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
            JOIN item_price_state p
              ON p.item_id = q.item_id
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
        JOIN company_cash_state c
          ON c.company_id = t.company_id
        LEFT JOIN inv
          ON inv.company_id = c.company_id
        ON CONFLICT (company_id) DO UPDATE
        SET cash = EXCLUDED.cash,
            inventory_value = EXCLUDED.inventory_value,
            market_cap = EXCLUDED.market_cap,
            updated_at = EXCLUDED.updated_at
    """, (target_ids,))


def sync_ranking_current(company_ids: List[int]):
    target_ids = normalize_int_ids(company_ids)
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
                JOIN company c
                  ON c.company_id = v.company_id
                ON CONFLICT (company_id) DO UPDATE
                SET valuation = EXCLUDED.valuation,
                    ranking_updated_at = EXCLUDED.ranking_updated_at
                """,
                payload,
                template="(%s, %s)",
                page_size=1000,
            )

        op_conn.commit()
    except Exception:
        op_conn.rollback()
        raise
    finally:
        an_conn.close()
        op_conn.close()


# -----------------------------
# 회사 조회 helper
# -----------------------------
def find_companies_holding_items(an_cur, item_ids: List[int]) -> List[int]:
    target_item_ids = normalize_int_ids(item_ids)
    if not target_item_ids:
        return []

    company_ids: Set[int] = set()
    for item_chunk in chunked(target_item_ids, LOOKUP_CHUNK_SIZE):
        an_cur.execute("""
            SELECT DISTINCT company_id
            FROM company_item_qty_state
            WHERE item_id = ANY(%s)
        """, (item_chunk,))
        company_ids.update(int(r[0]) for r in an_cur.fetchall())

    return sorted(company_ids)


def clamp_negative_qty_for_keys(an_cur, keys: List[Tuple[int, int]]):
    target_keys = normalize_item_keys(keys)
    if not target_keys:
        return

    for key_chunk in chunked(target_keys, LOOKUP_CHUNK_SIZE):
        execute_values(
            an_cur,
            """
            UPDATE company_item_qty_state s
            SET qty = 0
            FROM (VALUES %s) AS v(company_id, item_id)
            WHERE s.company_id = v.company_id
              AND s.item_id = v.item_id
              AND s.qty < 0
            """,
            key_chunk,
            template="(%s, %s)",
            page_size=LOOKUP_CHUNK_SIZE,
        )


# -----------------------------
# foreachBatch: cash state
# -----------------------------
def upsert_cash_state(batch_df: DataFrame, batch_id: int):
    dedup_df = latest_by_key(
        batch_df.filter(
            col("company_id").isNotNull()
            & col("cash").isNotNull()
            & col("updated_at").isNotNull()
        ),
        key_cols=["company_id"],
        value_cols=["cash"],
    )

    changed_company_ids: Set[int] = set()
    upserted = 0

    an_conn = get_an_conn()
    try:
        with an_conn.cursor() as an_cur:
            for rows in iter_chunks(
                dedup_df,
                ["company_id", "cash", "updated_at"],
                UPSERT_CHUNK_SIZE,
            ):
                data = [
                    (int(r["company_id"]), int(r["cash"]), r["updated_at"])
                    for r in rows
                ]
                if not data:
                    continue

                changed_company_ids.update(int(r["company_id"]) for r in rows)
                upserted += len(data)

                execute_values(
                    an_cur,
                    """
                    INSERT INTO company_cash_state (company_id, cash, updated_at)
                    VALUES %s
                    ON CONFLICT (company_id) DO UPDATE
                    SET cash = EXCLUDED.cash,
                        updated_at = EXCLUDED.updated_at
                    WHERE EXCLUDED.updated_at >= company_cash_state.updated_at
                    """,
                    data,
                    page_size=UPSERT_CHUNK_SIZE,
                )

            if upserted == 0:
                an_conn.commit()
                print(f"[CASH] batch={batch_id}, upserted=0")
                return

            recompute_company_valuation_for_companies(an_cur, list(changed_company_ids))

        an_conn.commit()
        sync_ranking_current(list(changed_company_ids))
        print(f"[CASH] batch={batch_id}, upserted={upserted}, companies={len(changed_company_ids)}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()


# -----------------------------
# foreachBatch: qty state
# -----------------------------
def upsert_item_qty_state(batch_df: DataFrame, batch_id: int):
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

    changed_company_ids: Set[int] = set()
    changed_keys: Set[Tuple[int, int]] = set()
    upserted = 0

    an_conn = get_an_conn()
    try:
        with an_conn.cursor() as an_cur:
            for rows in iter_chunks(
                agg_df,
                ["company_id", "item_id", "qty_delta", "updated_at"],
                UPSERT_CHUNK_SIZE,
            ):
                data = [
                    (int(r["company_id"]), int(r["item_id"]), int(r["qty_delta"]), r["updated_at"])
                    for r in rows
                ]
                if not data:
                    continue

                changed_company_ids.update(int(r["company_id"]) for r in rows)
                changed_keys.update((int(r["company_id"]), int(r["item_id"])) for r in rows)
                upserted += len(data)

                execute_values(
                    an_cur,
                    """
                    INSERT INTO company_item_qty_state (company_id, item_id, qty, updated_at)
                    VALUES %s
                    ON CONFLICT (company_id, item_id) DO UPDATE
                    SET qty = company_item_qty_state.qty + EXCLUDED.qty,
                        updated_at = GREATEST(company_item_qty_state.updated_at, EXCLUDED.updated_at)
                    """,
                    data,
                    page_size=UPSERT_CHUNK_SIZE,
                )

            if upserted == 0:
                an_conn.commit()
                print(f"[WH] batch={batch_id}, upserted=0")
                return

            clamp_negative_qty_for_keys(an_cur, list(changed_keys))
            recompute_company_valuation_for_companies(an_cur, list(changed_company_ids))

        an_conn.commit()
        sync_ranking_current(list(changed_company_ids))
        print(
            f"[WH] batch={batch_id}, upserted={upserted}, "
            f"companies={len(changed_company_ids)}, keys={len(changed_keys)}"
        )
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()


# -----------------------------
# foreachBatch: price state
# -----------------------------
def upsert_item_price_state(batch_df: DataFrame, batch_id: int):
    dedup_df = latest_by_key(
        batch_df.filter(
            col("item_id").isNotNull()
            & col("last_price").isNotNull()
            & col("updated_at").isNotNull()
        ),
        key_cols=["item_id"],
        value_cols=["last_price"],
    )

    changed_item_ids: Set[int] = set()
    changed_company_ids: Set[int] = set()
    upserted = 0

    an_conn = get_an_conn()
    try:
        with an_conn.cursor() as an_cur:
            for rows in iter_chunks(
                dedup_df,
                ["item_id", "last_price", "updated_at"],
                UPSERT_CHUNK_SIZE,
            ):
                data = [
                    (int(r["item_id"]), int(r["last_price"]), r["updated_at"])
                    for r in rows
                ]
                if not data:
                    continue

                changed_item_ids.update(int(r["item_id"]) for r in rows)
                upserted += len(data)

                execute_values(
                    an_cur,
                    """
                    INSERT INTO item_price_state (item_id, last_price, updated_at)
                    VALUES %s
                    ON CONFLICT (item_id) DO UPDATE
                    SET last_price = EXCLUDED.last_price,
                        updated_at = EXCLUDED.updated_at
                    WHERE EXCLUDED.updated_at >= item_price_state.updated_at
                    """,
                    data,
                    page_size=UPSERT_CHUNK_SIZE,
                )

            if upserted == 0:
                an_conn.commit()
                print(f"[PRICE] batch={batch_id}, upserted=0")
                return

            changed_company_ids.update(
                find_companies_holding_items(an_cur, list(changed_item_ids))
            )
            recompute_company_valuation_for_companies(an_cur, list(changed_company_ids))

        an_conn.commit()
        sync_ranking_current(list(changed_company_ids))
        print(
            f"[PRICE] batch={batch_id}, upserted={upserted}, "
            f"items={len(changed_item_ids)}, companies={len(changed_company_ids)}"
        )
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
    .outputMode("append")
    .trigger(processingTime=STREAM_TRIGGER)
    .option("checkpointLocation", CKPT_CASH)
    .start()
)

q_wh = (
    warehouse_events.writeStream
    .foreachBatch(upsert_item_qty_state)
    .outputMode("append")
    .trigger(processingTime=STREAM_TRIGGER)
    .option("checkpointLocation", CKPT_WH)
    .start()
)

q_tr = (
    trade_events.writeStream
    .foreachBatch(upsert_item_price_state)
    .outputMode("append")
    .trigger(processingTime=STREAM_TRIGGER)
    .option("checkpointLocation", CKPT_TR)
    .start()
)

spark.streams.awaitAnyTermination()