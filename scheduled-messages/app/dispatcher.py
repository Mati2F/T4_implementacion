import json
import logging
import time
from datetime import (
    datetime,
    timedelta,
    timezone
)

import httpx
import pika
from pymongo import ReturnDocument

from app.config import (
    DISPATCH_QUEUE,
    MAX_DISPATCH_ATTEMPTS,
    MESSAGES_URL,
    RABBITMQ_URL,
    RETRY_DELAY_SECONDS
)
from app.database import (
    create_indexes,
    schedules
)
from app.event_bus import (
    configure_rabbitmq,
    emit_event
)


logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(
    "scheduled-messages.dispatcher"
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def remove_mongo_id(document: dict) -> dict:
    result = document.copy()
    result.pop("_id", None)
    return result


def claim_schedule(
    schedule_id: str
) -> dict | None:
    return schedules.find_one_and_update(
        {
            "id": schedule_id,
            "status": "queued"
        },
        {
            "$set": {
                "status": "processing",
                "updated_at": utc_now()
            },
            "$inc": {
                "attempts": 1
            }
        },
        return_document=ReturnDocument.AFTER
    )


def mark_as_sent(
    schedule: dict,
    message: dict
) -> None:
    schedules.update_one(
        {"id": schedule["id"]},
        {
            "$set": {
                "status": "sent",
                "message_id": message["id"],
                "last_error": None,
                "next_attempt_at": None,
                "updated_at": utc_now()
            }
        }
    )

    emit_event(
        "chat.scheduled-message.sent",
        schedule["id"],
        {
            "schedule_id": schedule["id"],
            "message_id": message["id"],
            "channel_id": schedule["channel_id"]
        }
    )


def mark_as_failed(
    schedule: dict,
    error_message: str,
    retryable: bool
) -> None:
    can_retry = (
        retryable
        and schedule["attempts"]
        < MAX_DISPATCH_ATTEMPTS
    )

    new_status = (
        "retrying"
        if can_retry
        else "failed"
    )

    next_attempt = (
        utc_now()
        + timedelta(
            seconds=RETRY_DELAY_SECONDS
        )
        if can_retry
        else None
    )

    schedules.update_one(
        {"id": schedule["id"]},
        {
            "$set": {
                "status": new_status,
                "last_error": error_message,
                "next_attempt_at": next_attempt,
                "updated_at": utc_now()
            }
        }
    )

    event_type = (
        "chat.scheduled-message.retry-scheduled"
        if can_retry
        else "chat.scheduled-message.failed"
    )

    emit_event(
        event_type,
        schedule["id"],
        {
            "schedule_id": schedule["id"],
            "error": error_message,
            "attempts": schedule["attempts"]
        }
    )


def dispatch(event: dict) -> None:
    schedule_id = event["data"]["schedule_id"]

    schedule = claim_schedule(schedule_id)

    # Si el evento fue entregado dos veces,
    # solo la primera entrega encontrará queued.
    if schedule is None:
        logger.info(
            "Evento duplicado ignorado: %s",
            schedule_id
        )
        return

    schedule = remove_mongo_id(schedule)

    emit_event(
        "chat.scheduled-message.processing",
        schedule_id,
        schedule
    )

    try:
        response = httpx.post(
            (
                f"{MESSAGES_URL}/api/v1/channels/"
                f"{schedule['channel_id']}/messages"
            ),
            json={
                "author_id": schedule["author_id"],
                "content": schedule["content"]
            },
            timeout=5
        )

        response.raise_for_status()

    except httpx.ConnectError as error:
        mark_as_failed(
            schedule,
            str(error),
            retryable=True
        )
        return

    except httpx.TimeoutException as error:
        # No se reintenta automáticamente porque
        # messages podría haber creado el mensaje
        # antes de producirse el timeout.
        mark_as_failed(
            schedule,
            str(error),
            retryable=False
        )
        return

    except httpx.HTTPStatusError as error:
        mark_as_failed(
            schedule,
            (
                f"messages respondió "
                f"{error.response.status_code}"
            ),
            retryable=(
                error.response.status_code >= 500
            )
        )
        return

    mark_as_sent(
        schedule,
        response.json()
    )


def consume() -> None:
    connection = pika.BlockingConnection(
        pika.URLParameters(RABBITMQ_URL)
    )

    channel = connection.channel()

    configure_rabbitmq(channel)

    channel.basic_qos(
        prefetch_count=1
    )

    def callback(
        current_channel,
        method,
        _properties,
        body
    ):
        try:
            event = json.loads(body)

            dispatch(event)

            current_channel.basic_ack(
                delivery_tag=method.delivery_tag
            )

        except (
            json.JSONDecodeError,
            KeyError,
            TypeError
        ):
            logger.exception(
                "Evento inválido"
            )

            current_channel.basic_nack(
                delivery_tag=method.delivery_tag,
                requeue=False
            )

        except Exception:
            logger.exception(
                "Error inesperado"
            )

            current_channel.basic_nack(
                delivery_tag=method.delivery_tag,
                requeue=True
            )

    channel.basic_consume(
        queue=DISPATCH_QUEUE,
        on_message_callback=callback
    )

    logger.info(
        "Dispatcher esperando mensajes"
    )

    channel.start_consuming()


def run() -> None:
    create_indexes()

    while True:
        try:
            consume()

        except pika.exceptions.AMQPError:
            logger.exception(
                "RabbitMQ no disponible"
            )

            time.sleep(5)


if __name__ == "__main__":
    run()