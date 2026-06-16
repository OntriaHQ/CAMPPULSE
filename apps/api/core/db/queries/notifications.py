from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def insert_notification_log(
    session: AsyncSession,
    user_id: str,
    type: str,
    title: str,
    body: str,
    channel: str = "in_app",
    delivered: bool = False,
) -> dict:
    result = await session.execute(
        text("""
            INSERT INTO notification_log (user_id, type, title, body, channel, delivered)
            VALUES (:user_id, :type, :title, :body, :channel, :delivered)
            RETURNING id, type, title, body, channel, delivered
        """),
        {
            "user_id": user_id,
            "type": type,
            "title": title,
            "body": body,
            "channel": channel,
            "delivered": delivered,
        },
    )
    row = result.fetchone()
    return {
        "id": row[0],
        "type": row[1],
        "title": row[2],
        "body": row[3],
        "channel": row[4],
        "delivered": row[5],
    }
