import json
import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from hdfs import InsecureClient
from kafka import KafkaConsumer


# -----------------------------------------
# 환경변수 읽기 유틸
# - 필수값 누락 시 즉시 예외 발생
# -----------------------------------------
def _get_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None:
        raise ValueError(f"Missing required env: {name}")
    return value


# -----------------------------------------
# Kafka 설정
# -----------------------------------------
KAFKA_BOOTSTRAP = _get_env("KAFKA_BOOTSTRAP_SERVERS")  # 예: kafka:9092
KAFKA_TOPICS = [t.strip() for t in _get_env("KAFKA_TOPICS").split(",") if t.strip()]
KAFKA_GROUP_ID = _get_env("KAFKA_GROUP_ID", "raw-sink-v1")
KAFKA_AUTO_OFFSET_RESET = _get_env("KAFKA_AUTO_OFFSET_RESET", "latest")

# -----------------------------------------
# HDFS(WebHDFS) 설정
# -----------------------------------------
HDFS_URL = _get_env("HDFS_URL")  # 예: http://namenode:9870
HDFS_USER = _get_env("HDFS_USER", "root")
HDFS_BASE_PATH = _get_env("HDFS_BASE_PATH", "/raw/kafka")

# -----------------------------------------
# flush 정책
# -----------------------------------------
BATCH_SIZE = int(_get_env("BATCH_SIZE", "200"))
FLUSH_INTERVAL_SEC = int(_get_env("FLUSH_INTERVAL_SEC", "5"))


# -----------------------------------------
# HDFS 경로 segment 안전화
# -----------------------------------------
def sanitize_path_segment(value: str) -> str:
    return (value or "unknown").replace("/", "_").replace(" ", "_")


# -----------------------------------------
# HDFS 파일 경로 생성
# 예:
# /raw/kafka/topic=company.events/event_type=company.cash.changed/dt=2026-03-20/hour=15/part-raw-sink-v1-...jsonl
# -----------------------------------------
def hdfs_path_for(topic: str, event_type: str) -> str:
    now = datetime.now(timezone.utc).astimezone()
    dt = now.strftime("%Y-%m-%d")
    hour = now.strftime("%H")
    ts = int(time.time() * 1000)
    safe_event_type = sanitize_path_segment(event_type)

    return (
        f"{HDFS_BASE_PATH}/topic={topic}/event_type={safe_event_type}"
        f"/dt={dt}/hour={hour}/part-{KAFKA_GROUP_ID}-{ts}.jsonl"
    )


# -----------------------------------------
# event_type 추출
# - global/market producer 포맷 차이를 흡수
# - 실패 시 unknown
# -----------------------------------------
def parse_event_type_from_raw(raw_value: str) -> str:
    try:
        obj = json.loads(raw_value)
        if isinstance(obj, dict):
            return obj.get("event_type") or obj.get("eventType") or "unknown"
    except Exception:
        pass
    return "unknown"


# -----------------------------------------
# Kafka key(bytes) -> 문자열 변환
# -----------------------------------------
def decode_key(raw_key) -> str | None:
    if raw_key is None:
        return None
    try:
        return raw_key.decode("utf-8", errors="replace")
    except Exception:
        return str(raw_key)


# -----------------------------------------
# Kafka 메시지 -> JSONL 한 줄 변환
# - Raw는 항상 문자열(event_raw)로 저장해 스키마 일관성 유지
# - 반환: (jsonl_line, event_type)
# -----------------------------------------
def build_record(msg) -> Tuple[str, str]:
    raw_value = msg.value.decode("utf-8", errors="replace")
    event_type = parse_event_type_from_raw(raw_value)
    kafka_key = decode_key(msg.key)

    record = {
        "kafka_topic": msg.topic,
        "kafka_partition": msg.partition,
        "kafka_offset": msg.offset,
        "kafka_timestamp": msg.timestamp,
        "kafka_key": kafka_key,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "event_raw": raw_value,  # Raw 레이어는 원문 문자열을 일관 저장
    }

    return json.dumps(record, ensure_ascii=False) + "\n", event_type


# -----------------------------------------
# HDFS flush
# -----------------------------------------
def flush_to_hdfs(client: InsecureClient, topic: str, event_type: str, lines: List[str]) -> None:
    if not lines:
        return

    path = hdfs_path_for(topic, event_type)
    parent_dir = "/".join(path.split("/")[:-1])
    client.makedirs(parent_dir)

    with client.write(path, encoding="utf-8", overwrite=False) as writer:
        writer.write("".join(lines))

    print(f"[RAW-SINK] wrote {len(lines)} events to {path}")


# -----------------------------------------
# 메인 루프
# 1) poll
# 2) (topic,event_type) 버퍼 적재
# 3) flush 조건 만족 시 HDFS write
# 4) write 성공 후 offset commit
# -----------------------------------------
def main():
    consumer = KafkaConsumer(
        *KAFKA_TOPICS,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id=KAFKA_GROUP_ID,
        enable_auto_commit=False,           # 적재 성공 후 수동 커밋
        auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
        max_poll_records=500,
        key_deserializer=lambda x: x,       # bytes 그대로 수신
        value_deserializer=lambda x: x,     # bytes 그대로 수신
    )

    hdfs_client = InsecureClient(HDFS_URL, user=HDFS_USER)

    # 버퍼 키: (topic, event_type)
    buffers: Dict[Tuple[str, str], List[str]] = {}
    last_flush = time.time()

    try:
        print(f"[RAW-SINK] start. topics={KAFKA_TOPICS}, kafka={KAFKA_BOOTSTRAP}, hdfs={HDFS_URL}")

        while True:
            polled = consumer.poll(timeout_ms=1000)

            # 1) 메시지 수집
            total = 0
            for tp, messages in polled.items():
                topic = tp.topic
                for msg in messages:
                    line, event_type = build_record(msg)
                    buffer_key = (topic, event_type)
                    buffers.setdefault(buffer_key, []).append(line)
                    total += 1

            # 2) flush 조건 확인
            now = time.time()
            should_flush = False

            if total > 0:
                for lines in buffers.values():
                    if len(lines) >= BATCH_SIZE:
                        should_flush = True
                        break

            if now - last_flush >= FLUSH_INTERVAL_SEC:
                should_flush = True

            # 3) flush + commit
            if should_flush:
                wrote_any = False

                for (topic, event_type), lines in list(buffers.items()):
                    if lines:
                        flush_to_hdfs(hdfs_client, topic, event_type, lines)
                        buffers[(topic, event_type)] = []
                        wrote_any = True

                # 적재 성공했을 때만 커밋
                if wrote_any:
                    consumer.commit()
                    print("[RAW-SINK] kafka offsets committed")

                last_flush = now

    except KeyboardInterrupt:
        # 종료 시 잔여 버퍼 flush
        print("[RAW-SINK] interrupted, final flush...")
        wrote_any = False

        for (topic, event_type), lines in list(buffers.items()):
            if lines:
                flush_to_hdfs(hdfs_client, topic, event_type, lines)
                wrote_any = True

        if wrote_any:
            consumer.commit()
            print("[RAW-SINK] final commit done")

    finally:
        consumer.close()
        print("[RAW-SINK] stopped")


if __name__ == "__main__":
    main()
