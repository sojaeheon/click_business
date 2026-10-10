import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib import request

import psycopg2
from psycopg2.extras import RealDictCursor
from pyspark.sql import Column, DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.storagelevel import StorageLevel
from pyspark.sql.types import StringType, StructField, StructType


DEFAULT_ORDER_PATH = "hdfs://namenode:9000/raw/kafka/topic=market.order.events"
DEFAULT_TRADE_PATH = "hdfs://namenode:9000/raw/kafka/topic=market.trade.events"
DEFAULT_ORDER_CURATED_PATH = "hdfs://namenode:9000/curated/kafka/topic=market.order.events"
DEFAULT_TRADE_CURATED_PATH = "hdfs://namenode:9000/curated/kafka/topic=market.trade.events"
DEFAULT_CHECKPOINT_PATH = "/tmp/checkpoints/market-news-stream"

ORDER_INPUT_SCHEMA = StructType([
    StructField("kafka_topic", StringType(), True),
    StructField("kafka_timestamp", StringType(), True),
    StructField("ingested_at", StringType(), True),
    StructField("event_raw", StringType(), True),
    StructField("item_id", StringType(), True),
    StructField("side", StringType(), True),
    StructField("price", StringType(), True),
    StructField("quantity", StringType(), True),
    StructField("is_virtual", StringType(), True),
    StructField("event_type", StringType(), True),
    StructField("created_at", StringType(), True),
    StructField("cancelled_at", StringType(), True),
    StructField("occurred_at", StringType(), True),
])

TRADE_INPUT_SCHEMA = StructType([
    StructField("kafka_topic", StringType(), True),
    StructField("kafka_timestamp", StringType(), True),
    StructField("ingested_at", StringType(), True),
    StructField("event_type", StringType(), True),
    StructField("event_raw", StringType(), True),
    StructField("item_id", StringType(), True),
    StructField("price", StringType(), True),
    StructField("quantity", StringType(), True),
    StructField("executed_at", StringType(), True),
    StructField("occurred_at", StringType(), True),
])

ORDER_ENVELOPE_SCHEMA = StructType([
    StructField("event_type", StringType(), True),
    StructField("occurred_at", StringType(), True),
    StructField("payload", StructType([
        StructField("item_id", StringType(), True),
        StructField("side", StringType(), True),
        StructField("price", StringType(), True),
        StructField("quantity", StringType(), True),
        StructField("is_virtual", StringType(), True),
        StructField("created_at", StringType(), True),
        StructField("cancelled_at", StringType(), True),
    ]), True),
])

TRADE_ENVELOPE_SCHEMA = StructType([
    StructField("event_type", StringType(), True),
    StructField("occurred_at", StringType(), True),
    StructField("payload", StructType([
        StructField("item_id", StringType(), True),
        StructField("price", StringType(), True),
        StructField("quantity", StringType(), True),
        StructField("executed_at", StringType(), True),
    ]), True),
])

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "ecosim")
DB_USER = os.getenv("DB_USER", "ecosim")
DB_PASSWORD = os.getenv("DB_PASSWORD", "ecosim")

NEWS_GLOBAL_COOLDOWN_MINUTES = int(os.getenv("NEWS_GLOBAL_COOLDOWN_MINUTES", "10"))
NEWS_SIGNAL_COOLDOWN_MINUTES = int(os.getenv("NEWS_SIGNAL_COOLDOWN_MINUTES", "10"))
NEWS_MIN_SEVERITY_SCORE = float(os.getenv("NEWS_MIN_SEVERITY_SCORE", "85.0"))
MARKET_NEWS_SHUFFLE_PARTITIONS = int(os.getenv("MARKET_NEWS_SHUFFLE_PARTITIONS", "4"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("GMS_KEY", "")
OPENAI_BASE_URL = os.getenv(
    "OPENAI_BASE_URL",
    "https://gms.ssafy.io/gmsapi/api.openai.com/v1/chat/completions",
)
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT_SECONDS = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "20"))


@dataclass
class Candidate:
    item_id: int
    signal_type: str
    severity_score: float
    headline: str
    summary: str
    reference_time: str
    dedupe_key: str
    raw: Dict[str, Any]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate and publish market news directly from raw HDFS events."
    )
    parser.add_argument("--order-path", default=DEFAULT_ORDER_PATH)
    parser.add_argument("--trade-path", default=DEFAULT_TRADE_PATH)
    parser.add_argument("--order-curated-path", default=DEFAULT_ORDER_CURATED_PATH)
    parser.add_argument("--trade-curated-path", default=DEFAULT_TRADE_CURATED_PATH)
    parser.add_argument("--window-minutes", type=int, default=10)
    parser.add_argument("--reference-time", default=None)
    parser.add_argument("--min-trade-qty", type=float, default=200.0)
    parser.add_argument("--min-order-qty", type=float, default=300.0)
    parser.add_argument("--price-change-threshold", type=float, default=0.005)
    parser.add_argument("--volume-spike-threshold", type=float, default=1.0)
    parser.add_argument("--volume-drop-threshold", type=float, default=-0.5)
    parser.add_argument("--volume-drop-min-previous-qty", type=float, default=3000.0)
    parser.add_argument("--min-market-activity-qty", type=float, default=200.0)
    parser.add_argument("--pressure-ratio-threshold", type=float, default=1.8)
    parser.add_argument("--cancel-rate-threshold", type=float, default=0.5)
    parser.add_argument("--trigger-interval", default="10 minutes")
    parser.add_argument("--checkpoint-path", default=DEFAULT_CHECKPOINT_PATH)
    parser.add_argument("--rows-per-second", type=int, default=1)
    return parser


def parse_args() -> argparse.Namespace:
    return build_parser().parse_args()


def build_spark_session() -> SparkSession:
    spark = (
        SparkSession.builder.appName("market-news-stream")
        .config("spark.sql.session.timeZone", "Asia/Seoul")
        .config("spark.sql.shuffle.partitions", str(MARKET_NEWS_SHUFFLE_PARTITIONS))
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    return spark


def parse_reference_time(reference_time: Optional[str]) -> datetime:
    if not reference_time:
        return datetime.now()

    normalized = reference_time.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def apply_reference_lag(reference_time: datetime, lag_minutes: int = 1) -> datetime:
    aligned = reference_time.replace(second=0, microsecond=0)
    return aligned - timedelta(minutes=lag_minutes)


def resolve_reference_time(batch_df, override_reference_time: Optional[str]) -> datetime:
    if override_reference_time:
        return parse_reference_time(override_reference_time)

    row = batch_df.agg(F.max("timestamp").alias("max_ts")).collect()[0]
    if row["max_ts"] is None:
        return datetime.now()
    return row["max_ts"]


def hdfs_path_exists(spark: SparkSession, path: str) -> bool:
    hadoop_path = spark.sparkContext._jvm.org.apache.hadoop.fs.Path(path)
    filesystem = hadoop_path.getFileSystem(
        spark.sparkContext._jsc.hadoopConfiguration()
    )
    return filesystem.exists(hadoop_path)


def expand_hdfs_glob(spark: SparkSession, pattern: str) -> List[str]:
    hadoop_path = spark.sparkContext._jvm.org.apache.hadoop.fs.Path(pattern)
    filesystem = hadoop_path.getFileSystem(spark.sparkContext._jsc.hadoopConfiguration())
    statuses = filesystem.globStatus(hadoop_path)
    if not statuses:
        return []
    return [status.getPath().toString() for status in statuses]


def read_event_window(
    spark: SparkSession,
    raw_path: str,
    curated_path: str,
    schema: StructType,
    window_start: datetime,
    window_end: datetime,
) -> DataFrame:
    if not hdfs_path_exists(spark, raw_path):
        print(f"[MARKET-NEWS-STREAM] input path is absent; skipped: {raw_path}")
        return spark.createDataFrame([], schema)

    current_hour = window_start.replace(minute=0, second=0, microsecond=0)
    last_hour = window_end.replace(minute=0, second=0, microsecond=0)
    raw_input_paths: List[str] = []
    parquet_input_paths: List[str] = []
    while current_hour <= last_hour:
        curated_hour_path = (
            f"{curated_path}/dt={current_hour:%Y-%m-%d}/hour={current_hour:%H}"
        )
        if current_hour < last_hour and hdfs_path_exists(spark, curated_hour_path):
            parquet_input_paths.append(curated_hour_path)
        else:
            pattern = (
                f"{raw_path}/event_type=*/dt={current_hour:%Y-%m-%d}/hour={current_hour:%H}"
            )
            raw_input_paths.extend(expand_hdfs_glob(spark, pattern))
        current_hour += timedelta(hours=1)

    frames: List[DataFrame] = []
    if parquet_input_paths:
        frames.append(spark.read.schema(schema).parquet(*parquet_input_paths))
    if raw_input_paths:
        frames.append(
            spark.read.schema(schema)
            .option("recursiveFileLookup", "true")
            .option("pathGlobFilter", "*.jsonl")
            .json(raw_input_paths)
        )

    if not frames:
        print(
            "[MARKET-NEWS-STREAM] no HDFS partitions in window: "
            f"path={raw_path} start={window_start.isoformat()} end={window_end.isoformat()}"
        )
        return spark.createDataFrame([], schema)

    print(
        "[MARKET-NEWS-STREAM] input sources: "
        f"curated_hours={len(parquet_input_paths)} raw_hours={len(raw_input_paths)}",
        flush=True,
    )

    result = frames[0]
    for frame in frames[1:]:
        result = result.unionByName(frame, allowMissingColumns=True)
    return result


def flexible_timestamp(column: Column) -> Column:
    numeric_epoch = column.cast("double")
    return F.when(
        numeric_epoch.isNotNull(),
        F.to_timestamp(F.from_unixtime(numeric_epoch)),
    ).otherwise(F.to_timestamp(column))


def normalize_orders(raw_orders: DataFrame) -> DataFrame:
    decoded = F.from_json(F.col("event_raw"), ORDER_ENVELOPE_SCHEMA)
    normalized = raw_orders.withColumn("decoded", decoded)
    occurred_at = F.coalesce(
        F.col("occurred_at"),
        F.col("decoded.occurred_at"),
        F.col("ingested_at"),
    )

    return (
        normalized.select(
            F.coalesce(F.col("item_id"), F.col("decoded.payload.item_id")).cast("int").alias("item_id"),
            F.upper(F.coalesce(F.col("side"), F.col("decoded.payload.side"))).alias("side"),
            F.coalesce(F.col("price"), F.col("decoded.payload.price")).cast("double").alias("price"),
            F.coalesce(F.col("quantity"), F.col("decoded.payload.quantity")).cast("double").alias("quantity"),
            F.coalesce(F.col("is_virtual"), F.col("decoded.payload.is_virtual")).cast("boolean").alias("is_virtual"),
            F.coalesce(F.col("event_type"), F.col("decoded.event_type")).alias("event_type"),
            flexible_timestamp(occurred_at).alias("event_ts"),
        )
        .where(F.col("item_id").isNotNull() & F.col("event_ts").isNotNull())
        .withColumn(
            "event_kind",
            F.when(F.col("event_type") == "market.order.created", F.lit("CREATED"))
            .when(F.col("event_type") == "market.order.cancelled", F.lit("CANCELLED"))
            .otherwise(F.lit("OTHER")),
        )
    )


def normalize_trades(raw_trades: DataFrame) -> DataFrame:
    decoded = F.from_json(F.col("event_raw"), TRADE_ENVELOPE_SCHEMA)
    normalized = raw_trades.withColumn("decoded", decoded)
    occurred_at = F.coalesce(
        F.col("occurred_at"),
        F.col("decoded.occurred_at"),
        F.col("ingested_at"),
    )

    return (
        normalized.select(
            F.coalesce(F.col("item_id"), F.col("decoded.payload.item_id")).cast("int").alias("item_id"),
            F.coalesce(F.col("price"), F.col("decoded.payload.price")).cast("double").alias("price"),
            F.coalesce(F.col("quantity"), F.col("decoded.payload.quantity")).cast("double").alias("quantity"),
            flexible_timestamp(occurred_at).alias("event_ts"),
        )
        .where(F.col("item_id").isNotNull() & F.col("event_ts").isNotNull())
    )


def bucketize(
    df: DataFrame,
    previous_start: datetime,
    current_start: datetime,
    reference_time: datetime,
) -> DataFrame:
    return (
        df.where(
            (F.col("event_ts") >= F.lit(previous_start))
            & (F.col("event_ts") < F.lit(reference_time))
        )
        .withColumn(
            "window_label",
            F.when(F.col("event_ts") >= F.lit(current_start), F.lit("current")).otherwise(
                F.lit("previous")
            ),
        )
    )


def aggregate_order_metrics(orders: DataFrame) -> DataFrame:
    return orders.groupBy("item_id", "window_label").agg(
        F.sum(
            F.when(
                (F.col("event_kind") == "CREATED") & (F.col("side") == "BUY"),
                F.col("quantity"),
            ).otherwise(F.lit(0.0))
        ).alias("buy_created_qty"),
        F.sum(
            F.when(
                (F.col("event_kind") == "CREATED") & (F.col("side") == "SELL"),
                F.col("quantity"),
            ).otherwise(F.lit(0.0))
        ).alias("sell_created_qty"),
        F.sum(
            F.when(
                (F.col("event_kind") == "CANCELLED") & (F.col("side") == "BUY"),
                F.col("quantity"),
            ).otherwise(F.lit(0.0))
        ).alias("buy_cancelled_qty"),
        F.sum(
            F.when(
                (F.col("event_kind") == "CANCELLED") & (F.col("side") == "SELL"),
                F.col("quantity"),
            ).otherwise(F.lit(0.0))
        ).alias("sell_cancelled_qty"),
        F.sum(F.when(F.col("event_kind") == "CREATED", F.col("quantity")).otherwise(F.lit(0.0))).alias(
            "created_qty"
        ),
        F.sum(F.when(F.col("event_kind") == "CANCELLED", F.col("quantity")).otherwise(F.lit(0.0))).alias(
            "cancelled_qty"
        ),
        F.sum(F.when(F.col("event_kind") == "CREATED", F.lit(1)).otherwise(F.lit(0))).alias(
            "created_count"
        ),
        F.sum(F.when(F.col("event_kind") == "CANCELLED", F.lit(1)).otherwise(F.lit(0))).alias(
            "cancelled_count"
        ),
        F.avg(F.when(F.col("event_kind") == "CREATED", F.col("price"))).alias("avg_order_price"),
    )


def aggregate_trade_metrics(trades: DataFrame) -> DataFrame:
    return trades.groupBy("item_id", "window_label").agg(
        F.sum("quantity").alias("trade_qty"),
        F.sum(F.col("quantity") * F.col("price")).alias("trade_notional"),
        F.count(F.lit(1)).alias("trade_count"),
        F.avg("price").alias("avg_trade_price"),
        F.max_by("price", "event_ts").alias("last_trade_price"),
    )


def pivot_metrics(metrics_df: DataFrame, metric_columns: List[str]) -> DataFrame:
    return metrics_df.groupBy("item_id").pivot("window_label", ["current", "previous"]).agg(
        *[F.first(column).alias(column) for column in metric_columns]
    )


def with_default(df: DataFrame, column_name: str, default_value, data_type: str) -> DataFrame:
    if column_name not in df.columns:
        return df.withColumn(column_name, F.lit(default_value).cast(data_type))

    return df.withColumn(
        column_name,
        F.coalesce(F.col(column_name), F.lit(default_value).cast(data_type)),
    )


def safe_ratio(numerator: str, denominator: str) -> F.Column:
    return F.when(F.col(denominator).isNull() | (F.col(denominator) == 0), F.lit(None)).otherwise(
        F.col(numerator) / F.col(denominator)
    )


def compute_item_metrics(order_metrics: DataFrame, trade_metrics: DataFrame) -> DataFrame:
    order_metric_columns = [
        "buy_created_qty",
        "sell_created_qty",
        "buy_cancelled_qty",
        "sell_cancelled_qty",
        "created_qty",
        "cancelled_qty",
        "created_count",
        "cancelled_count",
        "avg_order_price",
    ]
    trade_metric_columns = [
        "trade_qty",
        "trade_notional",
        "trade_count",
        "avg_trade_price",
        "last_trade_price",
    ]

    orders_pivoted = pivot_metrics(order_metrics, order_metric_columns)
    trades_pivoted = pivot_metrics(trade_metrics, trade_metric_columns)
    item_metrics = orders_pivoted.join(trades_pivoted, on="item_id", how="full_outer")

    defaults = [
        ("current_buy_created_qty", 0.0, "double"),
        ("current_sell_created_qty", 0.0, "double"),
        ("current_buy_cancelled_qty", 0.0, "double"),
        ("current_sell_cancelled_qty", 0.0, "double"),
        ("current_created_qty", 0.0, "double"),
        ("current_cancelled_qty", 0.0, "double"),
        ("current_created_count", 0, "long"),
        ("current_cancelled_count", 0, "long"),
        ("previous_buy_created_qty", 0.0, "double"),
        ("previous_sell_created_qty", 0.0, "double"),
        ("previous_buy_cancelled_qty", 0.0, "double"),
        ("previous_sell_cancelled_qty", 0.0, "double"),
        ("previous_created_qty", 0.0, "double"),
        ("previous_cancelled_qty", 0.0, "double"),
        ("previous_created_count", 0, "long"),
        ("previous_cancelled_count", 0, "long"),
        ("current_trade_qty", 0.0, "double"),
        ("previous_trade_qty", 0.0, "double"),
        ("current_trade_notional", 0.0, "double"),
        ("previous_trade_notional", 0.0, "double"),
        ("current_trade_count", 0, "long"),
        ("previous_trade_count", 0, "long"),
    ]

    for column_name, default_value, data_type in defaults:
        item_metrics = with_default(item_metrics, column_name, default_value, data_type)

    return (
        item_metrics.withColumn(
            "current_vwap",
            F.when(F.col("current_trade_qty") > 0, F.col("current_trade_notional") / F.col("current_trade_qty")),
        )
        .withColumn(
            "previous_vwap",
            F.when(F.col("previous_trade_qty") > 0, F.col("previous_trade_notional") / F.col("previous_trade_qty")),
        )
        .withColumn("price_change_rate", safe_ratio("current_vwap", "previous_vwap") - F.lit(1.0))
        .withColumn("trade_volume_change_rate", safe_ratio("current_trade_qty", "previous_trade_qty") - F.lit(1.0))
        .withColumn("buy_pressure_ratio", safe_ratio("current_buy_created_qty", "current_sell_created_qty"))
        .withColumn("sell_pressure_ratio", safe_ratio("current_sell_created_qty", "current_buy_created_qty"))
        .withColumn("cancel_rate", safe_ratio("current_cancelled_qty", "current_created_qty"))
        .withColumn("cancel_change_rate", safe_ratio("current_cancelled_qty", "previous_cancelled_qty") - F.lit(1.0))
        .withColumn(
            "current_market_activity_qty",
            F.col("current_trade_qty") + F.col("current_created_qty") + F.col("current_cancelled_qty"),
        )
        .withColumn(
            "net_buy_flow",
            (F.col("current_buy_created_qty") - F.col("current_buy_cancelled_qty"))
            - (F.col("current_sell_created_qty") - F.col("current_sell_cancelled_qty")),
        )
    )


def signal_frame(
    metrics: DataFrame,
    signal_type: str,
    condition: F.Column,
    severity_expr: F.Column,
    headline_expr: F.Column,
    summary_expr: F.Column,
    reference_time: datetime,
    window_minutes: int,
) -> DataFrame:
    return (
        metrics.where(condition)
        .select(
            "item_id",
            F.lit(signal_type).alias("signal_type"),
            F.greatest(F.lit(0.0), F.round(severity_expr, 2)).alias("severity_score"),
            F.lit(reference_time.isoformat()).alias("reference_time"),
            F.lit(window_minutes).alias("window_minutes"),
            headline_expr.alias("headline"),
            summary_expr.alias("summary"),
            F.round(F.col("current_vwap"), 2).alias("current_vwap"),
            F.round(F.col("previous_vwap"), 2).alias("previous_vwap"),
            F.round(F.col("price_change_rate"), 4).alias("price_change_rate"),
            F.round(F.col("current_trade_qty"), 2).alias("current_trade_qty"),
            F.round(F.col("previous_trade_qty"), 2).alias("previous_trade_qty"),
            F.round(F.col("trade_volume_change_rate"), 4).alias("trade_volume_change_rate"),
            F.round(F.col("current_buy_created_qty"), 2).alias("current_buy_created_qty"),
            F.round(F.col("current_sell_created_qty"), 2).alias("current_sell_created_qty"),
            F.round(F.col("current_cancelled_qty"), 2).alias("current_cancelled_qty"),
            F.round(F.col("cancel_rate"), 4).alias("cancel_rate"),
            F.round(F.col("net_buy_flow"), 2).alias("net_buy_flow"),
        )
    )


def build_news_candidates(metrics: DataFrame, args: argparse.Namespace, reference_time: datetime) -> DataFrame:
    price_surge = signal_frame(
        metrics,
        "PRICE_SURGE",
        (
            (F.col("previous_trade_qty") >= F.lit(args.min_trade_qty))
            & (F.col("current_trade_qty") >= F.lit(args.min_trade_qty))
            & (F.col("price_change_rate") >= F.lit(args.price_change_threshold))
        ),
        F.col("price_change_rate") * F.lit(100),
        F.format_string(
            "상품 %s 가격 급등, 최근 %s분 평균가 %.1f%% 상승",
            F.col("item_id"),
            F.lit(args.window_minutes),
            F.col("price_change_rate") * F.lit(100),
        ),
        F.format_string(
            "직전 구간 대비 거래가가 %.1f%% 상승했고 거래량은 %.1f에서 %.1f로 변했습니다.",
            F.col("price_change_rate") * F.lit(100),
            F.col("previous_trade_qty"),
            F.col("current_trade_qty"),
        ),
        reference_time,
        args.window_minutes,
    )

    price_drop = signal_frame(
        metrics,
        "PRICE_DROP",
        (
            (F.col("previous_trade_qty") >= F.lit(args.min_trade_qty))
            & (F.col("current_trade_qty") >= F.lit(args.min_trade_qty))
            & (F.col("price_change_rate") <= F.lit(-args.price_change_threshold))
        ),
        F.abs(F.col("price_change_rate")) * F.lit(100),
        F.format_string(
            "상품 %s 가격 급락, 최근 %s분 평균가 %.1f%% 하락",
            F.col("item_id"),
            F.lit(args.window_minutes),
            F.abs(F.col("price_change_rate")) * F.lit(100),
        ),
        F.format_string(
            "직전 구간 대비 거래가가 %.1f%% 하락했고 거래량은 %.1f에서 %.1f로 변했습니다.",
            F.abs(F.col("price_change_rate")) * F.lit(100),
            F.col("previous_trade_qty"),
            F.col("current_trade_qty"),
        ),
        reference_time,
        args.window_minutes,
    )

    volume_spike = signal_frame(
        metrics,
        "TRADE_VOLUME_SPIKE",
        (
            (F.col("previous_trade_qty") >= F.lit(args.min_trade_qty))
            & (F.col("current_trade_qty") >= F.lit(args.min_trade_qty))
            & (F.col("trade_volume_change_rate") >= F.lit(args.volume_spike_threshold))
        ),
        F.col("trade_volume_change_rate") * F.lit(100),
        F.format_string(
            "상품 %s 거래 폭증, 체결량 %.1f%% 증가",
            F.col("item_id"),
            F.col("trade_volume_change_rate") * F.lit(100),
        ),
        F.format_string(
            "최근 %s분 체결량이 %.1f에서 %.1f로 늘었습니다.",
            F.lit(args.window_minutes),
            F.col("previous_trade_qty"),
            F.col("current_trade_qty"),
        ),
        reference_time,
        args.window_minutes,
    )

    volume_drop = signal_frame(
        metrics,
        "TRADE_VOLUME_DROP",
        (
            (F.col("previous_trade_qty") >= F.lit(args.min_trade_qty))
            & (F.col("previous_trade_qty") >= F.lit(args.volume_drop_min_previous_qty))
            & (F.col("trade_volume_change_rate") <= F.lit(args.volume_drop_threshold))
            & (F.col("current_market_activity_qty") >= F.lit(args.min_market_activity_qty))
        ),
        F.abs(F.col("trade_volume_change_rate")) * F.lit(100),
        F.format_string(
            "상품 %s 거래 위축, 체결량 %.1f%% 감소",
            F.col("item_id"),
            F.abs(F.col("trade_volume_change_rate")) * F.lit(100),
        ),
        F.format_string(
            "직전 구간 체결량 %.1f 대비 최근 %s분 체결량이 %.1f로 줄었습니다.",
            F.col("previous_trade_qty"),
            F.lit(args.window_minutes),
            F.col("current_trade_qty"),
        ),
        reference_time,
        args.window_minutes,
    )

    buy_pressure = signal_frame(
        metrics,
        "BUY_PRESSURE",
        (
            (F.col("current_buy_created_qty") >= F.lit(args.min_order_qty))
            & (F.coalesce(F.col("buy_pressure_ratio"), F.lit(9999.0)) >= F.lit(args.pressure_ratio_threshold))
            & (
                F.col("current_buy_created_qty")
                >= F.greatest(F.col("previous_buy_created_qty") * F.lit(1.5), F.lit(args.min_order_qty))
            )
        ),
        (F.col("current_buy_created_qty") - F.col("current_sell_created_qty")) / F.lit(10.0),
        F.format_string("상품 %s 매수세 집중, 매수 주문량이 매도 주문량을 앞섬", F.col("item_id")),
        F.format_string(
            "최근 %s분 매수 주문량은 %.1f, 매도 주문량은 %.1f로 순매수 흐름이 강합니다.",
            F.lit(args.window_minutes),
            F.col("current_buy_created_qty"),
            F.col("current_sell_created_qty"),
        ),
        reference_time,
        args.window_minutes,
    )

    sell_pressure = signal_frame(
        metrics,
        "SELL_PRESSURE",
        (
            (F.col("current_sell_created_qty") >= F.lit(args.min_order_qty))
            & (F.coalesce(F.col("sell_pressure_ratio"), F.lit(9999.0)) >= F.lit(args.pressure_ratio_threshold))
            & (
                F.col("current_sell_created_qty")
                >= F.greatest(F.col("previous_sell_created_qty") * F.lit(1.5), F.lit(args.min_order_qty))
            )
        ),
        (F.col("current_sell_created_qty") - F.col("current_buy_created_qty")) / F.lit(10.0),
        F.format_string("상품 %s 매도세 집중, 매도 주문량이 빠르게 증가", F.col("item_id")),
        F.format_string(
            "최근 %s분 매도 주문량은 %.1f, 매수 주문량은 %.1f로 순매도 흐름이 강합니다.",
            F.lit(args.window_minutes),
            F.col("current_sell_created_qty"),
            F.col("current_buy_created_qty"),
        ),
        reference_time,
        args.window_minutes,
    )

    cancel_surge = signal_frame(
        metrics,
        "CANCELLATION_SURGE",
        (
            (F.col("current_cancelled_qty") >= F.lit(args.min_order_qty))
            & (F.col("cancel_rate") >= F.lit(args.cancel_rate_threshold))
            & (
                F.col("previous_cancelled_qty").isNull()
                | (F.col("previous_cancelled_qty") == 0)
                | (F.col("cancel_change_rate") >= F.lit(0.5))
            )
        ),
        F.col("cancel_rate") * F.lit(100),
        F.format_string("상품 %s 주문 취소 급증, 호가창 불안정 조짐", F.col("item_id")),
        F.format_string(
            "최근 %s분 주문량 %.1f 중 취소 물량이 %.1f로 취소 비중이 %.1f%%에 달합니다.",
            F.lit(args.window_minutes),
            F.col("current_created_qty"),
            F.col("current_cancelled_qty"),
            F.col("cancel_rate") * F.lit(100),
        ),
        reference_time,
        args.window_minutes,
    )

    return (
        price_surge.unionByName(price_drop)
        .unionByName(volume_spike)
        .unionByName(volume_drop)
        .unionByName(buy_pressure)
        .unionByName(sell_pressure)
        .unionByName(cancel_surge)
        .withColumn(
            "dedupe_key",
            F.concat_ws(
                ":",
                F.col("item_id").cast("string"),
                F.col("signal_type"),
                F.date_format(F.to_timestamp("reference_time"), "yyyyMMddHHmm"),
            ),
        )
    )


def get_db_connection():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    conn.autocommit = False
    return conn


def get_game_reference_time() -> datetime:
    """Use the latest candle, or the first index date before candles exist."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(
                    (SELECT MAX(candle_time) FROM market_candle),
                    (SELECT MIN(price_date)::timestamp FROM external_index)
                )
                """
            )
            row = cur.fetchone()
            if row and row[0]:
                return row[0]
    finally:
        conn.close()
    raise RuntimeError("Cannot resolve game time from candles or external indexes")


def to_db_timestamp_literal(reference_time: str) -> str:
    return parse_reference_time(reference_time).strftime("%Y-%m-%d %H:%M:%S")


def has_recent_news(cur) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM internal_news
            WHERE created_at >= CURRENT_TIMESTAMP - (%s || ' minutes')::interval
        ) AS exists
        """,
        (NEWS_GLOBAL_COOLDOWN_MINUTES,),
    )
    return bool(cur.fetchone()["exists"])


def is_duplicate_or_cooling_down(cur, candidate: Candidate) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM internal_news
            WHERE item_id = %s
              AND signal_type = %s
              AND created_at >= CURRENT_TIMESTAMP - (%s || ' minutes')::interval
        ) AS exists
        """,
        (
            candidate.item_id,
            candidate.signal_type,
            NEWS_SIGNAL_COOLDOWN_MINUTES,
        ),
    )
    return bool(cur.fetchone()["exists"])


def synchronize_signal_states(cur, candidates: List[Candidate]) -> List[Candidate]:
    """Return newly activated signals and persist the current active set."""
    cur.execute(
        """
        SELECT item_id, signal_type, is_active
        FROM market_news_signal_state
        FOR UPDATE
        """
    )
    existing = {
        (int(row["item_id"]), row["signal_type"]): bool(row["is_active"])
        for row in cur.fetchall()
    }
    active_keys = {(candidate.item_id, candidate.signal_type) for candidate in candidates}

    for key, was_active in existing.items():
        if was_active and key not in active_keys:
            cur.execute(
                """
                UPDATE market_news_signal_state
                SET is_active = FALSE,
                    cleared_at = CURRENT_TIMESTAMP
                WHERE item_id = %s AND signal_type = %s
                """,
                key,
            )

    newly_activated: List[Candidate] = []
    for candidate in candidates:
        key = (candidate.item_id, candidate.signal_type)
        was_active = existing.get(key, False)
        if not was_active:
            newly_activated.append(candidate)

        cur.execute(
            """
            INSERT INTO market_news_signal_state (
                item_id,
                signal_type,
                is_active,
                activation_started_at,
                last_seen_at,
                cleared_at,
                last_severity
            ) VALUES (%s, %s, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, %s)
            ON CONFLICT (item_id, signal_type) DO UPDATE
            SET is_active = TRUE,
                activation_started_at = CASE
                    WHEN market_news_signal_state.is_active
                        THEN market_news_signal_state.activation_started_at
                    ELSE CURRENT_TIMESTAMP
                END,
                last_seen_at = CURRENT_TIMESTAMP,
                cleared_at = NULL,
                last_severity = EXCLUDED.last_severity
            """,
            (candidate.item_id, candidate.signal_type, candidate.severity_score),
        )

    return newly_activated


def get_item_name(cur, item_id: int) -> str:
    cur.execute("SELECT name FROM item WHERE item_id = %s", (item_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"item_id={item_id} does not exist")
    return row["name"]


def build_prompt(candidate: Candidate, item_name: str) -> str:
    raw = candidate.raw
    return f"""
아이템 이름: {item_name}
시그널: {candidate.signal_type}
심각도: {candidate.severity_score}
기준 시각: {candidate.reference_time}
헤드라인 초안: {candidate.headline}
요약 초안: {candidate.summary}
현재 거래량: {raw.get("current_trade_qty")}
직전 거래량: {raw.get("previous_trade_qty")}
현재 VWAP: {raw.get("current_vwap")}
직전 VWAP: {raw.get("previous_vwap")}
현재 매수 주문량: {raw.get("current_buy_created_qty")}
현재 매도 주문량: {raw.get("current_sell_created_qty")}
현재 취소량: {raw.get("current_cancelled_qty")}

너는 게임 내 경제 뉴스를 작성하는 기자다.
한국어로 짧은 기사 한 건을 작성하라.
응답은 반드시 JSON으로만 하고, 필드는 title, summary, content 를 포함하라.
title은 40자 이내, summary는 80자 이내, content는 2~4문장으로 작성하라.
"""


def generate_article_with_template(candidate: Candidate, item_name: str) -> Dict[str, str]:
    raw = candidate.raw
    return {
        "title": f"[시장속보] {item_name} {candidate.signal_type}",
        "summary": candidate.summary,
        "content": (
            f"{item_name} 시장에서 {candidate.signal_type} 신호가 감지되었습니다. "
            f"기준 시각은 {candidate.reference_time}이며 심각도는 {candidate.severity_score:.1f}입니다. "
            f"현재 거래량은 {raw.get('current_trade_qty', 0)}, 직전 거래량은 {raw.get('previous_trade_qty', 0)}로 집계되었습니다."
        ),
    }


def generate_article_with_llm(candidate: Candidate, item_name: str) -> Dict[str, str]:
    if not OPENAI_API_KEY:
        return generate_article_with_template(candidate, item_name)

    body = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "developer", "content": "You are an in-game economic news writer. Return JSON only."},
            {"role": "user", "content": build_prompt(candidate, item_name)},
        ],
        "temperature": 0.7,
    }

    http_request = request.Request(
        OPENAI_BASE_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=OPENAI_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
            content = payload["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as exc:
        print(f"[MARKET-NEWS-STREAM] llm generation failed, fallback template used: {exc}")
        return generate_article_with_template(candidate, item_name)


def insert_internal_news(cur, candidate: Candidate, article: Dict[str, str], item_name: str) -> bool:
    content = article["content"]
    if article.get("summary"):
        content = f"{article['summary']}\n\n{content}"

    game_timestamp = to_db_timestamp_literal(candidate.reference_time)

    cur.execute(
        """
        INSERT INTO internal_news (
            title,
            content,
            published_at,
            item_id,
            signal_type,
            dedupe_key
        ) VALUES (
            %s, %s, %s::timestamp, %s, %s, %s
        )
        ON CONFLICT (dedupe_key) DO NOTHING
        RETURNING internal_news_id
        """,
        (
            article["title"],
            content,
            game_timestamp,
            candidate.item_id,
            candidate.signal_type,
            candidate.dedupe_key,
        ),
    )
    return cur.fetchone() is not None


def publish_best_candidate(rows: List[Any]) -> bool:
    candidates = []
    for row in rows:
        raw = row.asDict(recursive=True)
        candidate = Candidate(
            item_id=int(raw["item_id"]),
            signal_type=raw["signal_type"],
            severity_score=float(raw["severity_score"]),
            headline=raw["headline"],
            summary=raw["summary"],
            reference_time=raw["reference_time"],
            dedupe_key=raw["dedupe_key"],
            raw=raw,
        )
        if candidate.severity_score >= NEWS_MIN_SEVERITY_SCORE:
            candidates.append(candidate)

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            newly_activated = synchronize_signal_states(cur, candidates)
            if not newly_activated:
                conn.commit()
                print("[MARKET-NEWS-STREAM] no newly activated signal")
                return False

            if has_recent_news(cur):
                print("[MARKET-NEWS-STREAM] global cooldown active")
                conn.commit()
                return False

            for candidate in newly_activated:
                if is_duplicate_or_cooling_down(cur, candidate):
                    continue

                item_name = get_item_name(cur, candidate.item_id)
                article = generate_article_with_llm(candidate, item_name)
                inserted = insert_internal_news(cur, candidate, article, item_name)
                if not inserted:
                    continue
                cur.execute(
                    """
                    UPDATE market_news_signal_state
                    SET last_published_at = CURRENT_TIMESTAMP
                    WHERE item_id = %s AND signal_type = %s
                    """,
                    (candidate.item_id, candidate.signal_type),
                )
                conn.commit()
                print(
                    "[MARKET-NEWS-STREAM] inserted internal news "
                    f"item_id={candidate.item_id} signal={candidate.signal_type} "
                    f"severity={candidate.severity_score}"
                )
                return True

            print("[MARKET-NEWS-STREAM] no candidate passed filters")
            conn.commit()
            return False
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def run_market_news_cycle(
    spark: SparkSession,
    args: argparse.Namespace,
    reference_time: datetime,
) -> int:
    current_start = reference_time - timedelta(minutes=args.window_minutes)
    previous_start = current_start - timedelta(minutes=args.window_minutes)

    raw_orders = read_event_window(
        spark,
        args.order_path,
        args.order_curated_path,
        ORDER_INPUT_SCHEMA,
        previous_start,
        reference_time,
    )
    raw_trades = read_event_window(
        spark,
        args.trade_path,
        args.trade_curated_path,
        TRADE_INPUT_SCHEMA,
        previous_start,
        reference_time,
    )

    orders = bucketize(
        normalize_orders(raw_orders),
        previous_start=previous_start,
        current_start=current_start,
        reference_time=reference_time,
    )
    trades = bucketize(
        normalize_trades(raw_trades),
        previous_start=previous_start,
        current_start=current_start,
        reference_time=reference_time,
    )

    order_metrics = aggregate_order_metrics(orders)
    trade_metrics = aggregate_trade_metrics(trades)
    item_metrics = compute_item_metrics(order_metrics, trade_metrics).persist(
        StorageLevel.MEMORY_AND_DISK
    )

    try:
        # Materialize the expensive HDFS parse/group/pivot lineage once. The
        # seven signal branches below then reuse this small per-item result.
        summary = item_metrics.agg(
            F.sum(
                F.col("current_created_count")
                + F.col("current_cancelled_count")
                + F.col("previous_created_count")
                + F.col("previous_cancelled_count")
            ).alias("order_event_count"),
            F.sum(
                F.col("current_trade_count") + F.col("previous_trade_count")
            ).alias("trade_event_count"),
        ).collect()[0]
        order_event_count = int(summary["order_event_count"] or 0)
        trade_event_count = int(summary["trade_event_count"] or 0)
        print(
            f"[MARKET-NEWS-STREAM] normalized orders={order_event_count} "
            f"trades={trade_event_count}"
        )

        game_reference_time = get_game_reference_time()
        candidate_rows = (
            build_news_candidates(item_metrics, args, game_reference_time)
            .orderBy(F.desc("severity_score"))
            .collect()
        )
        candidate_count = len(candidate_rows)
        print(
            f"[MARKET-NEWS-STREAM] reference_time={reference_time.isoformat()} "
            f"game_reference_time={game_reference_time.isoformat()} "
            f"candidates={candidate_count}"
        )

        publish_best_candidate(candidate_rows)
        return candidate_count
    finally:
        item_metrics.unpersist()


def main() -> None:
    args = parse_args()
    spark = build_spark_session()

    heartbeat_stream = (
        spark.readStream.format("rate")
        .option("rowsPerSecond", args.rows_per_second)
        .option("numPartitions", 1)
        .load()
    )

    def process_batch(batch_df, batch_id: int) -> None:
        resolved_reference_time = resolve_reference_time(batch_df, args.reference_time)
        reference_time = apply_reference_lag(resolved_reference_time, lag_minutes=1)
        print(
            f"[MARKET-NEWS-STREAM] batch_id={batch_id} "
            f"reference_time={reference_time.isoformat()}"
        )
        run_market_news_cycle(spark, args, reference_time)

    query = (
        heartbeat_stream.writeStream.trigger(processingTime=args.trigger_interval)
        .option("checkpointLocation", args.checkpoint_path)
        .foreachBatch(process_batch)
        .start()
    )

    print(
        "[MARKET-NEWS-STREAM] started "
        f"trigger_interval={args.trigger_interval} checkpoint={args.checkpoint_path}"
    )
    query.awaitTermination()


if __name__ == "__main__":
    main()
