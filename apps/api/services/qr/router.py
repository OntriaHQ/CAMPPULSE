from fastapi import APIRouter

from services.qr.service import DESTINATIONS, generate_qr

router = APIRouter()


@router.get("/{destination_id}")
async def get_qr(destination_id: str):
    result = await generate_qr(destination_id)
    return {"success": True, "data": result.model_dump(), "meta": {}}


@router.get("/destinations")
async def list_destinations():
    data = [
        {"id": k, "label": v["label"], "lat": v["lat"], "lon": v["lon"]}
        for k, v in DESTINATIONS.items()
    ]
    return {"success": True, "data": data, "meta": {}}
