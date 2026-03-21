#!/bin/bash

# 에러 시 스크립트 종료
set -e

# 환경변수 설정
BOOTSTRAP=kafka:29092

# Kafka Broker 준비 대기
echo "Waiting for Kafka to be ready..."
until /usr/bin/kafka-topics --bootstrap-server $BOOTSTRAP --list >/dev/null 2>&1; do
  echo "Kafka not ready yet..."
  sleep 2
done

# Kafka Topic 생성
echo "Creating topics..."

# 마켓 주문 이벤트
/usr/bin/kafka-topics --create --if-not-exists \
  --bootstrap-server $BOOTSTRAP \
  --topic market.order.events \
  --partitions 3 \
  --replication-factor 1

# 마켓 체결 이벤트
/usr/bin/kafka-topics --create --if-not-exists \
  --bootstrap-server $BOOTSTRAP \
  --topic market.trade.events \
  --partitions 3 \
  --replication-factor 1

# 창고 이벤트
/usr/bin/kafka-topics --create --if-not-exists \
  --bootstrap-server $BOOTSTRAP \
  --topic warehouse.events \
  --partitions 3 \
  --replication-factor 1

# ==========================================
# Kafka Topic 생성 (단일 토픽: company.events)
# ==========================================
/usr/bin/kafka-topics --create --if-not-exists \
  --bootstrap-server $BOOTSTRAP \
  --topic company.events \
  --partitions 3 \
  --replication-factor 1

echo "Topic creation completed."

# Kakfa Topic 조회
echo "Current topics:"
/usr/bin/kafka-topics --bootstrap-server $BOOTSTRAP --list
