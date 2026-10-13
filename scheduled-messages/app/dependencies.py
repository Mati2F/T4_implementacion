import httpx

from app.config import CHANNELS_URL, USERS_URL
from app.errors import (
    DependencyUnavailable,
    RelatedResourceNotFound
)


def resource_exists(
    base_url: str,
    path: str,
    resource_name: str
) -> None:
    try:
        response = httpx.get(
            f"{base_url}{path}",
            timeout=3
        )

    except httpx.RequestError as error:
        raise DependencyUnavailable(
            resource_name
        ) from error

    if response.status_code == 404:
        raise RelatedResourceNotFound(
            resource_name
        )

    if response.status_code != 200:
        raise DependencyUnavailable(
            resource_name
        )


def validate_user(user_id: str) -> None:
    resource_exists(
        USERS_URL,
        f"/api/v1/users/{user_id}",
        "user"
    )


def validate_channel(channel_id: str) -> None:
    resource_exists(
        CHANNELS_URL,
        f"/api/v1/channels/{channel_id}",
        "channel"
    )