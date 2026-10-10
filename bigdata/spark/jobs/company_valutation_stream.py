"""Stream current company valuations from Kafka change notifications.

The operational PostgreSQL tables are the source of truth for company cash and
warehouse stock. Kafka tells this job which companies (or item prices) changed.
Only the latest trade price is materialized locally because a trade is produced
to Kafka before the asynchronous trade-history consumer writes it to PostgreSQL.
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

import psycopg2
from psycopg2.extras import execute_values
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json
from pyspark.sql.types import IntegerType, MapType, StringType, StructField, StructType


DB_HOST = os.getenv("DB_HOST", "postgres-db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "ecosim")
DB_USER = os.getenv("DB_USER", "ecosim")
DB_PASSWORD = os.getenv("DB_PASSWORD", "ecosim")

KAFKA_BOOTSTRAP = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS", "kafka:29092,kafka-2:29092,kafka-3:29092"
)
KAFKA_TOPICS = os.getenv(
    "KAFKA_TOPICS_STREAM",
    "company.events,warehouse.events,market.trade.events",
)
TRIGGER_INTERVAL = os.getenv("VALUATION_TRIGGER_INTERVAL", "2 seconds")
MAX_OFFSETS_PER_TRIGGER = int(os.getenv("VALUATION_MAX_OFFSETS_PER_TRIGGER", "1000"))
CHECKPOINT_LOCATION = os.getenv(
    "VALUATION_CHECKPOINT_LOCATION", "/tmp/checkpoints/company-valuation-v2"
)

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


def get_connection():
    connection = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    connection.autocommit = False
    return connection


def as_int(value: Any) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def parse_event_time(value: Optional[str]) -> datetime:
    """Normalize ISO-8601, seconds, milliseconds, and scientific epochs to UTC."""
    if value:
        try:
            epoch = float(value)
            if epoch > 10_000_000_000:
                epoch /= 1000
            return datetime.fromtimestamp(epoch, tz=timezone.utc)
        except (TypeError, ValueError, OverflowError, OSError):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                pass
    return datetime.now(timezone.utc)


def event_time(payload: Dict[str, str], fields: Iterable[str], fallback: Optional[str]) -> datetime:
    for field in fields:
        value = payload.get(field)
        if value:
            return parse_event_time(value)
    return parse_event_time(fallback)


def newer(current: Optional[Tuple[int, datetime]], candidate_time: datetime) -> bool:
    return current is None or candidate_time >= current[1]


def recompute_valuations(cursor, company_ids: Iterable[int]) -> List[Tuple[int, int]]:
    """Read cash and stock from operational tables and upsert only changed companies."""
    target_ids = sorted(set(company_ids))
    if not target_ids:
        return []

    cursor.execute(
        """
        WITH targets AS (
            SELECT UNNEST(%s::bigint[]) AS company_id
        ), inventory AS (
            SELECT
                warehouse.company_id,
                SUM(slot.quantity * price.last_price)::bigint AS inventory_value
            FROM warehouse
            JOIN warehouse_slot slot ON slot.warehouse_id = warehouse.warehouse_id
            JOIN item_price_state price ON price.item_id = slot.item_id
            WHERE warehouse.company_id IN (SELECT company_id FROM targets)
              AND slot.item_id IS NOT NULL
              AND slot.quantity > 0
            GROUP BY warehouse.company_id
        )
        INSERT INTO company_valuation (company_id, cash, inventory_value, market_cap, updated_at)
        SELECT
            company.company_id,
            company.cash,
            COALESCE(inventory.inventory_value, 0),
            company.cash + COALESCE(inventory.inventory_value, 0),
            NOW()
        FROM company
        JOIN targets ON targets.company_id = company.company_id
        LEFT JOIN inventory ON inventory.company_id = company.company_id
        ON CONFLICT (company_id) DO UPDATE
        SET cash = EXCLUDED.cash,
            inventory_value = EXCLUDED.inventory_value,
            market_cap = EXCLUDED.market_cap,
            updated_at = EXCLUDED.updated_at
        RETURNING company_id, market_cap
        """,
        (target_ids,),
    )
    return [(int(company_id), int(market_cap)) for company_id, market_cap in cursor.fetchall()]


def sync_ranking_current(cursor, valuations: List[Tuple[int, int]]) -> None:
    if not valuations:
        return

    execute_values(
        cursor,
        """
        INSERT INTO ranking_current (company_id, valuation, ranking_updated_at)
        SELECT value.company_id, value.valuation, NOW()
        FROM (VALUES %s) AS value(company_id, valuation)
        JOIN company ON company.company_id = value.company_id
        ON CONFLICT (company_id) DO UPDATE
        SET valuation = EXCLUDED.valuation,
            ranking_updated_at = EXCLUDED.ranking_updated_at
        """,
        valuations,
        template="(%s, %s)",
        page_size=1000,
    )


def affected_company_ids(cursor, item_ids: Iterable[int]) -> Set[int]:
    """Find companies whose warehouse currently contains a repriced item."""
    ids = sorted(set(item_ids))
    if not ids:
        return set()
    cursor.execute(
        """
        SELECT DISTINCT warehouse.company_id
        FROM warehouse
        JOIN warehouse_slot slot ON slot.warehouse_id = warehouse.warehouse_id
        WHERE slot.item_id = ANY(%s)
          AND slot.quantity > 0
        """,
        (ids,),
    )
    return {int(row[0]) for row in cursor.fetchall()}


def bootstrap_current_valuations() -> None:
    """Rebuild current values before consuming only new Kafka events."""
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO item_price_state (item_id, last_price, updated_at)
                SELECT DISTINCT ON (item_id)
                    item_id,
                    close_price,
                    NOW()
                FROM market_candle
                WHERE candle_type = 'MIN_1'
                ORDER BY item_id, candle_time DESC
                ON CONFLICT (item_id) DO UPDATE
                SET last_price = EXCLUDED.last_price,
                    updated_at = EXCLUDED.updated_at
                """
            )
            cursor.execute("SELECT company_id FROM company")
            company_ids = [int(row[0]) for row in cursor.fetchall()]
            valuations = recompute_valuations(cursor, company_ids)
            sync_ranking_current(cursor, valuations)
        connection.commit()
        print(
            f"[VALUATION] bootstrap companies={len(company_ids)}, "
            f"valuations={len(valuations)}"
        )
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def process_batch(batch_df, batch_id: int) -> None:
    """Deduplicate Kafka events, update prices, then calculate affected companies."""
    rows = batch_df.select(
        "event_id", "event_type", "occurred_at", "partition_key", "aggregate_id", "payload"
    ).collect()
    events = [
        {
            "event_id": row["event_id"],
            "event_type": row["event_type"],
            "occurred_at": row["occurred_at"],
            "partition_key": row["partition_key"],
            "aggregate_id": row["aggregate_id"],
            "payload": row["payload"] or {},
        }
        for row in rows
        if row["event_id"]
    ]
    if not events:
        return

    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            execute_values(
                cursor,
                """
                INSERT INTO valuation_processed_event (event_id)
                VALUES %s
                ON CONFLICT (event_id) DO NOTHING
                RETURNING event_id
                """,
                [(event["event_id"],) for event in events],
                template="(%s)",
                page_size=1000,
            )
            new_event_ids = {row[0] for row in cursor.fetchall()}
            events = [event for event in events if event["event_id"] in new_event_ids]
            if not events:
                connection.commit()
                return

            changed_company_ids: Set[int] = set()
            price_by_item: Dict[int, Tuple[int, datetime]] = {}

            for event in events:
                payload = event["payload"]
                event_type = event["event_type"]

                if event_type == "company.cash.changed":
                    company_id = as_int(
                        payload.get("company_id")
                        or event["partition_key"]
                        or event["aggregate_id"]
                    )
                    if company_id is not None:
                        changed_company_ids.add(company_id)

                elif event_type in ("warehouse.item.stored", "warehouse.item.removed"):
                    company_id = as_int(payload.get("company_id") or event["partition_key"])
                    if company_id is not None:
                        changed_company_ids.add(company_id)

                elif event_type == "market.trade.executed":
                    item_id = as_int(payload.get("item_id"))
                    price = as_int(
                        payload.get("matched_price")
                        or payload.get("trade_price")
                        or payload.get("price")
                    )
                    updated_at = event_time(payload, ("executed_at",), event["occurred_at"])
                    current = price_by_item.get(item_id) if item_id is not None else None
                    if item_id is not None and price is not None and newer(current, updated_at):
                        price_by_item[item_id] = (price, updated_at)

            if price_by_item:
                execute_values(
                    cursor,
                    """
                    INSERT INTO item_price_state (item_id, last_price, updated_at)
                    VALUES %s
                    ON CONFLICT (item_id) DO UPDATE
                    SET last_price = EXCLUDED.last_price,
                        updated_at = EXCLUDED.updated_at
                    WHERE EXCLUDED.updated_at >= item_price_state.updated_at
                    """,
                    [
                        (item_id, price, updated_at)
                        for item_id, (price, updated_at) in price_by_item.items()
                    ],
                    page_size=1000,
                )
                changed_company_ids.update(affected_company_ids(cursor, price_by_item))

            valuations = recompute_valuations(cursor, changed_company_ids)
            sync_ranking_current(cursor, valuations)

        connection.commit()
        print(
            f"[VALUATION] batch={batch_id}, events={len(events)}, "
            f"companies={len(changed_company_ids)}, valuations={len(valuations)}"
        )
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


bootstrap_current_valuations()

spark = SparkSession.builder.appName("CompanyValuationStream").getOrCreate()
spark.sparkContext.setLogLevel("WARN")

raw_events = (
    spark.readStream.format("kafka")
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
    .option("subscribe", KAFKA_TOPICS)
    .option("startingOffsets", "latest")
    .option("maxOffsetsPerTrigger", MAX_OFFSETS_PER_TRIGGER)
    .load()
)

events = (
    raw_events.selectExpr("CAST(value AS STRING) AS raw_json")
    .withColumn("envelope", from_json(col("raw_json"), envelope_schema))
    .select("envelope.*")
    .filter(col("event_type").isin(
        "company.cash.changed",
        "warehouse.item.stored",
        "warehouse.item.removed",
        "market.trade.executed",
    ))
)

query = (
    events.writeStream.foreachBatch(process_batch)
    .outputMode("append")
    .option("checkpointLocation", CHECKPOINT_LOCATION)
    .trigger(processingTime=TRIGGER_INTERVAL)
    .start()
)

query.awaitTermination()
