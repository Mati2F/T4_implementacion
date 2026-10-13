import logging
import time
from datetime import datetime, timezone

from pymongo import ReturnDocument

from app.config import (
    SCHEDULER_INTERVAL_SECONDS
)
from app.database import (
    create_indexes,
    schedules
)
from app.event_bus import (
    emit_event,
    publish_pending_events
)


logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(
    "scheduled-messages.scheduler"
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def claim_due_schedule() -> dict | None:
    now = utc_now()

    return schedules.find_one_and_update(
        {
            "$or": [
                {
                    "status": "pending",
                    "scheduled_for": {
                        "$lte": now
                    }
                },
                {
                    "status": "retrying",
                    "next_attempt_at": {
                        "$lte": now
                    }
                }
            ]
        },
        {
            "$set": {
                "status": "queued",
                "next_attempt_at": None,
                "updated_at": now
            }
        },
        sort=[("scheduled_for", 1)],
        return_document=ReturnDocument.AFTER
    )


def enqueue_one_schedule() -> bool:
    schedule = claim_due_schedule()

    if schedule is None:
        return False

    emit_event(
        (
            "chat.scheduled-message."
            "dispatch-requested"
        ),
        schedule["id"],
        {
            "schedule_id": schedule["id"],
            "author_id": schedule["author_id"],
            "channel_id": schedule["channel_id"],
            "content": schedule["content"]
        }
    )

    logger.info(
        "Programación %s encolada",
        schedule["id"]
    )

    return True


def run() -> None:
    create_indexes()

    logger.info("Scheduler iniciado")

    while True:
        try:
            publish_pending_events()

            found_work = enqueue_one_schedule()

            if not found_work:
                time.sleep(
                    SCHEDULER_INTERVAL_SECONDS
                )

        except Exception:
            logger.exception(
                "Error en el scheduler"
            )

            time.sleep(
                SCHEDULER_INTERVAL_SECONDS
            )


if __name__ == "__main__":
    run()