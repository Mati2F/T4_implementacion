from datetime import datetime, timedelta, timezone
from pymongo.errors import PyMongoError
import app.main as main_module


def future_iso(minutes: int = 15) -> str:
    """Genera una fecha futura en formato ISO 8601 con zona horaria UTC."""
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


def past_iso(minutes: int = 15) -> str:
    """Genera una fecha pasada en formato ISO 8601 con zona horaria UTC."""
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


def sample_payload(**overrides) -> dict:
    payload = {
        "author_id": "user-123",
        "channel_id": "channel-456",
        "content": "Recordatorio de entrega",
        "scheduled_for": future_iso(10),
    }
    payload.update(overrides)
    return payload


# =====================================================================
# 1. Endpoint: GET /health
# =====================================================================
def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_error_when_database_unavailable(client, monkeypatch):
    class BrokenAdmin:
        def command(self, _cmd):
            raise PyMongoError("MongoDB caído")

    class BrokenClient:
        admin = BrokenAdmin()

    monkeypatch.setattr(main_module, "client", BrokenClient())

    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "DEPENDENCY_UNAVAILABLE"


# =====================================================================
# 2. Endpoint: POST /api/v1/scheduled-messages
# =====================================================================
def test_create_scheduled_message_success(client):
    response = client.post("/api/v1/scheduled-messages", json=sample_payload())
    assert response.status_code == 201
    body = response.json()
    assert body["author_id"] == "user-123"
    assert body["channel_id"] == "channel-456"
    assert body["status"] == "pending"
    assert body["attempts"] == 0


def test_create_scheduled_message_error_past_date(client):
    response = client.post(
        "/api/v1/scheduled-messages",
        json=sample_payload(scheduled_for=past_iso(5)),
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_SCHEDULED_TIME"


# =====================================================================
# 3. Endpoint: GET /api/v1/scheduled-messages
# =====================================================================
def test_list_scheduled_messages_success_and_filter(client):
    client.post("/api/v1/scheduled-messages", json=sample_payload(author_id="ana"))
    client.post("/api/v1/scheduled-messages", json=sample_payload(author_id="luis"))

    response = client.get("/api/v1/scheduled-messages", params={"author_id": "ana"})
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["author_id"] == "ana"


def test_list_scheduled_messages_error_invalid_status_filter(client):
    response = client.get("/api/v1/scheduled-messages", params={"status": "estado_inexistente"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "VALIDATION_ERROR"


# =====================================================================
# 4. Endpoint: GET /api/v1/scheduled-messages/{schedule_id}
# =====================================================================
def test_get_scheduled_message_by_id_success(client):
    created = client.post("/api/v1/scheduled-messages", json=sample_payload()).json()
    schedule_id = created["id"]

    response = client.get(f"/api/v1/scheduled-messages/{schedule_id}")
    assert response.status_code == 200
    assert response.json()["id"] == schedule_id


def test_get_scheduled_message_by_id_error_not_found(client):
    response = client.get("/api/v1/scheduled-messages/id-que-no-existe")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "SCHEDULE_NOT_FOUND"


# =====================================================================
# 5. Endpoint: DELETE /api/v1/scheduled-messages/{schedule_id}
# =====================================================================
def test_delete_scheduled_message_success(client):
    created = client.post("/api/v1/scheduled-messages", json=sample_payload()).json()
    schedule_id = created["id"]

    response = client.delete(f"/api/v1/scheduled-messages/{schedule_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_delete_scheduled_message_error_already_cancelled(client):
    created = client.post("/api/v1/scheduled-messages", json=sample_payload()).json()
    schedule_id = created["id"]

    # Primera cancelación exitosa
    client.delete(f"/api/v1/scheduled-messages/{schedule_id}")
    # Segunda cancelación debe fallar con 409 Conflict
    response = client.delete(f"/api/v1/scheduled-messages/{schedule_id}")
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "SCHEDULE_CANNOT_BE_CANCELLED"


# =====================================================================
# 6. Endpoint: GET /api/v1/events
# =====================================================================
def test_list_events_success(client):
    client.post("/api/v1/scheduled-messages", json=sample_payload())

    response = client.get("/api/v1/events")
    assert response.status_code == 200
    events = response.json()
    assert len(events) >= 1
    assert events[0]["type"] == "chat.scheduled-message.created"


def test_list_events_error_invalid_limit(client):
    response = client.get("/api/v1/events", params={"limit": 0})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "VALIDATION_ERROR"