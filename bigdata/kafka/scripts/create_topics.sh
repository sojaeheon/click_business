#!/bin/bash

BOOTSTRAP=localhost:9092

kafka-topics.sh --create --if-not-exists \
  --bootstrap-server $BOOTSTRAP \
  --topic game.trade.raw \
  --partitions 3 \
  --replication-factor 1

kafka-topics.sh --create --if-not-exists \
  --bootstrap-server $BOOTSTRAP \
  --topic game.market.raw \
  --partitions 3 \
  --replication-factor 1

kafka-topics.sh --create --if-not-exists \
  --bootstrap-server $BOOTSTRAP \
  --topic game.user-event.raw \
  --partitions 3 \
  --replication-factor 1