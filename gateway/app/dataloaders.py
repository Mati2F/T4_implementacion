import asyncio

from aiodataloader import DataLoader

from . import config
from .upstream import call


class _ByIdLoader(DataLoader):
    base_url: str
    path: str

    async def batch_load_fn(self, keys):
        results = await asyncio.gather(
            *(call("GET", f"{self.base_url}{self.path}/{k}", allow_404=True) for k in keys),
            return_exceptions=True,
        )
        return results


class UserLoader(_ByIdLoader):
    base_url, path = config.USERS_URL, "/api/v1/users"


class ChannelLoader(_ByIdLoader):
    base_url, path = config.CHANNELS_URL, "/api/v1/channels"


class MessagesByChannelLoader(DataLoader):
    async def batch_load_fn(self, keys):
        return await asyncio.gather(
            *(call("GET", f"{config.MESSAGES_URL}/api/v1/channels/{k}/messages") for k in keys),
            return_exceptions=True,
        )

class RepliesLoader(DataLoader):
    async def batch_load_fn(self, keys):
        return await asyncio.gather(
            *(call("GET", f"{config.THREADS_URL}/api/v1/channels/{c}/messages/{m}/replies") for c, m in keys),
            return_exceptions=True,
        )


def build_loaders() -> dict:
    return {
        "user": UserLoader(),
        "channel": ChannelLoader(),
        "messages_by_channel": MessagesByChannelLoader(),
        "replies": RepliesLoader(),
    }
