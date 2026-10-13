from contextlib import asynccontextmanager

from fastapi import (
    FastAPI,
    Query,
    Request,
    status
)
from fastapi.exceptions import (
    RequestValidationError
)
from fastapi.responses import JSONResponse

from app.database import (
    client,
    create_indexes,
    events
)
from app.errors import DomainError
from app.models import (
    EventResponse,
    ScheduleStatus,
    ScheduledMessageCreate,
    ScheduledMessageResponse
)
from app.service import (
    cancel_schedule,
    create_schedule,
    get_schedule,
    list_schedules
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    create_indexes()
    yield


app = FastAPI(
    title="Scheduled Messages",
    description=(
        "API para programar mensajes futuros "
        "en el sistema de chat."
    ),
    version="1.0.0",
    lifespan=lifespan
)


@app.exception_handler(DomainError)
async def handle_domain_error(
    _request: Request,
    error: DomainError
):
    return JSONResponse(
        status_code=error.status_code,
        content={
            "detail": {
                "code": error.code,
                "message": error.message
            }
        }
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _request: Request,
    _error: RequestValidationError
):
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": "VALIDATION_ERROR",
                "message": (
                    "La solicitud contiene "
                    "datos inválidos"
                )
            }
        }
    )


@app.get(
    "/health",
    summary="Comprobar disponibilidad"
)
def health():
    client.admin.command("ping")

    return {"status": "ok"}


@app.post(
    "/api/v1/scheduled-messages",
    response_model=ScheduledMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Programar un mensaje",
    description=(
        "Registra un mensaje para que sea "
        "publicado posteriormente."
    )
)
def create_scheduled_message(
    body: ScheduledMessageCreate
):
    return create_schedule(body)


@app.get(
    "/api/v1/scheduled-messages",
    response_model=list[ScheduledMessageResponse],
    summary="Listar programaciones"
)
def find_scheduled_messages(
    author_id: str | None = None,
    schedule_status: ScheduleStatus | None = Query(
        default=None,
        alias="status"
    )
):
    return list_schedules(
        author_id=author_id,
        schedule_status=(
            schedule_status.value
            if schedule_status
            else None
        )
    )


@app.get(
    "/api/v1/scheduled-messages/{schedule_id}",
    response_model=ScheduledMessageResponse,
    summary="Consultar una programación"
)
def find_scheduled_message(schedule_id: str):
    return get_schedule(schedule_id)


@app.delete(
    "/api/v1/scheduled-messages/{schedule_id}",
    response_model=ScheduledMessageResponse,
    summary="Cancelar una programación"
)
def delete_scheduled_message(schedule_id: str):
    return cancel_schedule(schedule_id)


@app.get(
    "/api/v1/events",
    response_model=list[EventResponse],
    summary="Explorar eventos"
)
def find_events():
    return list(
        events
        .find({}, {"_id": 0})
        .sort("occurred_at", -1)
    )