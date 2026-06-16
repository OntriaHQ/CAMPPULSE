from pydantic import BaseModel


class NotificationPayload(BaseModel):
    user_id: str
    type: str
    title: str
    body: str
    channel: str = "in_app"
    data: dict | None = None


class ZoneBroadcast(BaseModel):
    zone: str
    title: str
    body: str
