import time
import json
import redis
from datetime import datetime
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

# -----------------------------
# Redis 연결
# -----------------------------
r = redis.Redis(
    host='localhost',
    port=6379,
    db=0,
    decode_responses=True
)

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

def to_epoch_millis(iso_time_str):
    try:
        return int(datetime.fromisoformat(iso_time_str).timestamp() * 1000)
    except Exception:
        return int(time.time() * 1000)

# -----------------------------
# 호가창 Score 계산
# -----------------------------
def compute_score(side, price, timestamp_ms):
    # ts_fraction = timestamp_ms / 10**12
    # if side.upper() == "BUY":
    #     return price + (1 - ts_fraction)    # 매수: 높은 가격 우선
    # else:
    #     return price + ts_fraction          # 매도: 낮은 가격 우선
    # if side == "BUY":
    #     return -(price * 10**13) - timestamp_ms
    # else:
    #     return (price * 10**13) + timestamp_ms
    # 가격을 상위 비트로, 시간을 하위 비트로 처리 (정밀도 유의)
    if side == "BUY":
        return -float(f"{price}.{timestamp_ms}") # 높은 가격 우선
    else:
        return float(f"{price}.{timestamp_ms}")  # 낮은 가격 우선

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

    created_at_ms = to_epoch_millis(payload.get("created_at"))
    updated_at_ms = created_at_ms

    status = payload.get("status", "OPEN")
    remaining_quantity = payload.get("remaining_quantity", quantity)

    score = compute_score(side, price, created_at_ms)

    # 주문 상세 정보 HASH
    order_key = f"market:order:{order_id}"
    r.hset(order_key, mapping={
        "company_id": str(company_id),
        "order_id": str(order_id),
        "item_id": str(item_id),
        "side": side,
        "price": str(price),
        "quantity": str(quantity),
        "remaining_quantity": str(remaining_quantity),
        "status": status,
        "is_virtual": str(int(is_virtual)),
        "created_at": str(created_at_ms),
        "updated_at": str(updated_at_ms)
    })

    # # 주문 상세 정보 JSON
    # order_data = {
    #     "company_id": company_id,
    #     "order_id": order_id,
    #     "item_id": item_id,
    #     "side": side,
    #     "price": price,
    #     "quantity": quantity,
    #     "remaining_quantity": remaining_quantity,
    #     "status": status,
    #     "is_virtual": is_virtual,
    #     "created_at": created_at_ms,
    #     "updated_at": updated_at_ms
    # }
    # order_key = f"market:order:{order_id}"
    # r.set(order_key, json.dumps(order_data))    

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

    order_key = f"market:order:{order_id}"

    # # HASH
    # if r.exists(order_key):
    #     r.hset(order_key, mapping={
    #         "status": "CANCELLED",
    #         "cancelled_at": payload.get("cancelled_at", str(int(time.time())))
    #     })

    # HASH 상태 업데이트
    if r.exists(order_key):
        r.hset(order_key, mapping={
            "status": "CANCELLED",
            "cancelled_at": str(int(time.time() * 1000))
        })

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
