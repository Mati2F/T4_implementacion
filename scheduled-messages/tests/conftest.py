import mongomock
import pytest
from fastapi.testclient import TestClient

import app.database as db_module
import app.dispatcher as dispatcher_module
import app.event_bus as event_bus_module
import app.main as main_module
import app.scheduler as scheduler_module
import app.service as service_module


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch):
    mock_client = mongomock.MongoClient(tz_aware=True)
    mock_db = mock_client.scheduled_messages
    mock_schedules = mock_db.schedules
    mock_events = mock_db.events

    # Reemplazar referencias a la base de datos en todos los módulos del servicio
    monkeypatch.setattr(db_module, "client", mock_client)
    monkeypatch.setattr(db_module, "database", mock_db)
    monkeypatch.setattr(db_module, "schedules", mock_schedules)
    monkeypatch.setattr(db_module, "events", mock_events)

    monkeypatch.setattr(main_module, "client", mock_client)
    monkeypatch.setattr(main_module, "events", mock_events)
    monkeypatch.setattr(service_module, "schedules", mock_schedules)
    monkeypatch.setattr(event_bus_module, "events", mock_events)
    monkeypatch.setattr(dispatcher_module, "schedules", mock_schedules)
    monkeypatch.setattr(scheduler_module, "schedules", mock_schedules)

    # Evitar conexión real a RabbitMQ durante las pruebas de la API
    def fake_publish_event(event: dict) -> bool:
        mock_events.update_one(
            {"id": event["id"]},
            {"$set": {"published": True, "published_at": event_bus_module.utc_now()}},
        )
        return True

    monkeypatch.setattr(event_bus_module, "publish_event", fake_publish_event)

    yield {
        "client": mock_client,
        "schedules": mock_schedules,
        "events": mock_events,
    }


@pytest.fixture
def client():
    """Cliente de pruebas para invocar los endpoints de FastAPI"""
    with TestClient(main_module.app) as test_client:
        yield test_client