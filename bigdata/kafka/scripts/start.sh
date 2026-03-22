#!/bin/bash
# start.sh
case "$CONSUMER_TYPE" in
  order_redis)
    python -u ./consumers/order_redis_consumer.py
    ;;
  order_db)
    python -u ./consumers/order_db_consumer.py
    ;;
  order_hdfs)
    python -u ./consumers/order_hdfs_consumer.py
    ;;
  trade_db)
    python -u ./consumers/trade_db_consumer.py
    ;;
  trade_hdfs)
    python -u ./consumers/trade_hdfs_consumer.py
    ;;
  *)
    echo "Unknown CONSUMER_TYPE"
    exit 1
    ;;
esac
