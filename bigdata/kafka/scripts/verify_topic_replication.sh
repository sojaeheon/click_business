#!/bin/bash
set -euo pipefail

# 기존 단일 Broker 토픽은 --create --if-not-exists로 복제 계수가 바뀌지 않는다.
# Broker 3대가 모두 기동된 뒤 이 스크립트로 실제 복제 계수를 확인한다.
BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-2:29092,kafka-3:29092}"
TOPICS=(market.order.events market.trade.events warehouse.events company.events)

for topic in "${TOPICS[@]}"; do
  /usr/bin/kafka-topics --bootstrap-server "$BOOTSTRAP" --describe --topic "$topic"
done
