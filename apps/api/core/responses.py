import time
from typing import Any


def success_response(data: Any, request_id: str) -> dict[str, Any]:
    return {
        "success": True,
        "data": data,
        "meta": {
            "timestamp": int(time.time()),
            "request_id": request_id,
        },
    }
