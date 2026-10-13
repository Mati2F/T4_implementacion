import json
from datetime import datetime, timezone
from uuid import uuid4

import pika

from app.config import (
    DISPATCH_QUEUE,
    DISPATCH_ROUTING_KEY,
    EXCHANGE_NAME,
    RABBITMQ_URL
)

from app.database import events


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def json_default(value):
    if isinstance(value, datetime):
        return value.isoformat()

    raise TypeError(
        f"No se puede serializar {type(value)}"
    )


def configure_rabbitmq(channel) -> None:
    channel.exchange_declare(
        exchange=EXCHANGE_NAME,
        exchange_type="topic",
        durable=True
    )

    channel.queue_declare(
        queue=DISPATCH_QUEUE,
        durable=True
    )

    channel.queue_bind(
        exchange=EXCHANGE_NAME,
        queue=DISPATCH_QUEUE,
        routing_key=DISPATCH_ROUTING_KEY
    )


def save_event(
    event_type: str,
    subject_id: str,
    data: dict
) -> dict:
    event = {
        "id": str(uuid4()),
        "type": event_type,
        "subject_id": subject_id,
        "occurred_at": utc_now(),
        "data": data,
        "published": False,
        "published_at": None
    }

    events.insert_one(event.copy())

    return event


def publish_event(event: dict) -> bool:
    payload = {
        "id": event["id"],
        "type": event["type"],
        "subject_id": event["subject_id"],
        "occurred_at": event["occurred_at"],
        "data": event["data"]
    }

    try:
        connection = pika.BlockingConnection(
            pika.URLParameters(RABBITMQ_URL)
        )

        channel = connection.channel()

        configure_rabbitmq(channel)

        channel.basic_publish(
            exchange=EXCHANGE_NAME,
            routing_key=event["type"],
            body=json.dumps(
                payload,
                default=json_default
            ).encode("utf-8"),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
                message_id=event["id"]
            )
        )

        connection.close()

    except pika.exceptions.AMQPError:
        return False

    events.update_one(
        {"id": event["id"]},
        {
            "$set": {
                "published": True,
                "published_at": utc_now()
            }
        }
    )

    return True


def emit_event(
    event_type: str,
    subject_id: str,
    data: dict
) -> dict:
    event = save_event(
        event_type,
        subject_id,
        data
    )

    publish_event(event)

    return event


def publish_pending_events() -> None:
    pending_events = (
        events
        .find({"published": False})
        .sort("occurred_at", 1)
        .limit(100)
    )

    for event in pending_events:
        event.pop("_id", None)

        if not publish_event(event):
            break