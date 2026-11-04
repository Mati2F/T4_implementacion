import os

USERS_URL = os.environ.get("USERS_URL", "http://users:8000")
CHANNELS_URL = os.environ.get("CHANNELS_URL", "http://channels:8000")
MESSAGES_URL = os.environ.get("MESSAGES_URL", "http://messages:8000")
SCHEDULED_URL = os.environ.get("SCHEDULED_URL", "http://scheduled-messages-api:8000")

MEDIA_URL = os.environ.get("MEDIA_URL", "http://media:8000")
THREADS_URL = os.environ.get("THREADS_URL", "http://threads-api:8000")

REQUEST_TIMEOUT = float(os.environ.get("REQUEST_TIMEOUT_SECONDS", "5"))
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

USERS_URL, CHANNELS_URL, MESSAGES_URL, SCHEDULED_URL, MEDIA_URL, THREADS_URL = (
    u.rstrip("/") for u in (USERS_URL, CHANNELS_URL, MESSAGES_URL, SCHEDULED_URL, MEDIA_URL, THREADS_URL)
)
