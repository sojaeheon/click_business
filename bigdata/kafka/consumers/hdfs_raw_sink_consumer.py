import json
import os
import signal
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Tuple

from hdfs import InsecureClient
from kafka import KafkaConsumer


# -----------------------------------------
# 환경변수 유틸: 필수값 누락 시 즉시 실패
# -----------------------------------------
def _get_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None:
        raise ValueError(f"Missing required env: {name}")
    return value


# -----------------------------------------
# Kafka 설정
# -----------------------------------------
KAFKA_BOOTSTRAP = _get_env("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPICS = [t.strip() for t in _get_env("KAFKA_TOPICS").split(",") if t.strip()]
KAFKA_GROUP_ID = _get_env("KAFKA_GROUP_ID", "raw-sink-v1")
KAFKA_AUTO_OFFSET_RESET = _get_env("KAFKA_AUTO_OFFSET_RESET", "latest")

# 실제 적재 허용 토픽(오설정 방어)
ALLOWED_TOPICS = {
    t.strip() for t in _get_env(
        "ALLOWED_TOPICS",
        "company.events,warehouse.events",
    ).split(",") if t.strip()
}

# -----------------------------------------
# HDFS(WebHDFS) 설정
# -----------------------------------------
HDFS_URL = _get_env("HDFS_URL", "http://namenode:9870")
HDFS_USER = _get_env("HDFS_USER", "root")
HDFS_BASE_PATH = _get_env("HDFS_BASE_PATH", "/raw/kafka")

# -----------------------------------------
# Flush 정책
# -----------------------------------------
BATCH_SIZE = int(_get_env("BATCH_SIZE", "1000"))  # 레코드 수 기준
FLUSH_INTERVAL_SEC = int(_get_env("FLUSH_INTERVAL_SEC", "5"))  # 시간 기준
MAX_BYTES_PER_FILE = int(_get_env("MAX_BYTES_PER_FILE", str(1 * 1024 * 1024)))  # 바이트 기준
KST = timezone(timedelta(hours=9))  # 경로 파티션 시간 기준(KST)

# 종료 시그널 제어 플래그
RUNNING = True


# -----------------------------------------
# 경로 세그먼트 sanitize
# -----------------------------------------
def sanitize_path_segment(value: str) -> str:
    return (value or "unknown").replace("/", "_").replace(" ", "_")


# -----------------------------------------
# HDFS 경로 생성 (KST 기준)
# 예:
# /raw/kafka/topic=company.events/event_type=company.cash.changed/dt=2026-03-20/hour=15/part-raw-sink-v1-...jsonl
# -----------------------------------------
def hdfs_path_for(topic: str, event_type: str) -> str:
    now = datetime.now(KST)
    dt = now.strftime("%Y-%m-%d")
    hour = now.strftime("%H")
    ts = int(time.time() * 1000)

    safe_topic = sanitize_path_segment(topic)
    safe_event_type = sanitize_path_segment(event_type)

    return (
        f"{HDFS_BASE_PATH}/topic={safe_topic}/event_type={safe_event_type}"
        f"/dt={dt}/hour={hour}/part-{KAFKA_GROUP_ID}-{ts}.jsonl"
    )


# -----------------------------------------
# event_type 추출 (포맷 차이 흡수)
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
# Kafka key(bytes) -> 문자열
# -----------------------------------------
def decode_key(raw_key) -> str | None:
    if raw_key is None:
        return None
    try:
        return raw_key.decode("utf-8", errors="replace")
    except Exception:
        return str(raw_key)


# -----------------------------------------
# Kafka 메시지 -> JSONL line 변환
# 반환: (line, event_type, line_size_bytes)
# -----------------------------------------
def build_record(msg) -> Tuple[str, str, int]:
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
        "event_raw": raw_value,
    }

    line = json.dumps(record, ensure_ascii=False) + "\n"
    return line, event_type, len(line.encode("utf-8"))


# -----------------------------------------
# HDFS 쓰기 유틸
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
# 버퍼 전체 flush
# 반환값: 실제 write 발생 여부
# -----------------------------------------
def flush_all(
    client: InsecureClient,
    buffers: Dict[Tuple[str, str], List[str]],
    buffer_sizes: Dict[Tuple[str, str], int],
) -> bool:
    wrote_any = False

    for (topic, event_type), lines in list(buffers.items()):
        if lines:
            flush_to_hdfs(client, topic, event_type, lines)
            buffers[(topic, event_type)] = []
            buffer_sizes[(topic, event_type)] = 0
            wrote_any = True

    return wrote_any


# -----------------------------------------
# graceful shutdown 처리
# -----------------------------------------
def _handle_shutdown(signum, frame):
    global RUNNING
    RUNNING = False
    print(f"[RAW-SINK] received signal={signum}, shutdown requested")


def main():
    global RUNNING

    signal.signal(signal.SIGTERM, _handle_shutdown)
    signal.signal(signal.SIGINT, _handle_shutdown)

    consumer = KafkaConsumer(
        *KAFKA_TOPICS,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id=KAFKA_GROUP_ID,
        enable_auto_commit=False,  # 적재 성공 후 수동 커밋
        auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
        max_poll_records=500,
        key_deserializer=lambda x: x,
        value_deserializer=lambda x: x,
    )

    hdfs_client = InsecureClient(HDFS_URL, user=HDFS_USER)

    # key: (topic, event_type)
    buffers: Dict[Tuple[str, str], List[str]] = {}
    buffer_sizes: Dict[Tuple[str, str], int] = {}
    last_flush = time.time()

    try:
        print(
            f"[RAW-SINK] start. topics={KAFKA_TOPICS}, allowed={sorted(ALLOWED_TOPICS)}, "
            f"kafka={KAFKA_BOOTSTRAP}, hdfs={HDFS_URL}"
        )

        while RUNNING:
            polled = consumer.poll(timeout_ms=1000)

            # 1) 메시지 수집
            for tp, messages in polled.items():
                topic = tp.topic

                # 허용 토픽만 적재
                if topic not in ALLOWED_TOPICS:
                    continue

                for msg in messages:
                    try:
                        line, event_type, line_size = build_record(msg)
                        key = (topic, event_type)
                        buffers.setdefault(key, []).append(line)
                        buffer_sizes[key] = buffer_sizes.get(key, 0) + line_size
                    except Exception as exc:
                        # 단건 메시지 오류가 전체 루프를 죽이지 않게 방어
                        print(
                            f"[RAW-SINK][WARN] skip message "
                            f"topic={topic} partition={msg.partition} offset={msg.offset} err={exc}"
                        )

            # 2) flush 조건 확인
            now = time.time()
            should_flush = False

            # 레코드 수 기준
            for lines in buffers.values():
                if len(lines) >= BATCH_SIZE:
                    should_flush = True
                    break

            # 파일 바이트 기준
            if not should_flush:
                for size in buffer_sizes.values():
                    if size >= MAX_BYTES_PER_FILE:
                        should_flush = True
                        break

            # 시간 기준 (버퍼가 있을 때만 의미 있음)
            if not should_flush and buffers and (now - last_flush >= FLUSH_INTERVAL_SEC):
                should_flush = True

            # 3) flush + commit
            if should_flush:
                wrote_any = flush_all(hdfs_client, buffers, buffer_sizes)
                if wrote_any:
                    consumer.commit()
                    print("[RAW-SINK] kafka offsets committed")
                last_flush = now

    finally:
        # 종료 시 잔여 버퍼 flush
        wrote_any = flush_all(hdfs_client, buffers, buffer_sizes)
        if wrote_any:
            consumer.commit()
            print("[RAW-SINK] final commit done")
        consumer.close()
        print("[RAW-SINK] stopped")


if __name__ == "__main__":
    main()
