from pymongo import ASCENDING, MongoClient
from app.config import MONGODB_URL


client = MongoClient(
    MONGODB_URL,
    tz_aware=True
)

database = client.scheduled_messages

schedules = database.schedules
events = database.events


def create_indexes() -> None:
    schedules.create_index(
        "id",
        unique=True
    )

    schedules.create_index([
        ("status", ASCENDING),
        ("scheduled_for", ASCENDING)
    ])

    schedules.create_index([
        ("status", ASCENDING),
        ("next_attempt_at", ASCENDING)
    ])

    events.create_index(
        "id",
        unique=True
    )

    events.create_index([
        ("published", ASCENDING),
        ("occurred_at", ASCENDING)
    ])