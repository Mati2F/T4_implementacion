from datetime import datetime
from enum import Enum

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field
)


class ScheduleStatus(str, Enum):
    pending = "pending"
    queued = "queued"
    processing = "processing"
    retrying = "retrying"
    sent = "sent"
    failed = "failed"
    cancelled = "cancelled"


class ScheduledMessageCreate(BaseModel):
    author_id: str = Field(min_length=1)
    channel_id: str = Field(min_length=1)

    content: str = Field(
        min_length=1,
        max_length=4_000
    )

    scheduled_for: AwareDatetime

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "author_id": "user-123",
                "channel_id": "channel-456",
                "content": (
                    "La reunión comienza en 10 minutos"
                ),
                "scheduled_for": (
                    "2026-10-12T20:30:00-03:00"
                )
            }
        }
    )


class ScheduledMessageResponse(BaseModel):
    id: str
    author_id: str
    channel_id: str
    content: str
    scheduled_for: datetime
    status: ScheduleStatus
    attempts: int

    message_id: str | None = None
    last_error: str | None = None
    next_attempt_at: datetime | None = None

    created_at: datetime
    updated_at: datetime


class EventResponse(BaseModel):
    id: str
    type: str
    subject_id: str
    occurred_at: datetime
    data: dict
    published: bool
    published_at: datetime | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    detail: ErrorDetail