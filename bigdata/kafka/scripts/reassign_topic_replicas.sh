#!/bin/bash
set -euo pipefail

# 기존 단일 Broker 토픽을 Broker 1, 2, 3에 3중 복제한다.
# 토픽 데이터는 삭제하지 않으며, Kafka가 백그라운드에서 replica를 복사한다.
BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-2:29092,kafka-3:29092}"
REASSIGNMENT_FILE="/tmp/ecosim-topic-reassignment.json"
TOPICS=(market.order.events market.trade.events warehouse.events company.events)

# 이전 단일 Broker 구성이 만든 1 파티션 토픽을 3 파티션으로 확장한다.
# 파티션 확장은 기존 이벤트를 삭제하지 않는다. 단, 이후 동일 key의 파티션은
# 증가한 파티션 수 기준으로 배정될 수 있으므로 consumer는 key별 순서만 가정해야 한다.
for topic in "${TOPICS[@]}"; do
  partition_count=$(
    /usr/bin/kafka-topics --bootstrap-server "$BOOTSTRAP" --describe --topic "$topic" \
      | sed -n 's/.*PartitionCount: \([0-9][0-9]*\).*/\1/p' \
      | head -n 1
  )
  if [ "${partition_count:-0}" -lt 3 ]; then
    /usr/bin/kafka-topics --bootstrap-server "$BOOTSTRAP" --alter --topic "$topic" --partitions 3
  fi
done

cat > "$REASSIGNMENT_FILE" <<'JSON'
{
  "version": 1,
  "partitions": [
    {"topic": "market.order.events", "partition": 0, "replicas": [1, 2, 3]},
    {"topic": "market.order.events", "partition": 1, "replicas": [2, 3, 1]},
    {"topic": "market.order.events", "partition": 2, "replicas": [3, 1, 2]},
    {"topic": "market.trade.events", "partition": 0, "replicas": [1, 2, 3]},
    {"topic": "market.trade.events", "partition": 1, "replicas": [2, 3, 1]},
    {"topic": "market.trade.events", "partition": 2, "replicas": [3, 1, 2]},
    {"topic": "warehouse.events", "partition": 0, "replicas": [1, 2, 3]},
    {"topic": "warehouse.events", "partition": 1, "replicas": [2, 3, 1]},
    {"topic": "warehouse.events", "partition": 2, "replicas": [3, 1, 2]},
    {"topic": "company.events", "partition": 0, "replicas": [1, 2, 3]},
    {"topic": "company.events", "partition": 1, "replicas": [2, 3, 1]},
    {"topic": "company.events", "partition": 2, "replicas": [3, 1, 2]}
  ]
}
JSON

/usr/bin/kafka-reassign-partitions \
  --bootstrap-server "$BOOTSTRAP" \
  --reassignment-json-file "$REASSIGNMENT_FILE" \
  --execute

echo "Reassignment started. Run verify_topic_replication.sh until every partition has Replicas: 1,2,3."
