import logging
from contextlib import asynccontextmanager
from pathlib import Path

from ariadne import (EnumType, MutationType, ObjectType, QueryType, ScalarType, load_schema_from_path,
                     make_executable_schema, upload_scalar)
from ariadne.asgi import GraphQL
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import httpx
from starlette.background import BackgroundTask
from urllib.parse import quote

from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from . import config
from .dataloaders import build_loaders
from .upstream import call, http

logging.basicConfig(level=logging.INFO, format="%(asctime)s:%(levelname)s:%(name)s:%(message)s")

type_defs = load_schema_from_path(str(Path(__file__).with_name("schema.graphql")))

query = QueryType()
mutation = MutationType()
user = ObjectType("User")
channel = ObjectType("Channel")
message = ObjectType("Message")
scheduled = ObjectType("ScheduledMessage")
reply = ObjectType("Reply")
attachment = ObjectType("Attachment")
json_scalar = ScalarType("JSON")

schedule_status = EnumType("ScheduleStatus", {
    s.upper(): s for s in
    ("pending", "queued", "processing", "retrying", "sent", "failed", "cancelled")
})


# ---------- Queries ----------

@query.field("user")
async def q_user(_, info, id):
    return await info.context["loaders"]["user"].load(id)


@query.field("channel")
async def q_channel(_, info, id):
    return await info.context["loaders"]["channel"].load(id)


@query.field("channels")
async def q_channels(*_):
    return await call("GET", f"{config.CHANNELS_URL}/api/v1/channels")


@query.field("messages")
async def q_messages(_, info, channel_id):
    return await info.context["loaders"]["messages_by_channel"].load(channel_id)


@query.field("scheduledMessage")
async def q_scheduled_one(_, info, id):
    return await call("GET", f"{config.SCHEDULED_URL}/api/v1/scheduled-messages/{id}", allow_404=True)


@query.field("scheduledMessages")
async def q_scheduled_list(_, info, author_id=None, status=None):
    return await _list_scheduled(author_id, status)


async def _list_scheduled(author_id=None, status=None):
    params = {}
    if author_id:
        params["author_id"] = author_id
    if status:
        params["status"] = status
    return await call("GET", f"{config.SCHEDULED_URL}/api/v1/scheduled-messages", params=params)


# ---------- Relaciones ----------

@user.field("scheduledMessages")
async def user_scheduled(obj, info, status=None):
    return await _list_scheduled(obj["id"], status)


@channel.field("messages")
async def channel_messages(obj, info):
    return await info.context["loaders"]["messages_by_channel"].load(obj["id"])


@message.field("author")
@scheduled.field("author")
async def resolve_author(obj, info):
    return await info.context["loaders"]["user"].load(obj["author_id"])


@message.field("channel")
@scheduled.field("channel")
async def resolve_channel(obj, info):
    return await info.context["loaders"]["channel"].load(obj["channel_id"])


@scheduled.field("message")
async def scheduled_message(obj, info):
    if not obj.get("message_id"):
        return None
    msgs = await info.context["loaders"]["messages_by_channel"].load(obj["channel_id"])
    return next((m for m in msgs if m["id"] == obj["message_id"]), None)

# ---------- Threads (respuestas) ----------
def _replies_url(channel_id, message_id):
    return f"{config.THREADS_URL}/api/v1/channels/{channel_id}/messages/{message_id}/replies"


@query.field("replies")
async def q_replies(_, info, channel_id, message_id):
    return await call("GET", _replies_url(channel_id, message_id))


@message.field("replies")
async def message_replies(obj, info):
    return await info.context["loaders"]["replies"].load((obj["channel_id"], obj["id"]))


@reply.field("author")
async def reply_author(obj, info):
    return await info.context["loaders"]["user"].load(obj["author_id"])


@reply.field("channel")
async def reply_channel(obj, info):
    return await info.context["loaders"]["channel"].load(obj["channel_id"])


@reply.field("message")
async def reply_message(obj, info):
    # p1 no tiene GET /messages/{id}: se busca en la lista (cacheada) del canal.
    msgs = await info.context["loaders"]["messages_by_channel"].load(obj["channel_id"])
    return next((x for x in msgs if x["id"] == obj["message_id"]), None)


@mutation.field("createReply")
async def m_create_reply(_, info, channel_id, message_id, author_id, content):
    return await call("POST", _replies_url(channel_id, message_id),
                      json={"author_id": author_id, "content": content})


# ---------- Media (adjuntos). Todas sus rutas exigen el encabezado X-User-Id ----------
def _media(user_id):
    return {"X-User-Id": user_id}


@json_scalar.serializer
def serialize_json(value):
    return value


def _tag_user(item, user_id):
    if isinstance(item, dict):
        item["_requested_by"] = user_id
    return item


@query.field("attachments")
async def q_attachments(_, info, channel_id, user_id, category=None, limit=20, offset=0):
    params = {"limit": limit, "offset": offset}
    if category:
        params["category"] = category
    page = await call("GET", f"{config.MEDIA_URL}/api/v1/channels/{channel_id}/attachments",
                      params=params, headers=_media(user_id))
    for item in page.get("items", []):
        _tag_user(item, user_id)
    return page


@attachment.field("downloadUrl")
def attachment_download_url(obj, info):
    if obj.get("category") == "LINK" or not obj.get("_requested_by"):
        return None
    return f"/media/attachments/{obj['id']}/download?user_id={quote(obj['_requested_by'], safe='')}"


@attachment.field("sha256")
def attachment_sha256(obj, info):
    return obj.get("sha256")


@attachment.field("uploader")
async def attachment_uploader(obj, info):
    return await info.context["loaders"]["user"].load(obj["uploader_id"])


@attachment.field("channel")
async def attachment_channel(obj, info):
    return await info.context["loaders"]["channel"].load(obj["channel_id"])


@query.field("channelQuota")
async def q_quota(_, info, channel_id, user_id):
    return await call("GET", f"{config.MEDIA_URL}/api/v1/channels/{channel_id}/quota", headers=_media(user_id))


@query.field("linkPreview")
async def q_link_preview(_, info, url, user_id):
    return await call("GET", f"{config.MEDIA_URL}/api/v1/links/preview", params={"url": url}, headers=_media(user_id))


@mutation.field("uploadAttachment")
async def m_upload(_, info, channel_id, user_id, file):
    created = await call(
        "POST", f"{config.MEDIA_URL}/api/v1/channels/{channel_id}/attachments", headers=_media(user_id),
        files={"file": (file.filename, file.file, file.content_type or "application/octet-stream")},
    )
    return _tag_user(created, user_id)


@mutation.field("deleteAttachment")
async def m_delete_attachment(_, info, id, user_id):
    await call("DELETE", f"{config.MEDIA_URL}/api/v1/attachments/{id}", headers=_media(user_id))
    return True


async def download_attachment(request):
    user_id = request.query_params.get("user_id") or request.headers.get("x-user-id")
    if not user_id:
        return JSONResponse({"detail": "Falta user_id"}, status_code=400)
    headers = _media(user_id)
    for name in ("range", "if-none-match", "if-modified-since", "if-range"):
        if request.headers.get(name):
            headers[name] = request.headers[name]
    upstream_request = http.build_request(
        "GET", f"{config.MEDIA_URL}/api/v1/attachments/{request.path_params['attachment_id']}/download",
        headers=headers,
    )
    try:
        upstream = await http.send(upstream_request, stream=True)
    except httpx.HTTPError:
        return JSONResponse({"detail": "Servicio de media no disponible"}, status_code=502)
    passthrough = ("content-type", "content-disposition", "content-length", "content-range", "accept-ranges", "etag",
                   "last-modified", "cache-control", "x-content-type-options", "location")
    return StreamingResponse(
        upstream.aiter_raw(), status_code=upstream.status_code,
        headers={k: v for k, v in upstream.headers.items() if k.lower() in passthrough},
        background=BackgroundTask(upstream.aclose),
    )


# ---------- Mutations ----------
@mutation.field("createUser")
async def m_create_user(_, info, display_name):
    return await call("POST", f"{config.USERS_URL}/api/v1/users", json={"display_name": display_name})


@mutation.field("createChannel")
async def m_create_channel(_, info, name):
    return await call("POST", f"{config.CHANNELS_URL}/api/v1/channels", json={"name": name})


@mutation.field("sendMessage")
async def m_send_message(_, info, channel_id, author_id, content):
    return await call("POST", f"{config.MESSAGES_URL}/api/v1/channels/{channel_id}/messages",
                      json={"author_id": author_id, "content": content})


@mutation.field("scheduleMessage")
async def m_schedule(_, info, author_id, channel_id, content, scheduled_for):
    return await call("POST", f"{config.SCHEDULED_URL}/api/v1/scheduled-messages", json={
        "author_id": author_id, "channel_id": channel_id,
        "content": content, "scheduled_for": scheduled_for,
    })


@mutation.field("cancelScheduledMessage")
async def m_cancel(_, info, id):
    return await call("DELETE", f"{config.SCHEDULED_URL}/api/v1/scheduled-messages/{id}")


# ---------- App ----------
schema = make_executable_schema(
    type_defs, query, mutation, user, channel, message, scheduled, reply, attachment, schedule_status, json_scalar, upload_scalar,
    convert_names_case=True,
)


def get_context(request, data):
    return {"request": request, "loaders": build_loaders()}


async def health(request):
    return JSONResponse({"status": "ok"})


@asynccontextmanager
async def lifespan(app):
    yield
    await http.aclose()


app = Starlette(
    routes=[
        Route("/health", health),
        Route("/media/attachments/{attachment_id}/download", download_attachment),
        Route("/graphql", GraphQL(schema, context_value=get_context, debug=False)),
    ],
    middleware=[Middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS,
                           allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])],
    lifespan=lifespan,
)
