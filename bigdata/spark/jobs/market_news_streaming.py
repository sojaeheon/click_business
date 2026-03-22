import argparse
from datetime import datetime

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

from market_news_trigger import build_parser as build_batch_parser
from market_news_trigger import run_market_news_batch


DEFAULT_CHECKPOINT_PATH = "/tmp/checkpoints/market-news-stream"


def parse_args() -> argparse.Namespace:
    batch_defaults = build_batch_parser().parse_args([])
    parser = argparse.ArgumentParser(
        description="Structured Streaming wrapper for market news aggregation."
    )
    parser.add_argument("--order-path", default=batch_defaults.order_path)
    parser.add_argument("--trade-path", default=batch_defaults.trade_path)
    parser.add_argument("--output-path", default=batch_defaults.output_path)
    parser.add_argument("--window-minutes", type=int, default=batch_defaults.window_minutes)
    parser.add_argument("--min-trade-qty", type=float, default=batch_defaults.min_trade_qty)
    parser.add_argument("--min-order-qty", type=float, default=batch_defaults.min_order_qty)
    parser.add_argument(
        "--price-change-threshold",
        type=float,
        default=batch_defaults.price_change_threshold,
    )
    parser.add_argument(
        "--volume-spike-threshold",
        type=float,
        default=batch_defaults.volume_spike_threshold,
    )
    parser.add_argument(
        "--volume-drop-threshold",
        type=float,
        default=batch_defaults.volume_drop_threshold,
    )
    parser.add_argument(
        "--volume-drop-min-previous-qty",
        type=float,
        default=batch_defaults.volume_drop_min_previous_qty,
    )
    parser.add_argument(
        "--min-market-activity-qty",
        type=float,
        default=batch_defaults.min_market_activity_qty,
    )
    parser.add_argument(
        "--pressure-ratio-threshold",
        type=float,
        default=batch_defaults.pressure_ratio_threshold,
    )
    parser.add_argument(
        "--cancel-rate-threshold",
        type=float,
        default=batch_defaults.cancel_rate_threshold,
    )
    parser.add_argument("--trigger-interval", default="10 minutes")
    parser.add_argument("--checkpoint-path", default=DEFAULT_CHECKPOINT_PATH)
    parser.add_argument("--rows-per-second", type=int, default=1)
    return parser.parse_args()


def build_spark_session() -> SparkSession:
    return (
        SparkSession.builder.appName("market-news-streaming")
        .config("spark.sql.session.timeZone", "Asia/Seoul")
        .getOrCreate()
    )


def resolve_reference_time(batch_df) -> datetime:
    row = batch_df.agg(F.max("timestamp").alias("max_ts")).collect()[0]
    reference_time = row["max_ts"]
    if reference_time is None:
        return datetime.now()
    return reference_time


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
        reference_time = resolve_reference_time(batch_df)
        print(
            f"[MARKET-NEWS-STREAM] batch_id={batch_id} "
            f"reference_time={reference_time.isoformat()}"
        )
        run_market_news_batch(spark, args, reference_time)

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
