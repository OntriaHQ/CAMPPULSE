import json
import time
import uuid


class Event:
    def __init__(self, event_type: str, payload: dict, source_service: str):
        self.event_id = str(uuid.uuid4())
        self.event_type = event_type
        self.payload = payload
        self.timestamp = int(time.time())
        self.source_service = source_service

    def to_json(self) -> str:
        return json.dumps({
            "event_id": self.event_id,
            "event_type": self.event_type,
            "payload": self.payload,
            "timestamp": self.timestamp,
            "source_service": self.source_service,
        })
