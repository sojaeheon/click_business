import time
import json
import os
import psycopg2
from datetime import datetime
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

# -----------------------------
# PostgreSQL 연결
# -----------------------------
def get_connection():
    return psycopg2.connect(
        host="postgres-db",
        port=5432,
        database="ecosim",
        user="ecosim",
        password="ecosim"
    )

# -----------------------------
# Kafka 연결
# -----------------------------
while True:
    try:
        consumer = KafkaConsumer(
            'market.trade.events',
            bootstrap_servers=os.getenv(
                "KAFKA_BOOTSTRAP_SERVERS",
                "kafka:29092,kafka-2:29092,kafka-3:29092",
            ),
            auto_offset_reset='latest',
            enable_auto_commit=False,
            group_id='trade-db-consumer',
            # utf-8-sig also accepts normal UTF-8 and safely removes a BOM
            # from manually produced messages on Windows.
            value_deserializer=lambda x: json.loads(x.decode('utf-8-sig'))
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
            required_fields = (
                "price",
                "quantity",
                "item_id",
                "buy_order_id",
                "sell_order_id",
                "buy_remaining_quantity",
                "sell_remaining_quantity",
            )
            if any(payload.get(field) is None for field in required_fields):
                print("[WARN] incomplete trade event skipped from trade_history")
                consumer.commit()
                continue
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
