import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from core.db.queries.notifications import insert_notification_log
from core.connection_manager import connection_manager

logger = logging.getLogger(__name__)


async def log_notification(
    session: AsyncSession,
    user_id: str,
    type: str,
    title: str,
    body: str,
    channel: str = "in_app",
    delivered: bool = False,
) -> dict:
    row = await insert_notification_log(
        session=session,
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        channel=channel,
        delivered=delivered,
    )
    return {
        "id": str(row["id"]),
        "type": type,
        "title": title,
        "body": body,
        "channel": channel,
        "delivered": delivered,
    }


async def send_in_app_notification(
    session: AsyncSession,
    user_id: str,
    type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    await log_notification(
        session=session,
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        channel="in_app",
        delivered=True,
    )
    message = {
        "type": "notification",
        "payload": {
            "title": title,
            "body": body,
            "type": type,
            "user_id": user_id,
            "data": data or {},
        },
    }
    try:
        if user_id == "*":
            await connection_manager.broadcast_to_all(message)
        else:
            await connection_manager.send_to_user(user_id, message)
    except Exception:
        logger.exception("Failed to send in-app notification to %s", user_id)


async def send_push_notification(
    session: AsyncSession,
    user_id: str,
    type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Send a push notification via Expo Push API."""
    if user_id == "*":
        return

    from sqlalchemy import text
    result = await session.execute(
        text("SELECT push_token FROM users WHERE id = :user_id AND push_token IS NOT NULL"),
        {"user_id": user_id},
    )
    row = result.fetchone()
    if not row:
        logger.info("No push token found for user %s, skipping push notification", user_id)
        return

    push_token = row[0]

    message = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
        "priority": "high",
    }

    delivered = False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            if response.status_code == 200:
                delivered = True
                logger.info("Push notification sent to %s: %s", user_id, title)
            else:
                logger.warning("Expo API returned %s: %s", response.status_code, response.text)
    except Exception:
        logger.exception("Failed to send push notification to %s", user_id)

    await log_notification(
        session=session,
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        channel="push",
        delivered=delivered,
    )


async def send_zone_broadcast(
    session: AsyncSession,
    zone: str,
    title: str,
    body: str,
) -> None:
    message = {
        "type": "zone_broadcast",
        "payload": {
            "zone": zone,
            "title": title,
            "body": body,
        },
    }
    try:
        await connection_manager.broadcast_to_zone(zone, message)
        await connection_manager.broadcast_to_zone("_unzoned", message)
    except Exception:
        logger.exception("Failed to broadcast zone notification")
