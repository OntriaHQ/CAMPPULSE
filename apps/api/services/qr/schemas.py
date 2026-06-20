from pydantic import BaseModel


class QrGenerateRequest(BaseModel):
    destination_id: str


class QrGenerateResponse(BaseModel):
    qr_data_url: str
    destination_label: str
    destination_id: str
