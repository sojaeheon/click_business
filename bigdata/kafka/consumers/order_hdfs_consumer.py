import json
import os
import time
from datetime import datetime, timezone
from typing import Dict, List

from hdfs import InsecureClient
from kafka import KafkaConsumer


def _get_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None:
        raise ValueError(f"Missing required env: {name}")
    return value


KAFKA_TOPIC = _get_env("KAFKA_TOPIC", "market.order.events")
KAFKA_BOOTSTRAP = _get_env("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_GROUP_ID = _get_env("KAFKA_GROUP_ID", "order-hdfs-consumer")
KAFKA_AUTO_OFFSET_RESET = _get_env("KAFKA_AUTO_OFFSET_RESET", "earliest")
CONSUMER_TYPE = _get_env("CONSUMER_TYPE", "order_hdfs")

HDFS_URL = _get_env("HDFS_URL")
HDFS_USER = _get_env("HDFS_USER", "root")
HDFS_BASE_PATH = _get_env("HDFS_BASE_PATH", "/raw/kafka")
FLUSH_INTERVAL_SEC = int(_get_env("FLUSH_INTERVAL_SEC", "60"))

def sanitize_path_segment(value: str) -> str:
    return (value or "unknown").replace("/", "_").replace(" ", "_")


def decode_key(raw_key) -> str | None:
    if raw_key is None:
        return None
    try:
        return raw_key.decode("utf-8", errors="replace")
    except Exception:
        return str(raw_key)


def parse_json(raw_value: bytes) -> dict:
    return json.loads(raw_value.decode("utf-8", errors="replace"))


def dt_from_epoch_second(epoch_second: int) -> datetime:
    return datetime.fromtimestamp(epoch_second, tz=timezone.utc).astimezone()


def floor_epoch_second(epoch_second: int, interval_sec: int) -> int:
    return epoch_second - (epoch_second % interval_sec)


def hdfs_path_for(event_type: str, bucket_time: datetime) -> str:
    dt = bucket_time.strftime("%Y-%m-%d")
    hour = bucket_time.strftime("%H")
    minute = bucket_time.strftime("%M")
    ts = int(time.time() * 1000)
    safe_event_type = sanitize_path_segment(event_type)
    safe_topic = sanitize_path_segment(KAFKA_TOPIC)
    safe_consumer_type = sanitize_path_segment(CONSUMER_TYPE)

    return (
        f"{HDFS_BASE_PATH}/topic={safe_topic}/event_type={safe_event_type}"
        f"/dt={dt}/hour={hour}/minute={minute}"
        f"/part-{safe_consumer_type}-{ts}.jsonl"
    )


def build_record(msg) -> tuple[str, str]:
    data = parse_json(msg.value)
    payload = data.get("payload") or {}
    event_type = data.get("event_type") or "unknown"

    record = {
        "kafka_topic": msg.topic,
        "kafka_partition": msg.partition,
        "kafka_offset": msg.offset,
        "kafka_timestamp": msg.timestamp,
        "kafka_key": decode_key(msg.key),
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "event_id": data.get("event_id"),
        "event_type": event_type,
        "event_version": data.get("event_version"),
        "occurred_at": data.get("occurred_at"),
        "producer": data.get("producer"),
        "company_id": data.get("company_id"),
        "aggregate_id": data.get("aggregate_id"),
        "payload": payload,
        "order_id": payload.get("order_id"),
        "item_id": payload.get("item_id"),
        "side": payload.get("side"),
        "price": payload.get("price"),
        "quantity": payload.get("quantity"),
        "is_virtual": payload.get("is_virtual"),
        "created_at": payload.get("created_at"),
        "cancelled_at": payload.get("cancelled_at"),
    }

    return json.dumps(record, ensure_ascii=False) + "\n", event_type


def flush_to_hdfs(
    client: InsecureClient,
    event_type: str,
    bucket_second: int,
    lines: List[str],
) -> None:
    if not lines:
        return

    path = hdfs_path_for(event_type, dt_from_epoch_second(bucket_second))
    parent_dir = "/".join(path.split("/")[:-1])
    client.makedirs(parent_dir)

    with client.write(path, encoding="utf-8", overwrite=False) as writer:
        writer.write("".join(lines))

    print(f"[ORDER-HDFS] wrote {len(lines)} events to {path}")


def main():
    consumer = KafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id=KAFKA_GROUP_ID,
        enable_auto_commit=False,
        auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
        max_poll_records=500,
        key_deserializer=lambda x: x,
        value_deserializer=lambda x: x,
    )

    hdfs_client = InsecureClient(HDFS_URL, user=HDFS_USER)
    buffers: Dict[str, List[str]] = {}
    active_bucket_second = floor_epoch_second(int(time.time()), FLUSH_INTERVAL_SEC)

    try:
        print(
            f"[ORDER-HDFS] start. topic={KAFKA_TOPIC}, "
            f"kafka={KAFKA_BOOTSTRAP}, hdfs={HDFS_URL}"
        )

        while True:
            now_second = int(time.time())
            now_bucket_second = floor_epoch_second(now_second, FLUSH_INTERVAL_SEC)
            if now_bucket_second != active_bucket_second:
                wrote_any = False
                for event_type, lines in list(buffers.items()):
                    if lines:
                        flush_to_hdfs(hdfs_client, event_type, active_bucket_second, lines)
                        buffers[event_type] = []
                        wrote_any = True

                if wrote_any:
                    consumer.commit()
                    print("[ORDER-HDFS] kafka offsets committed")

                active_bucket_second = now_bucket_second

            polled = consumer.poll(timeout_ms=200)
            total = 0

            for _, messages in polled.items():
                for msg in messages:
                    line, event_type = build_record(msg)
                    buffers.setdefault(event_type, []).append(line)
                    total += 1

    except KeyboardInterrupt:
        print("[ORDER-HDFS] interrupted, final flush...")
        wrote_any = False

        for event_type, lines in list(buffers.items()):
            if lines:
                flush_to_hdfs(hdfs_client, event_type, active_bucket_second, lines)
                wrote_any = True

        if wrote_any:
            consumer.commit()
            print("[ORDER-HDFS] final commit done")

    finally:
        consumer.close()
        print("[ORDER-HDFS] stopped")


if __name__ == "__main__":
    main()
