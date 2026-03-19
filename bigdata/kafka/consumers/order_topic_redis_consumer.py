import time
import json
import redis
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

# -----------------------------
# Redis 연결
# -----------------------------
r = redis.Redis(host='localhost', port=6379, db=0)

# -----------------------------
# Kafka 연결
# -----------------------------
while True:
    try:
        consumer = KafkaConsumer(
            'market.order.events',
            bootstrap_servers='localhost:9092',
            auto_offset_reset='latest', # earliest
            enable_auto_commit=True,
            group_id='order-consumer',
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        print("Kafka Consumer 연결 성공")
        break
    except NoBrokersAvailable:
        print("Kafka 브로커 연결 실패, 5초 후 재시도...")
        time.sleep(5)

# -----------------------------
# 호가창 Score 계산
# -----------------------------
def compute_score(side, price, timestamp_ms):
    # ts_fraction = timestamp_ms / 10**12
    # if side.upper() == "BUY":
    #     return price + (1 - ts_fraction)    # 매수: 높은 가격 우선
    # else:
    #     return price + ts_fraction          # 매도: 낮은 가격 우선
    if side == "BUY":
        return -price * 10**13 + timestamp_ms
    else:
        return price * 10**13 + timestamp_ms

# -----------------------------
# 주문 저장
# -----------------------------
def save_order(data, payload):
    company_id = data.get("company_id")
    order_id = payload["order_id"]
    item_id = payload["item_id"]
    side = payload["side"].upper()
    price = payload["price"]
    quantity = payload["quantity"]
    is_virtual = payload.get("is_virtual", False)
    created_at = payload.get("created_at", str(int(time.time())))
    updated_at = payload.get("created_at", str(int(time.time())))
    status = payload.get("status", "OPEN")
    remaining_quantity = payload.get("remaining_quantity", quantity)
    
    timestamp_ms = int(time.time() * 1000)
    score = compute_score(side, price, timestamp_ms)

    # 주문 상세 정보 HASH
    order_key = f"market:order:{order_id}"
    r.hset(order_key, mapping={
        "company_id": company_id,
        "order_id": order_id,
        "item_id": item_id,
        "side": side,
        "price": price,
        "quantity": quantity,
        "remaining_quantity": remaining_quantity,
        "status": status,
        "is_virtual": int(is_virtual),
        "created_at": created_at,
        "updated_at": updated_at
    })

    # 호가창 ZSET
    zset_key = f"market:orderbook:{item_id}:buy" if side == "BUY" else f"market:orderbook:{item_id}:sell"
    r.zadd(zset_key, {str(order_id): score})

    print(f"[CREATE] Order 저장 완료: {order_id} -> {zset_key} (Score: {score})")

# -----------------------------
# 주문 취소
# -----------------------------
def cancel_order(data, payload):
    company_id = data.get("company_id")
    order_id = payload["order_id"]
    item_id = payload["item_id"]
    side = payload["side"].upper()

    # 호가창에서 제거
    zset_key = f"market:orderbook:{item_id}:buy" if side == "BUY" else f"market:orderbook:{item_id}:sell"
    r.zrem(zset_key, order_id)

    # 주문 상세 정보 HASH 상태 업데이트
    order_key = f"market:order:{order_id}"
    r.hset(order_key, "status", "CANCELLED")
    r.hset(order_key, "cancelled_at", payload.get("cancelled_at", str(int(time.time()))))

    print(f"[CANCEL] Order 취소 완료: {order_id} -> {zset_key}")

# -----------------------------
# Kafka 메시지 처리 루프
# -----------------------------
for message in consumer:
    data = message.value
    print(json.dumps(message.value, indent=4, ensure_ascii=False))

    event_type = data.get("event_type")
    payload = data.get("payload")

    if not payload:
        continue

    if event_type == "market.order.created":
        save_order(data, payload)
    elif event_type == "market.order.cancelled":
        cancel_order(data, payload)
    else:
        print(f"[INFO] 알 수 없는 이벤트: {event_type}")
