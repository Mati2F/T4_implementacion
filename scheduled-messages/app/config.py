import os


MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb://scheduled-messages-mongodb:27017"
)

USERS_URL = os.getenv(
    "USERS_URL",
    "http://users:8000"
)

CHANNELS_URL = os.getenv(
    "CHANNELS_URL",
    "http://channels:8000"
)

MESSAGES_URL = os.getenv(
    "MESSAGES_URL",
    "http://messages:8000"
)

RABBITMQ_URL = os.getenv(
    "RABBITMQ_URL",
    "amqp://chat:chat@rabbitmq:5672/%2F"
)

EXCHANGE_NAME = "chat"

DISPATCH_QUEUE = "scheduled-message-dispatch"

DISPATCH_ROUTING_KEY = (
    "chat.scheduled-message.dispatch-requested"
)

SCHEDULER_INTERVAL_SECONDS = int(
    os.getenv("SCHEDULER_INTERVAL_SECONDS", "2")
)

RETRY_DELAY_SECONDS = int(
    os.getenv("RETRY_DELAY_SECONDS", "10")
)

MAX_DISPATCH_ATTEMPTS = int(
    os.getenv("MAX_DISPATCH_ATTEMPTS", "3")
)