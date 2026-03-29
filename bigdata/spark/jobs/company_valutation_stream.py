import os
from typing import Iterable, List

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
#   2) 증분 방식으로 회사 가치(company_valuation) 반영
#   3) ranking_outbox 적재 후 운영 DB ranking_current 동기화
#
# 안정성 보강
# - stream_batch_checkpoint로 foreachBatch 재처리 중복 반영 방지
# - ranking_current FK(company) 안전 동기화 (JOIN company)
# - warehouse 음수 수량 보정 시 inventory_value 정합성 유지
# ============================================================


# -----------------------------
# Spark 세션
# -----------------------------
spark = (
    SparkSession.builder
    .appName("CompanyValuationStream-IncrementalProjection")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")
spark.conf.set("spark.sql.shuffle.partitions", os.getenv("SPARK_SHUFFLE_PARTITIONS", "8"))
spark.conf.set(
    "spark.default.parallelism",
    os.getenv("SPARK_DEFAULT_PARALLELISM", os.getenv("SPARK_SHUFFLE_PARTITIONS", "8")),
)
spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")


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
STREAM_TRIGGER = os.getenv("STREAM_TRIGGER", "5 seconds")

CKPT_BASE = os.getenv("VALUATION_CHECKPOINT_BASE", "/tmp/checkpoints")
CKPT_CASH = os.getenv("VALUATION_CASH_CHECKPOINT", f"{CKPT_BASE}/valuation-cash")
CKPT_WH = os.getenv("VALUATION_WH_CHECKPOINT", f"{CKPT_BASE}/valuation-wh")
CKPT_TR = os.getenv("VALUATION_TR_CHECKPOINT", f"{CKPT_BASE}/valuation-tr")

STREAM_CASH = "cash_state"
STREAM_WH = "item_qty_state"
STREAM_TR = "item_price_state"

# Spark CPU 튜닝(마이크로배치 오버헤드 완화)
SPARK_SHUFFLE_PARTITIONS = int(os.getenv("SPARK_SHUFFLE_PARTITIONS", "8"))
SPARK_DEFAULT_PARALLELISM = int(
    os.getenv("SPARK_DEFAULT_PARALLELISM", str(SPARK_SHUFFLE_PARTITIONS))
)

# 토픽별 처리량 제한(기본값은 보수적으로 낮춰 CPU 급등 방지)
MAX_OFFSETS_CASH = int(os.getenv("MAX_OFFSETS_CASH", "1200"))
MAX_OFFSETS_WH = int(os.getenv("MAX_OFFSETS_WH", "1200"))
MAX_OFFSETS_TR = int(os.getenv("MAX_OFFSETS_TR", "1200"))


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
# 유틸
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
def read_topic_stream(topic_name: str, max_offsets: int) -> DataFrame:
    return (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe", topic_name)
        .option("startingOffsets", "latest")
        .option("maxOffsetsPerTrigger", max_offsets)
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
company_base = parse_envelope(read_topic_stream(TOPIC_COMPANY, MAX_OFFSETS_CASH))
warehouse_base = parse_envelope(read_topic_stream(TOPIC_WAREHOUSE, MAX_OFFSETS_WH))
trade_base = parse_envelope(read_topic_stream(TOPIC_TRADE, MAX_OFFSETS_TR))

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
        col("payload").getItem("company_id").cast("bigint").alias("company_id"),
        col("payload").getItem("item_id").cast("bigint").alias("item_id"),
        when(
            col("event_type") == "warehouse.item.removed",
            -coalesce(
                col("payload").getItem("quantity_delta"),
                col("payload").getItem("quantity"),
            ).cast("bigint")
        ).otherwise(
            coalesce(
                col("payload").getItem("quantity_delta"),
                col("payload").getItem("quantity"),
            ).cast("bigint")
        ).alias("qty_delta"),
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
        & col("qty_delta").isNotNull()
        & col("updated_at").isNotNull()
    )
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
# 초기화
# -----------------------------
def ensure_control_tables():
    conn = get_an_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS stream_batch_checkpoint (
                    stream_name TEXT NOT NULL,
                    batch_id BIGINT NOT NULL,
                    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (stream_name, batch_id)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS company_inventory_value_state (
                    company_id BIGINT PRIMARY KEY,
                    inventory_value BIGINT NOT NULL DEFAULT 0,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ranking_outbox (
                    company_id BIGINT PRIMARY KEY,
                    market_cap BIGINT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    synced_at TIMESTAMPTZ NULL
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_ranking_outbox_unsynced
                ON ranking_outbox (synced_at, updated_at)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_company_item_qty_state_item_id
                ON company_item_qty_state (item_id)
            """)
        conn.commit()
    finally:
        conn.close()


ensure_control_tables()


# -----------------------------
# 공통 DB helper
# -----------------------------
def claim_batch(cur, stream_name: str, batch_id: int) -> bool:
    cur.execute("""
        INSERT INTO stream_batch_checkpoint (stream_name, batch_id)
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING
        RETURNING 1
    """, (stream_name, batch_id))
    return cur.fetchone() is not None


def stage_dataframe_to_temp(
    cur,
    df: DataFrame,
    temp_table: str,
    cols: List[str],
    chunk_size: int = UPSERT_CHUNK_SIZE,
) -> int:
    inserted = 0
    sql = f"INSERT INTO {temp_table} ({', '.join(cols)}) VALUES %s"

    for rows in iter_chunks(df, cols, chunk_size):
        data = [tuple(r[c] for c in cols) for r in rows]
        if not data:
            continue
        execute_values(cur, sql, data, page_size=chunk_size)
        inserted += len(data)

    return inserted


def sync_ranking_outbox_to_op(limit: int = 5000) -> int:
    """
    FK(company) 안전 동기화:
    - outbox -> op.tmp_rank_stage
    - tmp_rank_stage JOIN company 후 ranking_current upsert
    - 실제 upsert 대상 company_id만 analytics outbox.synced_at 갱신
    """
    an_conn = get_an_conn()
    op_conn = get_op_conn()

    try:
        with an_conn.cursor() as an_cur, op_conn.cursor() as op_cur:
            an_cur.execute("""
                SELECT company_id, market_cap
                FROM ranking_outbox
                WHERE synced_at IS NULL
                ORDER BY updated_at ASC
                LIMIT %s
            """, (limit,))
            rows = an_cur.fetchall()

            payload = [(int(company_id), int(market_cap)) for company_id, market_cap in rows]
            if not payload:
                op_conn.commit()
                an_conn.commit()
                return 0

            op_cur.execute("""
                CREATE TEMP TABLE tmp_rank_stage (
                    company_id BIGINT NOT NULL,
                    valuation BIGINT NOT NULL
                ) ON COMMIT DROP
            """)

            execute_values(
                op_cur,
                "INSERT INTO tmp_rank_stage (company_id, valuation) VALUES %s",
                payload,
                page_size=1000,
            )

            op_cur.execute("""
                INSERT INTO ranking_current (company_id, valuation, ranking_updated_at)
                SELECT t.company_id, t.valuation, NOW()
                FROM tmp_rank_stage t
                JOIN company c ON c.company_id = t.company_id
                ON CONFLICT (company_id) DO UPDATE
                SET valuation = EXCLUDED.valuation,
                    ranking_updated_at = EXCLUDED.ranking_updated_at
            """)

            op_cur.execute("""
                SELECT t.company_id
                FROM tmp_rank_stage t
                JOIN company c ON c.company_id = t.company_id
            """)
            applied_ids = [int(r[0]) for r in op_cur.fetchall()]

            if applied_ids:
                an_cur.execute("""
                    UPDATE ranking_outbox
                    SET synced_at = NOW()
                    WHERE company_id = ANY(%s)
                """, (applied_ids,))

        op_conn.commit()
        an_conn.commit()
        return len(payload)
    except Exception:
        op_conn.rollback()
        an_conn.rollback()
        raise
    finally:
        an_conn.close()
        op_conn.close()


def refresh_company_valuation_and_outbox(cur, changed_company_source_sql: str):
    """
    changed_company_source_sql: company_id 컬럼을 반환하는 SQL (임시테이블/CTE 기반)
    """
    cur.execute(f"""
        INSERT INTO company_cash_state (company_id, cash, updated_at)
        SELECT DISTINCT company_id, 0, NOW()
        FROM ({changed_company_source_sql}) s
        ON CONFLICT (company_id) DO NOTHING
    """)

    cur.execute(f"""
        INSERT INTO company_inventory_value_state (company_id, inventory_value, updated_at)
        SELECT DISTINCT company_id, 0, NOW()
        FROM ({changed_company_source_sql}) s
        ON CONFLICT (company_id) DO NOTHING
    """)

    cur.execute(f"""
        INSERT INTO company_valuation (company_id, cash, inventory_value, market_cap, updated_at)
        SELECT
            c.company_id,
            c.cash,
            i.inventory_value,
            c.cash + i.inventory_value AS market_cap,
            NOW()
        FROM company_cash_state c
        JOIN company_inventory_value_state i
          ON i.company_id = c.company_id
        WHERE c.company_id IN (SELECT company_id FROM ({changed_company_source_sql}) t)
        ON CONFLICT (company_id) DO UPDATE
        SET cash = EXCLUDED.cash,
            inventory_value = EXCLUDED.inventory_value,
            market_cap = EXCLUDED.market_cap,
            updated_at = EXCLUDED.updated_at
    """)

    cur.execute(f"""
        INSERT INTO ranking_outbox (company_id, market_cap, updated_at, synced_at)
        SELECT company_id, market_cap, NOW(), NULL
        FROM company_valuation
        WHERE company_id IN (SELECT company_id FROM ({changed_company_source_sql}) t)
        ON CONFLICT (company_id) DO UPDATE
        SET market_cap = EXCLUDED.market_cap,
            updated_at = EXCLUDED.updated_at,
            synced_at = NULL
    """)


# -----------------------------
# foreachBatch: cash
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

    an_conn = get_an_conn()
    should_apply = False
    staged = 0

    try:
        with an_conn.cursor() as cur:
            cur.execute("""
                CREATE TEMP TABLE tmp_cash_stage (
                    company_id BIGINT NOT NULL,
                    cash BIGINT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                ) ON COMMIT DROP
            """)

            staged = stage_dataframe_to_temp(
                cur,
                dedup_df,
                "tmp_cash_stage",
                ["company_id", "cash", "updated_at"],
            )

            if staged == 0:
                an_conn.commit()
                print(f"[CASH] batch={batch_id}, staged=0")
                return

            should_apply = claim_batch(cur, STREAM_CASH, batch_id)

            if should_apply:
                cur.execute("""
                    INSERT INTO company_cash_state (company_id, cash, updated_at)
                    SELECT company_id, cash, updated_at
                    FROM tmp_cash_stage
                    ON CONFLICT (company_id) DO UPDATE
                    SET cash = EXCLUDED.cash,
                        updated_at = EXCLUDED.updated_at
                    WHERE EXCLUDED.updated_at >= company_cash_state.updated_at
                """)

                refresh_company_valuation_and_outbox(
                    cur,
                    "SELECT DISTINCT company_id FROM tmp_cash_stage"
                )

        an_conn.commit()
        synced = sync_ranking_outbox_to_op()
        print(f"[CASH] batch={batch_id}, staged={staged}, replayed={not should_apply}, synced={synced}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()


# -----------------------------
# foreachBatch: warehouse
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

    an_conn = get_an_conn()
    should_apply = False
    staged = 0

    try:
        with an_conn.cursor() as cur:
            cur.execute("""
                CREATE TEMP TABLE tmp_qty_stage (
                    company_id BIGINT NOT NULL,
                    item_id BIGINT NOT NULL,
                    qty_delta BIGINT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                ) ON COMMIT DROP
            """)

            staged = stage_dataframe_to_temp(
                cur,
                agg_df,
                "tmp_qty_stage",
                ["company_id", "item_id", "qty_delta", "updated_at"],
            )

            if staged == 0:
                an_conn.commit()
                print(f"[WH] batch={batch_id}, staged=0")
                return

            should_apply = claim_batch(cur, STREAM_WH, batch_id)

            if should_apply:
                # old_qty와 합산 후 0 아래는 클램프해서 effective_delta 계산
                cur.execute("""
                    CREATE TEMP TABLE tmp_qty_effective AS
                    SELECT
                        s.company_id,
                        s.item_id,
                        s.updated_at,
                        COALESCE(q.qty, 0) AS old_qty,
                        s.qty_delta,
                        GREATEST(COALESCE(q.qty, 0) + s.qty_delta, 0) AS new_qty,
                        (GREATEST(COALESCE(q.qty, 0) + s.qty_delta, 0) - COALESCE(q.qty, 0)) AS effective_delta
                    FROM tmp_qty_stage s
                    LEFT JOIN company_item_qty_state q
                      ON q.company_id = s.company_id
                     AND q.item_id = s.item_id
                """)

                # qty는 effective_delta 기준으로만 반영
                cur.execute("""
                    INSERT INTO company_item_qty_state (company_id, item_id, qty, updated_at)
                    SELECT company_id, item_id, effective_delta, updated_at
                    FROM tmp_qty_effective
                    ON CONFLICT (company_id, item_id) DO UPDATE
                    SET qty = company_item_qty_state.qty + EXCLUDED.qty,
                        updated_at = GREATEST(company_item_qty_state.updated_at, EXCLUDED.updated_at)
                """)

                # inventory_value는 영향받은 회사만 현재 qty * 현재가격으로 재계산 (정합성 우선)
                cur.execute("""
                    INSERT INTO company_inventory_value_state (company_id, inventory_value, updated_at)
                    SELECT
                        q.company_id,
                        COALESCE(SUM(q.qty * COALESCE(p.last_price, 0)), 0)::BIGINT AS inventory_value,
                        NOW()
                    FROM company_item_qty_state q
                    LEFT JOIN item_price_state p
                      ON p.item_id = q.item_id
                    WHERE q.company_id IN (
                        SELECT DISTINCT company_id FROM tmp_qty_effective
                    )
                    GROUP BY q.company_id
                    ON CONFLICT (company_id) DO UPDATE
                    SET inventory_value = EXCLUDED.inventory_value,
                        updated_at = EXCLUDED.updated_at
                """)

                refresh_company_valuation_and_outbox(
                    cur,
                    "SELECT DISTINCT company_id FROM tmp_qty_effective"
                )

        an_conn.commit()
        synced = sync_ranking_outbox_to_op()
        print(f"[WH] batch={batch_id}, staged={staged}, replayed={not should_apply}, synced={synced}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()


# -----------------------------
# foreachBatch: trade
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

    an_conn = get_an_conn()
    should_apply = False
    staged = 0

    try:
        with an_conn.cursor() as cur:
            cur.execute("""
                CREATE TEMP TABLE tmp_price_stage (
                    item_id BIGINT NOT NULL,
                    last_price BIGINT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                ) ON COMMIT DROP
            """)

            staged = stage_dataframe_to_temp(
                cur,
                dedup_df,
                "tmp_price_stage",
                ["item_id", "last_price", "updated_at"],
            )

            if staged == 0:
                an_conn.commit()
                print(f"[PRICE] batch={batch_id}, staged=0")
                return

            should_apply = claim_batch(cur, STREAM_TR, batch_id)

            if should_apply:
                cur.execute("""
                    CREATE TEMP TABLE tmp_price_delta AS
                    SELECT
                        s.item_id,
                        s.last_price AS new_price,
                        COALESCE(p.last_price, 0) AS old_price,
                        (s.last_price - COALESCE(p.last_price, 0))::BIGINT AS price_delta,
                        s.updated_at
                    FROM tmp_price_stage s
                    LEFT JOIN item_price_state p
                      ON p.item_id = s.item_id
                """)

                cur.execute("""
                    INSERT INTO item_price_state (item_id, last_price, updated_at)
                    SELECT item_id, new_price, updated_at
                    FROM tmp_price_delta
                    ON CONFLICT (item_id) DO UPDATE
                    SET last_price = EXCLUDED.last_price,
                        updated_at = EXCLUDED.updated_at
                    WHERE EXCLUDED.updated_at >= item_price_state.updated_at
                """)

                cur.execute("""
                    CREATE TEMP TABLE tmp_company_price_delta AS
                    SELECT
                        q.company_id,
                        SUM((q.qty * d.price_delta))::BIGINT AS inventory_delta
                    FROM tmp_price_delta d
                    JOIN company_item_qty_state q
                      ON q.item_id = d.item_id
                    GROUP BY q.company_id
                """)

                cur.execute("""
                    INSERT INTO company_inventory_value_state (company_id, inventory_value, updated_at)
                    SELECT company_id, inventory_delta, NOW()
                    FROM tmp_company_price_delta
                    ON CONFLICT (company_id) DO UPDATE
                    SET inventory_value = company_inventory_value_state.inventory_value + EXCLUDED.inventory_value,
                        updated_at = EXCLUDED.updated_at
                """)

                refresh_company_valuation_and_outbox(
                    cur,
                    "SELECT DISTINCT company_id FROM tmp_company_price_delta"
                )

        an_conn.commit()
        synced = sync_ranking_outbox_to_op()
        print(f"[PRICE] batch={batch_id}, staged={staged}, replayed={not should_apply}, synced={synced}")
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
