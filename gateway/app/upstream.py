import httpx
from graphql import GraphQLError

from . import config

http = httpx.AsyncClient(timeout=config.REQUEST_TIMEOUT)


def _parse_error(response: httpx.Response) -> tuple[str, str]:
    try:
        detail = response.json().get("detail")
    except (ValueError, AttributeError):
        detail = None

    if isinstance(detail, dict):
        return detail.get("code", "UPSTREAM_ERROR"), detail.get("message", "Error")
    if isinstance(detail, list):
        msgs = "; ".join(f"{'.'.join(map(str, e.get('loc', [])))}: {e.get('msg')}" for e in detail)
        return "VALIDATION_ERROR", msgs
    if isinstance(detail, str):
        return ("NOT_FOUND" if response.status_code == 404 else "UPSTREAM_ERROR"), detail
    return "UPSTREAM_ERROR", f"HTTP {response.status_code}"


async def call(method: str, url: str, *, allow_404: bool = False, **kwargs):
    try:
        response = await http.request(method, url, **kwargs)
    except httpx.HTTPError as exc:
        raise GraphQLError(
            f"Servicio no disponible: {url}",
            extensions={"code": "UPSTREAM_UNAVAILABLE"},
        ) from exc

    if response.status_code == 404 and allow_404:
        return None
    if response.status_code >= 400:
        code, message = _parse_error(response)
        raise GraphQLError(message, extensions={"code": code, "status": response.status_code})
    if response.status_code == 204 or not response.content:
        return None
    return response.json()
