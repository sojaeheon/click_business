### 전체 구조
```
           Producer
              │
              ▼
        ┌───────────┐
        │   Kafka   │
        │ test-topic│
        └─────┬─────┘
              │
              ▼
        ┌───────────┐
        │   Spark   │
        │ Streaming │
        └─────┬─────┘
              │
              ▼
           Console
```

### docker-compose
```
# 네트워크 생성
docker network create ecosim-network

# 네트워크 확인
docker network ls

# kafka 컨테이너 실행
docker-compose -f docker-compose.kafka.yml up --build -d

# spark 컨테이너 실행
docker-compose -f docker-compose.spark.yml up --build -d

# 실행 중인 컨테이너 확인
docker ps
```

### Kafka
```
# Kafka 컨테이너 접속
docker exec -it kafka bash

# Topic 생성
kafka-topics \
--create \
--topic test-topic \
--bootstrap-server kafka:9092 \
--partitions 1 \
--replication-factor 1

# Topic 확인
kafka-topics --list --bootstrap-server kafka:9092

# Producer 확인
kafka-console-producer \
--topic test-topic \
--bootstrap-server kafka:9092

# Consumer 확인
kafka-console-consumer \
--topic test-topic \
--from-beginning \
--bootstrap-server kafka:9092
```

### Spark
```
# Spark 컨테이너 접속
docker exec -it spark-master bash

# 작업 디렉토리 이동
cd /opt/spark-apps

# 테스트 코드 실행
spark-submit --master spark://spark-master:7077 /opt/spark-apps/kafka_test.py
```