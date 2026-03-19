#!/bin/bash

# 에러 시 스크립트 종료
set -e

# 환경변수 설정
BOOTSTRAP=localhost:9092

# Kafka Broker 준비 대기 (최대 20초)
echo "Waiting for Kafka..."
# 로컬 테스트 환경에서는 cub 대신 nc나 단순 대기로 대체 가능하나 기존 로직 유지 시도
# cub kafka-ready -b $BOOTSTRAP 1 20 || echo "Kafka not ready, but trying anyway..."



# ==========================================
# Kafka Topic 생성 (단일 토픽: market.events)
# ==========================================
echo "Creating topics..."
/usr/bin/kafka-topics --create --if-not-exists \
  --bootstrap-server $BOOTSTRAP \
  --topic market.events \
  --partitions 3 \
  --replication-factor 1

# ==========================================
# Kafka Topic 생성 (단일 토픽: warehouse.events)
# ==========================================
/usr/bin/kafka-topics --create --if-not-exists \
  --topic warehouse.events \
  --bootstrap-server $BOOTSTRAP \
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

# Kafka Topic 조회
echo "Current topics:"
/usr/bin/kafka-topics --bootstrap-server $BOOTSTRAP --list
