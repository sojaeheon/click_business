from kafka import KafkaProducer
import time
import json
import uuid
from datetime import datetime

'''
# 예시: 주문 생성 이벤트
message_created = {
    "event_id": str(uuid.uuid4()),
    "event_type": "market.order.created",
    "event_version": 1,
    "occurred_at": datetime.utcnow().isoformat() + "Z",
    "producer": "market-service",
    "company_id": "c001",
    "aggregate_id": "order_123",
    "payload": {
        "order_id": 123,
        "item_id": 1,
        "side": "BUY",
        "price": 1000,
        "quantity": 5,
        "is_virtual": False,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
}

# 예시: 주문 취소 이벤트
message_cancelled = {
    "event_id": str(uuid.uuid4()),
    "event_type": "market.order.cancelled",
    "event_version": 1,
    "occurred_at": datetime.utcnow().isoformat() + "Z",
    "producer": "market-service",
    "company_id": "c001",
    "aggregate_id": "order_123",
    "payload": {
        "order_id": 123,
        "item_id": 1,
        "side": "BUY",
        "price": 1000,
        "quantity": 5,
        "cancelled_at": datetime.utcnow().isoformat() + "Z"
    }
}
'''

# Kakfa 연결 (Docker 기준)
producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

def send(order_id, side, price):
    message = {
        "event_id": str(uuid.uuid4()),
        "event_type": "market.order.created",
        "event_version": 1,
        "occurred_at": time.time(),
        "producer": "market-service",
        "company_id": "c001",
        "aggregate_id": f"order_{order_id}",
        "payload": {
            "order_id": order_id,
            "item_id": 1,
            "side": side,
            "price": price,
            "quantity": 1,
            "is_virtual": False,
            "created_at": time.time()
        }
    }
    producer.send('market.order.events', value=message)
    print(f"[SEND] {json.dumps(message, indent=2)}")
    time.sleep(0.01)

# 테스트 케이스
test_cases = [
    # BUY 10개
    (1, "BUY", 10000), (2, "BUY", 10100), (3, "BUY", 10200), (4, "BUY", 10300), (5, "BUY", 10400),
    (6, "BUY", 10050), (7, "BUY", 10150), (8, "BUY", 10250), (9, "BUY", 10350), (10, "BUY", 10450),
    # SELL 10개
    (11, "SELL", 10500), (12, "SELL", 10400), (13, "SELL", 10300), (14, "SELL", 10200), (15, "SELL", 10100),
    (16, "SELL", 10550), (17, "SELL", 10450), (18, "SELL", 10350), (19, "SELL", 10250), (20, "SELL", 10150),
]

# Kafka로 보내기
for order_id, side, price in test_cases:
    send(order_id, side, price)

producer.flush()

print("✅ 테스트 데이터 전송 완료")

# Kafka로 보내기
# producer.send('market.events', value=message_created)
# producer.send('market.events', value=message_cancelled)
# producer.flush()

# print("Kafka로 보낸 메시지:")
# print(json.dumps(message_created, indent=2))
# print(json.dumps(message_cancelled, indent=2))
