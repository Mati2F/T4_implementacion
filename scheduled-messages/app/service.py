from datetime import datetime, timezone
from uuid import uuid4

from pymongo import ReturnDocument

from app.database import schedules
from app.dependencies import (
    validate_channel,
    validate_user
)
from app.errors import (
    InvalidScheduledTime,
    ScheduleCannotBeCancelled,
    ScheduleNotFound
)
from app.event_bus import emit_event


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def without_mongo_id(document: dict) -> dict:
    result = document.copy()
    result.pop("_id", None)
    return result


def create_schedule(body) -> dict:
    now = utc_now()

    scheduled_for = (
        body.scheduled_for
        .astimezone(timezone.utc)
    )

    if scheduled_for <= now:
        raise InvalidScheduledTime()

    validate_user(body.author_id)
    validate_channel(body.channel_id)

    schedule = {
        "id": str(uuid4()),
        "author_id": body.author_id,
        "channel_id": body.channel_id,
        "content": body.content,
        "scheduled_for": scheduled_for,
        "status": "pending",
        "attempts": 0,
        "message_id": None,
        "last_error": None,
        "next_attempt_at": None,
        "created_at": now,
        "updated_at": now
    }

    schedules.insert_one(schedule.copy())

    emit_event(
        "chat.scheduled-message.created",
        schedule["id"],
        schedule
    )

    return schedule


def get_schedule(schedule_id: str) -> dict:
    schedule = schedules.find_one(
        {"id": schedule_id}
    )

    if schedule is None:
        raise ScheduleNotFound()

    return without_mongo_id(schedule)


def list_schedules(
    author_id: str | None = None,
    schedule_status: str | None = None
) -> list[dict]:
    query = {}

    if author_id:
        query["author_id"] = author_id

    if schedule_status:
        query["status"] = schedule_status

    return list(
        schedules
        .find(query, {"_id": 0})
        .sort("created_at", -1)
    )


def cancel_schedule(schedule_id: str) -> dict:
    schedule = schedules.find_one_and_update(
        {
            "id": schedule_id,
            "status": {
                "$in": ["pending", "retrying"]
            }
        },
        {
            "$set": {
                "status": "cancelled",
                "updated_at": utc_now()
            }
        },
        return_document=ReturnDocument.AFTER
    )

    if schedule is not None:
        schedule = without_mongo_id(schedule)

        emit_event(
            "chat.scheduled-message.cancelled",
            schedule_id,
            schedule
        )

        return schedule

    existing = schedules.find_one(
        {"id": schedule_id},
        {"_id": 0}
    )

    if existing is None:
        raise ScheduleNotFound()

    raise ScheduleCannotBeCancelled(
        existing["status"]
    )