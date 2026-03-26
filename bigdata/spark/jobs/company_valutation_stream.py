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
    when,
    length,
)
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, MapType
from pyspark.sql.window import Window


# ============================================================
# 목적
# - Kafka 이벤트(company, warehouse, trade)를 실시간으로 읽어서
#   1) 상태 테이블(company_cash_state, company_item_qty_state, item_price_state) 갱신
#   2) 회사 가치(company_valuation) 재계산
#   3) 운영 DB 랭킹(ranking_current) 동기화
#
# 구조
# - 이벤트 타입별로 3개 스트림(cash/warehouse/trade)을 별도 실행
# - 각 스트림은 foreachBatch에서 DB upsert 수행
# ============================================================


# -----------------------------
# Spark 세션
# -----------------------------
# appName: Spark UI/로그에서 잡 식별용
# WARN: INFO 로그 과다 출력 방지
spark = (
    SparkSession.builder
    .appName("CompanyValuationStream-Step4-StateAndValuation")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")


# -----------------------------
# Analytics DB 환경변수
# -----------------------------
# 상태/가치 계산 결과를 저장하는 분석 DB
AN_DB_HOST = os.getenv("ANALYTICS_DB_HOST", "analytics-postgres")
AN_DB_PORT = int(os.getenv("ANALYTICS_DB_PORT", "5432"))
AN_DB_NAME = os.getenv("ANALYTICS_DB_NAME", "ecosim_analytics")
AN_DB_USER = os.getenv("ANALYTICS_DB_USER", "ecosim")
AN_DB_PASSWORD = os.getenv("ANALYTICS_DB_PASSWORD", "ecosim")


# -----------------------------
# Operation DB 환경변수
# -----------------------------
# 최종 랭킹 테이블(ranking_current)을 반영할 운영 DB
OP_DB_HOST = os.getenv("OP_DB_HOST", "postgres-db")
OP_DB_PORT = int(os.getenv("OP_DB_PORT", "5432"))
OP_DB_NAME = os.getenv("OP_DB_NAME", "ecosim")
OP_DB_USER = os.getenv("OP_DB_USER", "ecosim")
OP_DB_PASSWORD = os.getenv("OP_DB_PASSWORD", "ecosim")


# -----------------------------
# Kafka/Streaming 환경변수
# -----------------------------
# maxOffsetsPerTrigger: 배치당 최대 읽기량 제한(과부하 방지)
# UPSERT_CHUNK_SIZE: DB 업서트를 몇 건씩 끊어서 처리할지
# STREAM_TRIGGER: 마이크로배치 주기
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPICS_STREAM = os.getenv(
    "KAFKA_TOPICS_STREAM",
    "company.events,warehouse.events,market.trade.events"
)
MAX_OFFSETS_PER_TRIGGER = int(os.getenv("MAX_OFFSETS_PER_TRIGGER", "5000"))
UPSERT_CHUNK_SIZE = int(os.getenv("UPSERT_CHUNK_SIZE", "1000"))
STREAM_TRIGGER = os.getenv("STREAM_TRIGGER", "5 seconds")

# checkpoint 위치: 재시작 시 오프셋/진행 상태 복구용
CKPT_BASE = os.getenv("VALUATION_CHECKPOINT_BASE", "/tmp/checkpoints")
CKPT_CASH = os.getenv("VALUATION_CASH_CHECKPOINT", f"{CKPT_BASE}/valuation-cash")
CKPT_WH = os.getenv("VALUATION_WH_CHECKPOINT", f"{CKPT_BASE}/valuation-wh")
CKPT_TR = os.getenv("VALUATION_TR_CHECKPOINT", f"{CKPT_BASE}/valuation-tr")


# -----------------------------
# 공통 envelope 스키마
# -----------------------------
# Kafka message value(JSON)를 표준 형태로 파싱
# payload는 이벤트 타입별 필드가 달라 Map<string,string>으로 처리
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
# 입력 포맷이 섞여도(updated_at null 방지) 안정적으로 timestamp 생성
# 우선순위:
# 1) epoch(ms)  2) epoch(sec)  3) ISO 문자열  4) kafka_timestamp  5) current_timestamp
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
# Kafka source
# -----------------------------
# startingOffsets=latest: 잡 시작 이후 신규 데이터 중심 처리
# failOnDataLoss=false: 토픽 보존/재할당 이슈로 일부 오프셋 손실 시 잡 중단 방지
raw = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
    .option("subscribe", KAFKA_TOPICS_STREAM)
    .option("startingOffsets", "latest")
    .option("maxOffsetsPerTrigger", MAX_OFFSETS_PER_TRIGGER)
    .option("failOnDataLoss", "false")
    .load()
)

# raw Kafka 레코드를 분석용 공통 컬럼으로 정리
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
# company_id는 payload -> partition_key -> aggregate_id 순으로 fallback
cash_events = (
    base.filter(col("event_type") == "company.cash.changed")
    .select(
        coalesce(
            col("payload").getItem("company_id"),
            col("partition_key"),
            col("aggregate_id")
        ).cast("bigint").alias("company_id"),
        col("payload").getItem("cash").cast("bigint").alias("cash"),
        parse_event_ts(
            coalesce(col("payload").getItem("changed_at"), col("occurred_at")),
            col("kafka_timestamp")
        ).alias("updated_at")
    )
    .filter(col("company_id").isNotNull() & col("cash").isNotNull() & col("updated_at").isNotNull())
)


# -----------------------------
# 정규화: warehouse.item.stored / removed
# -----------------------------
# stored/removed를 qty_delta 단일 모델로 통합
# removed는 음수 방향으로 반영
warehouse_events = (
    base.filter(col("event_type").isin("warehouse.item.stored", "warehouse.item.removed"))
    .select(
        col("event_type"),
        col("payload").getItem("company_id").cast("bigint").alias("company_id"),
        col("payload").getItem("item_id").cast("bigint").alias("item_id"),
        col("payload").getItem("quantity_delta").cast("bigint").alias("raw_qty_delta"),
        parse_event_ts(
            coalesce(
                col("payload").getItem("stored_at"),
                col("payload").getItem("removed_at"),
                col("occurred_at")
            ),
            col("kafka_timestamp")
        ).alias("updated_at")
    )
    .filter(
        col("company_id").isNotNull()
        & col("item_id").isNotNull()
        & col("raw_qty_delta").isNotNull()
        & col("updated_at").isNotNull()
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
# matched_price 우선, 없으면 price 사용
trade_events = (
    base.filter(col("event_type") == "market.trade.executed")
    .select(
        col("payload").getItem("item_id").cast("bigint").alias("item_id"),
        coalesce(
            col("payload").getItem("matched_price"),
            col("payload").getItem("price")
        ).cast("bigint").alias("last_price"),
        parse_event_ts(
            coalesce(col("payload").getItem("executed_at"), col("occurred_at")),
            col("kafka_timestamp")
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
# autocommit=False: 배치 단위 commit/rollback 제어
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


# 중복 제거 + 정렬로 재계산 대상 최소화
def normalize_company_ids(company_ids: List[int]) -> List[int]:
    if not company_ids:
        return []
    return sorted(set(int(x) for x in company_ids if x is not None))


# collect() 대신 iterator를 chunk로 나눠 메모리 피크 완화
def iter_chunks(df, cols: List[str], chunk_size: int):
    chunk = []
    for r in df.select(*cols).toLocalIterator():
        chunk.append(r)
        if len(chunk) >= chunk_size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


# -----------------------------
# 가치 재계산: 변경된 company_id만
# -----------------------------
# inventory_value = 회사별(수량 * 최신가격) 합
# market_cap = cash + inventory_value
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
# -----------------------------
# analytics 결과를 운영 DB ranking_current로 반영
# company 테이블과 조인하여 유효한 company_id만 upsert
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
# 배치 내 같은 company_id가 여러 건이면 최신(updated_at desc) 1건만 반영
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

    changed_company_ids: List[int] = []
    upserted = 0

    an_conn = get_an_conn()
    try:
        with an_conn.cursor() as an_cur:
            for rows in iter_chunks(dedup_df, ["company_id", "cash", "updated_at"], UPSERT_CHUNK_SIZE):
                data = [(int(r["company_id"]), int(r["cash"]), r["updated_at"]) for r in rows]
                if not data:
                    continue

                changed_company_ids.extend(int(r["company_id"]) for r in rows)
                upserted += len(data)

                execute_values(an_cur, """
                    INSERT INTO company_cash_state (company_id, cash, updated_at)
                    VALUES %s
                    ON CONFLICT (company_id) DO UPDATE
                    SET cash = EXCLUDED.cash,
                        updated_at = EXCLUDED.updated_at
                """, data, page_size=UPSERT_CHUNK_SIZE)

            if upserted == 0:
                an_conn.commit()
                print(f"[CASH] batch={batch_id}, upserted=0")
                return

            recompute_company_valuation_for_companies(an_cur, changed_company_ids)

        an_conn.commit()
        sync_ranking_current(changed_company_ids)
        print(f"[CASH] batch={batch_id}, upserted={upserted}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()


# -----------------------------
# foreachBatch: qty state
# -----------------------------
# (company_id, item_id) 단위로 qty_delta 합산해서 1건으로 업서트
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

    changed_company_ids: List[int] = []
    upserted = 0

    an_conn = get_an_conn()
    try:
        with an_conn.cursor() as an_cur:
            for rows in iter_chunks(agg_df, ["company_id", "item_id", "qty_delta", "updated_at"], UPSERT_CHUNK_SIZE):
                data = [(int(r["company_id"]), int(r["item_id"]), int(r["qty_delta"]), r["updated_at"]) for r in rows]
                if not data:
                    continue

                changed_company_ids.extend(int(r["company_id"]) for r in rows)
                upserted += len(data)

                execute_values(an_cur, """
                    INSERT INTO company_item_qty_state (company_id, item_id, qty, updated_at)
                    VALUES %s
                    ON CONFLICT (company_id, item_id) DO UPDATE
                    SET qty = company_item_qty_state.qty + EXCLUDED.qty,
                        updated_at = GREATEST(company_item_qty_state.updated_at, EXCLUDED.updated_at)
                """, data, page_size=UPSERT_CHUNK_SIZE)

            if upserted == 0:
                an_conn.commit()
                print(f"[WH] batch={batch_id}, upserted=0")
                return

            # 음수 재고 방어
            an_cur.execute("""
                UPDATE company_item_qty_state
                SET qty = 0
                WHERE qty < 0
            """)

            recompute_company_valuation_for_companies(an_cur, changed_company_ids)

        an_conn.commit()
        sync_ranking_current(changed_company_ids)
        print(f"[WH] batch={batch_id}, upserted={upserted}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()


# -----------------------------
# foreachBatch: price state
# -----------------------------
# 배치 내 item별 최신 가격 1건만 반영
# 가격 변화 item을 가진 company만 골라 가치 재계산
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

    changed_item_ids: List[int] = []
    upserted = 0
    changed_company_ids: List[int] = []

    an_conn = get_an_conn()
    try:
        with an_conn.cursor() as an_cur:
            for rows in iter_chunks(dedup_df, ["item_id", "last_price", "updated_at"], UPSERT_CHUNK_SIZE):
                data = [(int(r["item_id"]), int(r["last_price"]), r["updated_at"]) for r in rows]
                if not data:
                    continue

                changed_item_ids.extend(int(r["item_id"]) for r in rows)
                upserted += len(data)

                execute_values(an_cur, """
                    INSERT INTO item_price_state (item_id, last_price, updated_at)
                    VALUES %s
                    ON CONFLICT (item_id) DO UPDATE
                    SET last_price = EXCLUDED.last_price,
                        updated_at = EXCLUDED.updated_at
                """, data, page_size=UPSERT_CHUNK_SIZE)

            if upserted == 0:
                an_conn.commit()
                print(f"[PRICE] batch={batch_id}, upserted=0")
                return

            an_cur.execute("""
                SELECT DISTINCT company_id
                FROM company_item_qty_state
                WHERE item_id = ANY(%s)
            """, (changed_item_ids,))
            changed_company_ids = [int(r[0]) for r in an_cur.fetchall()]

            recompute_company_valuation_for_companies(an_cur, changed_company_ids)

        an_conn.commit()
        sync_ranking_current(changed_company_ids)
        print(f"[PRICE] batch={batch_id}, upserted={upserted}")
    except Exception:
        an_conn.rollback()
        raise
    finally:
        an_conn.close()


# -----------------------------
# Streaming Queries
# -----------------------------
# 이벤트 타입별 독립 스트림
# outputMode=append:
# - foreachBatch sink에서는 append 사용이 일반적
# trigger:
# - 배치 주기(기본 5초)
# checkpoint:
# - 장애 복구 시 오프셋/진행 상태 복원
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
