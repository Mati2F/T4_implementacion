import os
import time
from datetime import datetime, timedelta, timezone
import httpx
import pytest

BASE_URL = os.getenv("INTEGRATION_BASE_URL", "http://localhost:8004")
RUN_INTEGRATION = os.getenv("RUN_COMPOSE_TESTS") == "1"


@pytest.mark.skipif(
    not RUN_INTEGRATION,
    reason="Ejecutar con RUN_COMPOSE_TESTS=1 cuando Docker Compose esté levantado",
)
def test_end_to_end_schedule_dispatch_with_docker_compose():
    with httpx.Client(base_url=BASE_URL, timeout=5.0) as http:
        health = http.get("/health")
        assert health.status_code == 200

        scheduled_for = (datetime.now(timezone.utc) + timedelta(seconds=3)).isoformat()
        create_resp = http.post(
            "/api/v1/scheduled-messages",
            json={
                "author_id": "user-compose-1",
                "channel_id": "channel-compose-1",
                "content": "Prueba de integración con Docker Compose",
                "scheduled_for": scheduled_for,
            },
        )
        assert create_resp.status_code == 201
        schedule_id = create_resp.json()["id"]

        # Esperar despacho automático (Scheduler + RabbitMQ + Dispatcher)
        final_state = None
        for _ in range(15):
            detail = http.get(f"/api/v1/scheduled-messages/{schedule_id}").json()
            if detail["status"] in ("sent", "failed"):
                final_state = detail
                break
            time.sleep(1)

        assert final_state is not None, "El mensaje no fue procesado a tiempo"
        assert final_state["status"] == "sent"
        assert final_state["message_id"] is not None

        # Verificar que los eventos fueron emitidos
        events = http.get("/api/v1/events").json()
        subject_events = [e["type"] for e in events if e["subject_id"] == schedule_id]
        assert "chat.scheduled-message.created" in subject_events
        assert "chat.scheduled-message.sent" in subject_events