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

### Market News 집계
```bash
# market 뉴스 후보 생성 배치 잡 실행
spark-submit \
  --master spark://spark-master:7077 \
  /opt/spark-apps/market_news_trigger.py \
  --window-minutes 10 \
  --reference-time 2026-03-22T14:30:00+09:00
```

```bash
# 기본값(10분 윈도우)으로 배치 실행
spark-submit \
  --master spark://spark-master:7077 \
  /opt/spark-apps/market_news_trigger.py
```

```bash
# 1분마다 자동 집계되는 Structured Streaming 잡 실행
spark-submit \
  --master spark://spark-master:7077 \
  /opt/spark-apps/market_news_streaming.py \
  --trigger-interval "10 minutes" \
  --window-minutes 10 \
  --checkpoint-path /tmp/checkpoints/market-news-stream
```

```bash
# 뉴스 후보를 읽어 LLM 기사 생성/DB 적재 초안 워커 실행
python3 /opt/spark-apps/market_news_generator.py
```

```bash
# 컨테이너 안에 직접 들어가지 않고 자동 실행
cd /home/eunsu/S14P21B109/bigdata
docker compose up -d spark-master spark-worker namenode datanode spark-market-news

# 로그 확인
docker logs -f spark-market-news
```
