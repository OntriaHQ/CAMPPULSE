import base64
import io
import os

import qrcode

from core.exceptions import NotFoundError
from services.qr.schemas import QrGenerateResponse

QR_REDIRECT_BASE = os.getenv("QR_REDIRECT_BASE", "http://localhost:3000/nav")

DESTINATIONS: dict[str, dict] = {
    "main-auditorium": {"lat": 6.9271, "lon": 3.3958, "label": "Main Auditorium"},
    "north-gate": {"lat": 6.9304, "lon": 3.3954, "label": "North Gate"},
    "festival-arena": {"lat": 6.9284, "lon": 3.3974, "label": "Festival Arena"},
    "canaan-land": {"lat": 6.9234, "lon": 3.3934, "label": "Canaan Land"},
    "south-camp": {"lat": 6.9214, "lon": 3.3924, "label": "South Camp"},
    "medical-centre": {"lat": 6.9254, "lon": 3.3944, "label": "Medical Centre"},
}


async def generate_qr(destination_id: str) -> QrGenerateResponse:
    dest = DESTINATIONS.get(destination_id)
    if dest is None:
        raise NotFoundError(
            code="DESTINATION_NOT_FOUND",
            message=f"Destination '{destination_id}' not found.",
        )

    navigator_url = f"{QR_REDIRECT_BASE}?dest={destination_id}"
    img = qrcode.make(navigator_url)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return QrGenerateResponse(
        qr_data_url=f"data:image/png;base64,{b64}",
        destination_label=dest["label"],
        destination_id=destination_id,
    )
