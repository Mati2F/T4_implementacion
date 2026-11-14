from datetime import datetime, timezone
import httpx
import app.dispatcher as dispatcher_module

MESSAGES_CONTRACT = {
    "consumer": "scheduled-messages-dispatcher",
    "provider": "chat-base-messages-api",
    "interactions": [
        {
            "description": "Publicar un mensaje programado en un canal existente",
            "request": {
                "method": "POST",
                "path_pattern": "/api/v1/channels/{channel_id}/messages",
                "body_schema": {"author_id": str, "content": str},
            },
            "response": {
                "status": 201,
                "body_schema": {
                    "id": str,
                    "channel_id": str,
                    "author_id": str,
                    "content": str,
                },
            },
        },
        {
            "description": "Rechazar mensaje cuando el autor o canal no existen en el chat base",
            "response": {
                "status": 404,
                "body_schema": {"detail": str},
            },
        },
    ],
}


def seed_queued_schedule(schedules_collection, schedule_id="sched-001") -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "id": schedule_id,
        "author_id": "user-abc",
        "channel_id": "channel-xyz",
        "content": "Mensaje de prueba de contrato",
        "scheduled_for": now,
        "status": "queued",
        "attempts": 0,
        "message_id": None,
        "last_error": None,
        "next_attempt_at": None,
        "created_at": now,
        "updated_at": now,
    }
    schedules_collection.insert_one(doc.copy())
    return doc


def test_contract_consumer_sends_expected_request_and_handles_201(isolated_db, monkeypatch):
    schedules = isolated_db["schedules"]
    seed_queued_schedule(schedules, schedule_id="sched-201")
    captured_request = {}

    def mock_messages_provider(url: str, json: dict, timeout: int) -> httpx.Response:
        captured_request["url"] = url
        captured_request["json"] = json
        captured_request["timeout"] = timeout

        # Respuesta simulada cumpliendo el contrato del proveedor `messages`
        provider_body = {
            "id": "msg-999",
            "channel_id": "channel-xyz",
            "author_id": json["author_id"],
            "content": json["content"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        request = httpx.Request("POST", url)
        return httpx.Response(201, json=provider_body, request=request)

    monkeypatch.setattr(dispatcher_module.httpx, "post", mock_messages_provider)

    # Ejecutar el consumidor con el evento de despacho
    dispatcher_module.dispatch({"data": {"schedule_id": "sched-201"}})

    # Validar que la petición del consumidor cumple el contrato
    assert captured_request["url"].endswith("/api/v1/channels/channel-xyz/messages")
    assert set(captured_request["json"].keys()) == {"author_id", "content"}
    assert isinstance(captured_request["json"]["author_id"], str)
    assert isinstance(captured_request["json"]["content"], str)

    # Validar que el consumidor interpretó la respuesta del proveedor correctamente
    updated = schedules.find_one({"id": "sched-201"})
    assert updated["status"] == "sent"
    assert updated["message_id"] == "msg-999"
    assert updated["last_error"] is None


def test_contract_consumer_handles_provider_404_without_retry(isolated_db, monkeypatch):
    schedules = isolated_db["schedules"]
    seed_queued_schedule(schedules, schedule_id="sched-404")

    def mock_messages_404(url: str, json: dict, timeout: int) -> httpx.Response:
        request = httpx.Request("POST", url)
        return httpx.Response(
            404,
            json={"detail": "Channel or User not found"},
            request=request,
        )

    monkeypatch.setattr(dispatcher_module.httpx, "post", mock_messages_404)

    dispatcher_module.dispatch({"data": {"schedule_id": "sched-404"}})

    updated = schedules.find_one({"id": "sched-404"})
    assert updated["status"] == "failed"
    assert "404" in updated["last_error"]