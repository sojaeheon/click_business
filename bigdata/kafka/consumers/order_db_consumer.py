import json
import os
import time
from datetime import datetime

import psycopg2
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable


SKIP_VIRTUAL_EVENTS = os.getenv("SKIP_VIRTUAL_EVENTS", "false").lower() == "true"


def get_connection():
    return psycopg2.connect(
        host="postgres-db",
        port=5432,
        database="ecosim",
        user="ecosim",
        password="ecosim",
    )


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
                group_id="order-db-consumer",
                value_deserializer=lambda value: json.loads(value.decode("utf-8")),
            )
        except NoBrokersAvailable:
            print("Kafka unavailable; retrying in 5 seconds")
            time.sleep(5)


def to_datetime(value):
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return datetime.utcnow()


def insert_order(conn, data, payload):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO market_order (
                market_order_id, item_id, company_id, order_type, price,
                total_quantity, remaining_quantity, status, is_virtual,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (
                payload["order_id"],
                payload["item_id"],
                int(str(data.get("company_id")).replace("c", "")),
                payload["side"],
                payload["price"],
                payload["quantity"],
                payload.get("remaining_quantity", payload["quantity"]),
                payload.get("status", "PENDING"),
                payload.get("is_virtual", False),
                to_datetime(payload.get("created_at")),
                to_datetime(payload.get("created_at")),
            ),
        )


def cancel_order(conn, payload):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE market_order
               SET status = 'CANCELED', updated_at = %s
             WHERE market_order_id = %s
            """,
            (to_datetime(payload.get("cancelled_at")), payload["order_id"]),
        )


def process_event(conn, data):
    event_type = data.get("event_type")
    payload = data.get("payload")
    if not payload:
        return
    if SKIP_VIRTUAL_EVENTS and payload.get("is_virtual", False):
        return

    if event_type == "market.order.created":
        insert_order(conn, data, payload)
    elif event_type == "market.order.cancelled":
        cancel_order(conn, payload)


consumer = create_consumer()
connection = get_connection()
connection.autocommit = False
print(f"Order DB consumer started (skip_virtual={SKIP_VIRTUAL_EVENTS})")

while True:
    batches = consumer.poll(timeout_ms=1000, max_records=500)
    if not batches:
        continue

    try:
        for messages in batches.values():
            for message in messages:
                process_event(connection, message.value)
        connection.commit()
        consumer.commit()
    except Exception as exc:
        connection.rollback()
        print(f"[ERROR] order DB batch failed: {exc}")
        time.sleep(1)
