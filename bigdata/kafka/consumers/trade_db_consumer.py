import time
import json
import os
import psycopg2
from datetime import datetime
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

DB_HOST = os.getenv("DB_HOST", "postgres-db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "ecosim")
DB_USER = os.getenv("DB_USER", "ecosim")
DB_PASSWORD = os.getenv("DB_PASSWORD", "ecosim")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TRADE_TOPIC = os.getenv("KAFKA_TRADE_TOPIC", "market.trade.events")
KAFKA_TRADE_GROUP_ID = os.getenv("KAFKA_TRADE_GROUP_ID", "trade-db-consumer")
KAFKA_AUTO_OFFSET_RESET = os.getenv("KAFKA_AUTO_OFFSET_RESET", "latest")

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
            KAFKA_TRADE_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
            enable_auto_commit=False,
            group_id=KAFKA_TRADE_GROUP_ID,
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        print("Kafka Trade DB Consumer 연결 성공")
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


def resolve_order_status(remaining_quantity):
    return "COMPLETED" if remaining_quantity == 0 else "PARTIALLY_COMPLETED"


def update_market_order(cur, order_id, remaining_quantity, executed_at):
    cur.execute("""
        UPDATE market_order
        SET remaining_quantity = %s,
            status = %s,
            updated_at = %s
        WHERE market_order_id = %s
    """, (
        remaining_quantity,
        resolve_order_status(remaining_quantity),
        executed_at,
        order_id,
    ))

# -----------------------------
# 체결 저장 (핵심)
# -----------------------------
def insert_trade(conn, payload):
    price = payload["price"]
    quantity = payload["quantity"]
    executed_at = to_datetime(payload.get("executed_at"))
    item_id = payload["item_id"]

    buy_order_id = payload["buy_order_id"]
    sell_order_id = payload["sell_order_id"]
    buy_remaining_quantity = payload["buy_remaining_quantity"]
    sell_remaining_quantity = payload["sell_remaining_quantity"]

    with conn.cursor() as cur:
        # -----------------------------
        # BUY row
        # -----------------------------
        cur.execute("""
            INSERT INTO trade_history (
                market_order_id,
                item_id,
                order_type,
                price,
                execution_quantity,
                is_collected,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            buy_order_id,
            item_id,
            "BUY",
            price,
            quantity,
            False,
            executed_at
        ))

        update_market_order(cur, buy_order_id, buy_remaining_quantity, executed_at)

        # -----------------------------
        # SELL row
        # -----------------------------
        cur.execute("""
            INSERT INTO trade_history (
                market_order_id,
                item_id,
                order_type,
                price,
                execution_quantity,
                is_collected,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            sell_order_id,
            item_id,
            "SELL",
            price,
            quantity,
            False,
            executed_at
        ))

        update_market_order(cur, sell_order_id, sell_remaining_quantity, executed_at)

# -----------------------------
# 메인 루프
# -----------------------------
conn = get_connection()
conn.autocommit = False

print("Trade DB Consumer 시작...")
for message in consumer:
    try:
        data = message.value
        event_type = data.get("event_type")
        payload = data.get("payload")
        # print(json.dumps(data, indent=2, ensure_ascii=False))

        if not payload:
            print("[WARN] payload 없음")
            continue

        if event_type == "market.trade.executed":
            insert_trade(conn, payload)
        else:
            print(f"[INFO] 알 수 없는 이벤트: {event_type}")
            continue

        # DB commit
        conn.commit()

        # Kafka commit
        consumer.commit()

        # print(f"[SUCCESS] {event_type} 처리 완료")

    except Exception as e:
        print(f"[ERROR] {e}")
        conn.rollback()
