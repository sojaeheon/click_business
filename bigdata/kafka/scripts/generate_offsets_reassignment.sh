#!/bin/bash
set -euo pipefail

BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092,kafka-2:29092,kafka-3:29092}"
TOPICS_FILE="/tmp/offsets-topics.json"

cat > "$TOPICS_FILE" <<'JSON'
{"version": 1, "topics": [{"topic": "__consumer_offsets"}]}
JSON

/usr/bin/kafka-reassign-partitions \
  --bootstrap-server "$BOOTSTRAP" \
  --topics-to-move-json-file "$TOPICS_FILE" \
  --broker-list "1,2,3" \
  --generate
