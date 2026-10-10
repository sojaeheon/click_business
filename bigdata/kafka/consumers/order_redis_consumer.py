import json
import os
import time
from datetime import datetime

import redis
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable


SKIP_VIRTUAL_EVENTS = os.getenv("SKIP_VIRTUAL_EVENTS", "false").lower() == "true"

redis_client = redis.Redis(host="redis", port=6379, db=0, decode_responses=True)


def create_consumer():
    while True:
        try:
            return KafkaConsumer(
                "market.order.events",
                bootstrap_servers=os.getenv(
                    "KAFKA_BOOTSTRAP_SERVERS",
                    "kafka:29092,kafka-2:29092,kafka-3:29092",
                ),
                auto_offset_reset="earliest",
                enable_auto_commit=False,
                group_id="order-redis-consumer",
                value_deserializer=lambda value: json.loads(value.decode("utf-8")),
            )
        except NoBrokersAvailable:
            print("Kafka unavailable; retrying in 5 seconds")
            time.sleep(5)


def to_epoch_millis(value):
    try:
        return int(datetime.fromisoformat(value).timestamp() * 1000)
    except Exception:
        return int(time.time() * 1000)


def compute_score(side, price, timestamp_ms):
    score = price * 10**6 + timestamp_ms % 10**6
    return -score if side == "BUY" else score


def save_order(data, payload):
    order_id = payload["order_id"]
    item_id = payload["item_id"]
    side = payload["side"].upper()
    price = payload["price"]
    quantity = payload["quantity"]
    created_at_ms = to_epoch_millis(payload.get("created_at"))
    score = compute_score(side, price, created_at_ms)

    pipe = redis_client.pipeline(transaction=False)
    pipe.hset(
        f"market:order:{order_id}",
        mapping={
            "companyId": str(data.get("company_id")),
            "orderId": str(order_id),
            "itemId": str(item_id),
            "orderType": side,
            "price": str(price),
            "totalQuantity": str(quantity),
            "remainingQuantity": str(payload.get("remaining_quantity", quantity)),
            "status": payload.get("status", "PENDING"),
            "isVirtual": "true" if payload.get("is_virtual", False) else "false",
            "createdAt": str(created_at_ms),
            "updatedAt": str(created_at_ms),
        },
    )
    orderbook_key = (
        f"market:orderbook:{item_id}:buy"
        if side == "BUY"
        else f"market:orderbook:{item_id}:sell"
    )
    pipe.zadd(orderbook_key, {str(order_id): score})
    pipe.execute()


def cancel_order(payload):
    order_id = payload["order_id"]
    item_id = payload["item_id"]
    side = payload["side"].upper()
    cancelled_at_ms = to_epoch_millis(payload.get("cancelled_at"))
    orderbook_key = (
        f"market:orderbook:{item_id}:buy"
        if side == "BUY"
        else f"market:orderbook:{item_id}:sell"
    )

    pipe = redis_client.pipeline(transaction=False)
    pipe.zrem(orderbook_key, order_id)
    pipe.hset(
        f"market:order:{order_id}",
        mapping={
            "status": "CANCELED",
            "cancelledAt": str(cancelled_at_ms),
            "updatedAt": str(cancelled_at_ms),
        },
    )
    pipe.execute()


def process_event(data):
    event_type = data.get("event_type")
    payload = data.get("payload")
    if not payload:
        return
    if SKIP_VIRTUAL_EVENTS and payload.get("is_virtual", False):
        return

    if event_type == "market.order.created":
        save_order(data, payload)
    elif event_type == "market.order.cancelled":
        cancel_order(payload)


consumer = create_consumer()
print(f"Order Redis consumer started (skip_virtual={SKIP_VIRTUAL_EVENTS})")

while True:
    batches = consumer.poll(timeout_ms=1000, max_records=500)
    if not batches:
        continue

    try:
        for messages in batches.values():
            for message in messages:
                process_event(message.value)
        consumer.commit()
    except Exception as exc:
        print(f"[ERROR] order Redis batch failed: {exc}")
        time.sleep(1)
