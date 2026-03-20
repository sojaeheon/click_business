#!/bin/bash
# start.sh
python -u ./consumers/order_topic_redis_consumer.py &
python -u ./consumers/order_topic_db_consumer.py &
wait