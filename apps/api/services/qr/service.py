import base64
import io

import qrcode

from core.exceptions import NotFoundError
from services.qr.schemas import QrGenerateResponse

DESTINATIONS: dict[str, dict] = {
    "main-auditorium": {"lat": 6.878, "lon": 3.386, "label": "Main Auditorium"},
    "north-gate": {"lat": 6.881, "lon": 3.383, "label": "North Gate"},
    "festival-arena": {"lat": 6.875, "lon": 3.390, "label": "Festival Arena"},
    "canaan-land": {"lat": 6.870, "lon": 3.380, "label": "Canaan Land"},
    "south-camp": {"lat": 6.867, "lon": 3.378, "label": "South Camp"},
    "medical-centre": {"lat": 6.876, "lon": 3.385, "label": "Medical Centre"},
}


async def generate_qr(destination_id: str) -> QrGenerateResponse:
    dest = DESTINATIONS.get(destination_id)
    if dest is None:
        raise NotFoundError(
            code="DESTINATION_NOT_FOUND",
            message=f"Destination '{destination_id}' not found.",
        )

    navigator_url = f"https://campnav/redirect?dest={destination_id}"
    img = qrcode.make(navigator_url)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return QrGenerateResponse(
        qr_data_url=f"data:image/png;base64,{b64}",
        destination_label=dest["label"],
        destination_id=destination_id,
    )
