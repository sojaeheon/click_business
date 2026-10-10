#!/bin/bash
set -euo pipefail

# __consumer_offsets는 기존 Broker 1대에서 복제 1로 생성되어 있었다.
# 50개 파티션을 Broker 1,2,3에 3중 복제로 재배치한다.
BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-2:29092,kafka-3:29092}"
REASSIGNMENT_FILE="/tmp/offsets-reassignment.json"

printf '{"version":1,"partitions":[' > "$REASSIGNMENT_FILE"
for partition in $(seq 0 49); do
  case $((partition % 3)) in
    0) replicas='[1,2,3]' ;;
    1) replicas='[2,3,1]' ;;
    2) replicas='[3,1,2]' ;;
  esac
  [ "$partition" -gt 0 ] && printf ',' >> "$REASSIGNMENT_FILE"
  printf '{"topic":"__consumer_offsets","partition":%s,"replicas":%s}' \
    "$partition" "$replicas" >> "$REASSIGNMENT_FILE"
done
printf ']}' >> "$REASSIGNMENT_FILE"

/usr/bin/kafka-reassign-partitions \
  --bootstrap-server "$BOOTSTRAP" \
  --reassignment-json-file "$REASSIGNMENT_FILE" \
  --execute
