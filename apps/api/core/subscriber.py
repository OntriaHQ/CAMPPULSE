"""Base event subscriber."""

import asyncio
import json
import logging
from abc import ABC, abstractmethod

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class BaseSubscriber(ABC):
    channels: list[str] = []

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self._pubsub = redis_client.pubsub()
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if not self.channels:
            logger.warning("%s has no channels configured", self.__class__.__name__)
            return
        await self._pubsub.subscribe(*self.channels)
        self._task = asyncio.create_task(self._listen())
        logger.info(
            "%s subscribed to channels: %s",
            self.__class__.__name__,
            ", ".join(self.channels),
        )

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self._pubsub.unsubscribe()
        await self._pubsub.close()

    async def _listen(self) -> None:
        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue
                channel = message["channel"]
                data = message["data"]
                try:
                    payload = json.loads(data)
                    await self.handle(channel, payload)
                except Exception:
                    logger.exception(
                        "Error processing message on channel %s", channel
                    )
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Fatal error in subscriber listener")

    @abstractmethod
    async def handle(self, channel: str, payload: dict) -> None:
        ...
