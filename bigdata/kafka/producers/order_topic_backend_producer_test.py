from kafka import KafkaProducer
import json
import time
import uuid
from datetime import datetime

producer = KafkaProducer(
    bootstrap_servers='localhost:9092',  # Docker host 기준
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

# 테스트용 메시지
message = {
    "event_id": str(uuid.uuid4()),
    "event_time": datetime.utcnow().isoformat() + "Z",
    "event_type": "ORDER_CREATED",
    "market_order_id": 123,
    "item": 1,
    "company_id": 10,
    "order_type": "BUY",
    "price": 1000,
    "total_quantity": 5,
    "remaining_quantity": 5,
    "status": "OPEN",
    "is_virtual": False,
    "created_at": datetime.utcnow().isoformat() + "Z",
    "updated_at": datetime.utcnow().isoformat() + "Z"
}

# Kafka로 보내기
producer.send('order.events', value=message)
producer.flush()  # 보내기 완료
print("Kafka로 보낸 메시지:", message)