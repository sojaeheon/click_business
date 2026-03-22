import time
import json
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
            bootstrap_servers='kafka:29092',
            auto_offset_reset='earliest',
            enable_auto_commit=False,
            group_id='trade-db-consumer',
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

# -----------------------------
# order 존재 확인 (retry)
# -----------------------------
def wait_for_order(cur, order_id, retries=5, delay=0.2):
    for i in range(retries):
        cur.execute("""
            SELECT 1 FROM market_order WHERE market_order_id = %s
        """, (order_id,))
        if cur.fetchone():
            return True

        print(f"[RETRY] order 확인 중 ({i+1}/{retries}) → {order_id}")
        time.sleep(delay)

    return False

# -----------------------------
# 체결 저장 (핵심)
# -----------------------------
def insert_trade(conn, data, payload):
    with conn.cursor() as cur:

        price = payload["price"]
        quantity = payload["quantity"]
        executed_at = to_datetime(payload.get("executed_at"))

        buy_order_id = payload["buy_order_id"]
        sell_order_id = payload["sell_order_id"]

        # -----------------------------
        # order 존재 확인
        # -----------------------------
        if not wait_for_order(cur, buy_order_id) or not wait_for_order(cur, sell_order_id):
            print(f"[SKIP] order 없음 → buy={buy_order_id}, sell={sell_order_id}")
            return False

        # -----------------------------
        # BUY row
        # -----------------------------
        cur.execute("""
            INSERT INTO trade_history (
                market_order_id,
                order_type,
                price,
                execution_quantity,
                is_collected,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            buy_order_id,
            "BUY",
            price,
            quantity,
            False,
            executed_at
        ))

        # -----------------------------
        # SELL row
        # -----------------------------
        cur.execute("""
            INSERT INTO trade_history (
                market_order_id,
                order_type,
                price,
                execution_quantity,
                is_collected,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            sell_order_id,
            "SELL",
            price,
            quantity,
            False,
            executed_at
        ))

        return True

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

        if not payload:
            print("[WARN] payload 없음")
            continue

        if event_type == "market.trade.executed":
            success = insert_trade(conn, data, payload)
            if not success:
                conn.rollback()
                continue
        else:
            print(f"[INFO] 알 수 없는 이벤트: {event_type}")
            continue

        # DB commit
        conn.commit()

        # Kafka commit
        consumer.commit()

        print(f"[SUCCESS] trade 저장 완료 → buy={payload.get('buy_order_id')}, sell={payload.get('sell_order_id')}")

    except Exception as e:
        print(f"[ERROR] {e}")
        conn.rollback()