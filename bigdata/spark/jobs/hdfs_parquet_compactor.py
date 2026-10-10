import argparse
from datetime import datetime, timedelta, timezone
from typing import List

from pyspark.sql import SparkSession
from pyspark.sql.types import StringType, StructField, StructType


RAW_SCHEMA = StructType([
    StructField("kafka_topic", StringType(), True),
    StructField("kafka_partition", StringType(), True),
    StructField("kafka_offset", StringType(), True),
    StructField("kafka_timestamp", StringType(), True),
    StructField("kafka_key", StringType(), True),
    StructField("ingested_at", StringType(), True),
    StructField("event_type", StringType(), True),
    StructField("event_raw", StringType(), True),
])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compact completed HDFS raw Kafka hour partitions into Parquet."
    )
    parser.add_argument("--raw-root", default="hdfs://namenode:9000/raw/kafka")
    parser.add_argument("--curated-root", default="hdfs://namenode:9000/curated/kafka")
    parser.add_argument(
        "--topics",
        default="company.events,warehouse.events,market.order.events,market.trade.events",
    )
    parser.add_argument("--lookback-hours", type=int, default=2)
    parser.add_argument(
        "--rewrite-existing",
        action="store_true",
        help="Rewrite hours that already have a curated Parquet partition.",
    )
    return parser.parse_args()


def expand_glob(spark: SparkSession, pattern: str) -> List[str]:
    path = spark.sparkContext._jvm.org.apache.hadoop.fs.Path(pattern)
    filesystem = path.getFileSystem(spark.sparkContext._jsc.hadoopConfiguration())
    statuses = filesystem.globStatus(path)
    if not statuses:
        return []
    return [status.getPath().toString() for status in statuses]


def path_exists(spark: SparkSession, path_value: str) -> bool:
    path = spark.sparkContext._jvm.org.apache.hadoop.fs.Path(path_value)
    filesystem = path.getFileSystem(spark.sparkContext._jsc.hadoopConfiguration())
    return filesystem.exists(path)


def compact_hour(
    spark: SparkSession,
    raw_root: str,
    curated_root: str,
    topic: str,
    hour: datetime,
    rewrite_existing: bool,
) -> bool:
    output_path = f"{curated_root}/topic={topic}/dt={hour:%Y-%m-%d}/hour={hour:%H}"
    if not rewrite_existing and path_exists(spark, output_path):
        print(f"[HDFS-COMPACTOR] already compacted; skipped: {output_path}")
        return False

    raw_pattern = (
        f"{raw_root}/topic={topic}/event_type=*/dt={hour:%Y-%m-%d}/hour={hour:%H}"
    )
    input_paths = expand_glob(spark, raw_pattern)
    if not input_paths:
        print(f"[HDFS-COMPACTOR] no input topic={topic} hour={hour.isoformat()}")
        return False

    records = (
        spark.read.schema(RAW_SCHEMA)
        .option("recursiveFileLookup", "true")
        .option("pathGlobFilter", "*.jsonl")
        .json(input_paths)
    )
    record_count = records.count()
    if record_count == 0:
        print(f"[HDFS-COMPACTOR] empty input topic={topic} hour={hour.isoformat()}")
        return False

    records.coalesce(1).write.mode("overwrite").parquet(output_path)
    print(
        f"[HDFS-COMPACTOR] compacted topic={topic} hour={hour.isoformat()} "
        f"records={record_count} output={output_path}"
    )
    return True


def main() -> None:
    args = parse_args()
    spark = (
        SparkSession.builder.appName("hdfs-parquet-compactor")
        .config("spark.sql.shuffle.partitions", "2")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    current_hour = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    topics = [topic.strip() for topic in args.topics.split(",") if topic.strip()]
    compacted = 0
    try:
        for hours_ago in range(1, args.lookback_hours + 1):
            target_hour = current_hour - timedelta(hours=hours_ago)
            for topic in topics:
                if compact_hour(
                    spark,
                    args.raw_root.rstrip("/"),
                    args.curated_root.rstrip("/"),
                    topic,
                    target_hour,
                    args.rewrite_existing,
                ):
                    compacted += 1
        print(f"[HDFS-COMPACTOR] completed partitions={compacted}")
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
