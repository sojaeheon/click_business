import json
import time
import redis
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

# -----------------------------
# Redis 연결
# -----------------------------
r = redis.Redis(host='redis', port=6379, db=0)

# -----------------------------
# Kafka 연결
# -----------------------------
while True:
    try:
        consumer = KafkaConsumer(
            'market.trade.events',
            bootstrap_servers='kafka:29092',
            auto_offset_reset='latest',
            enable_auto_commit=True,
            group_id='trade-consumer',
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        print("Kafka Trade Consumer 연결 성공")
        break
    except NoBrokersAvailable:
        print("Kafka 브로커 연결 실패, 5초 후 재시도...")
        time.sleep(5)

# -----------------------------
# 체결 이벤트 처리
# -----------------------------
print("Trade 이벤트 수신 대기 중...")
for message in consumer:
    data = message.value
    print("Trade 이벤트: ", json.dumps(data, indent=4, ensure_ascii=False))

    payload = data.get("payload", {})
    trade_id = payload.get("trade_id")
    item_id = payload.get("item_id")
    buy_order_id = payload.get("buy_order_id")
    sell_order_id = payload.get("sell_order_id")
    price = payload.get("price")
    quantity = payload.get("quantity")
    buy_remaining = payload.get("buy_remaining_quantity")
    sell_remaining = payload.get("sell_remaining_quantity")
    executed_at = payload.get("executed_at")

    print(f"💰 체결 상세 - Item: {item_id}, Price: {price}, Qty: {quantity}, Executed At: {executed_at}")
    print(f"   Buy Order: {buy_order_id} 남은 수량: {buy_remaining}")
    print(f"   Sell Order: {sell_order_id} 남은 수량: {sell_remaining}")

    # -----------------------------
    # Redis에서 남은 수량 업데이트 확인
    # -----------------------------
    buy_order_key = f"market:order:{buy_order_id}"
    sell_order_key = f"market:order:{sell_order_id}"

    buy_data = r.hgetall(buy_order_key)
    sell_data = r.hgetall(sell_order_key)

    if buy_data:
        print(f"🔹 Redis Buy Order {buy_order_id}: 남은 수량 = {buy_data.get(b'remaining_quantity')}")
    else:
        print(f"🔹 Redis Buy Order {buy_order_id}: 체결 완료, Redis에서 제거됨")

    if sell_data:
        print(f"🔹 Redis Sell Order {sell_order_id}: 남은 수량 = {sell_data.get(b'remaining_quantity')}")
    else:
        print(f"🔹 Redis Sell Order {sell_order_id}: 체결 완료, Redis에서 제거됨")