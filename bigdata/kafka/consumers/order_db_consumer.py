import time
import json
import os
import psycopg2
from datetime import datetime
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

def get_env(name, default=None):
    value = os.getenv(name, default)
    if value is None:
        raise ValueError(f"Missing required env: {name}")
    return value


def get_int_env(name, default=None):
    value = get_env(name, default)
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid integer env {name}: {value}") from exc


DB_HOST = get_env("DB_HOST", "postgres-db")
DB_PORT = get_int_env("DB_PORT", "5432")
DB_NAME = get_env("DB_NAME", "ecosim")
DB_USER = get_env("DB_USER", "ecosim")
DB_PASSWORD = get_env("DB_PASSWORD", "ecosim")
KAFKA_BOOTSTRAP_SERVERS = get_env("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_ORDER_TOPIC = get_env("KAFKA_ORDER_TOPIC", "market.order.events")
KAFKA_ORDER_GROUP_ID = get_env("KAFKA_ORDER_GROUP_ID", "order-db-consumer")
KAFKA_AUTO_OFFSET_RESET = get_env("KAFKA_AUTO_OFFSET_RESET", "earliest")

# -----------------------------
# PostgreSQL 연결
# -----------------------------
def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

# -----------------------------
# Kafka 연결
# -----------------------------
while True:
    try:
        consumer = KafkaConsumer(
            KAFKA_ORDER_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
            enable_auto_commit=False,
            group_id=KAFKA_ORDER_GROUP_ID,
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        print("Kafka Order DB Consumer 연결 성공")
        break
    except NoBrokersAvailable:
        print("Kafka 연결 실패, 재시도...")
        time.sleep(5)

# -----------------------------
# 시간 변환
# -----------------------------
def to_datetime(iso_time_str):
    try:
        return datetime.fromisoformat(iso_time_str)
    except:
        return datetime.utcnow()

# -----------------------------
# 주문 생성 (INSERT)
# -----------------------------
def insert_order(conn, data, payload):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO market_order (
                market_order_id,
                item_id,
                company_id,
                order_type,
                price,
                total_quantity,
                remaining_quantity,
                status,
                is_virtual,
                created_at,
                updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (
            payload["order_id"],
            payload["item_id"],
            # data.get("company_id"),
            int(data.get("company_id").replace("c", "")),
            payload["side"],
            payload["price"],
            payload["quantity"],
            payload.get("remaining_quantity", payload["quantity"]),
            payload.get("status", "PENDING"),
            payload.get("is_virtual", False),
            to_datetime(payload.get("created_at")),
            to_datetime(payload.get("created_at"))
        ))

# -----------------------------
# 주문 취소 (UPDATE)
# -----------------------------
def cancel_order(conn, payload):
    cancelled_at = to_datetime(payload.get("cancelled_at"))
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE market_order
            SET status = 'CANCELED',
                updated_at = %s
            WHERE market_order_id = %s
        """, (cancelled_at, payload["order_id"]))


def process_event_with_retry(conn, event_type, data, payload, retries=20, delay=0.5):
    order_id = payload.get("order_id")

    for attempt in range(retries):
        try:
            if event_type == "market.order.created":
                insert_order(conn, data, payload)
            elif event_type == "market.order.cancelled":
                cancel_order(conn, payload)
            else:
                print(f"[INFO] 알 수 없는 이벤트: {event_type}")
                return False

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()

            if attempt == retries - 1:
                print(f"[ERROR] {event_type} 최종 실패 → order_id={order_id}, error={e}")
                raise

            print(
                f"[RETRY] {event_type} 재시도 중 ({attempt + 1}/{retries}) "
                f"→ order_id={order_id}, error={e}"
            )
            time.sleep(delay)

# -----------------------------
# 메인 루프
# -----------------------------
conn = get_connection()
conn.autocommit = False

print("DB Consumer 시작...")

for message in consumer:
    try:
        data = message.value
        event_type = data.get("event_type")
        payload = data.get("payload")
        # print(json.dumps(data, indent=2, ensure_ascii=False))

        if not payload:
            continue

        success = process_event_with_retry(conn, event_type, data, payload)
        if not success:
            continue

        # Kafka commit
        consumer.commit()

        # print(f"[SUCCESS] {event_type} 처리 완료")

    except Exception as e:
        print(f"[ERROR] {e}")
        conn.rollback()
