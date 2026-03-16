import time
from kafka import KafkaConsumer
import json
import redis
from kafka.errors import NoBrokersAvailable

# Redis 연결
r = redis.Redis(host='localhost', port=6379, db=0)

while True:
    try:
        consumer = KafkaConsumer(
            'order.events',
            bootstrap_servers='localhost:9092',
            auto_offset_reset='earliest',
            enable_auto_commit=True,
            group_id='my-group',
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        print("Kafka Consumer 연결 성공")
        break
    except NoBrokersAvailable:
        print("Kafka 브로커 연결 실패, 5초 후 재시도...")
        time.sleep(5)

for message in consumer:
    data = message.value
    print("Kafka에서 받은 메시지:", data)

    print("Redis ping:", r.ping())

    key = data.get('event_id', 'default')
    print("Redis 저장 시도:", key)

    r.set(key, json.dumps(data))

    print("Redis 저장 완료")