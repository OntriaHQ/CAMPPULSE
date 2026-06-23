import uuid
import datetime
from fastapi import APIRouter, File, Form, Query, Request, UploadFile, status

router = APIRouter(tags=["incidents"])

# In-memory store for the demo
import datetime
MOCK_INCIDENTS = [
    {
        "id": "inc-1",
        "type": "Traffic Congestion",
        "severity": "critical",
        "status": "active",
        "zone": "Main Auditorium Approach",
        "lat": 6.8015,
        "lon": 3.4442,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "description": "Massive traffic build up approaching the main auditorium from the North gate."
    },
    {
        "id": "inc-2",
        "type": "Water Pipe Burst",
        "severity": "high",
        "status": "active",
        "zone": "Festival Arena Area",
        "lat": 6.8040,
        "lon": 3.4490,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "description": "A major water pipe has burst near the Festival Arena causing minor flooding on the access road."
    },
    {
        "id": "inc-3",
        "type": "Power Outage",
        "severity": "medium",
        "status": "active",
        "zone": "Shiloh Apartments",
        "lat": 6.8020,
        "lon": 3.4420,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "description": "Temporary power outage reported in Shiloh Apartments block C."
    }
]

@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_incident(
    request: Request,
    type: str = Form(...),
    lat: float = Form(...),
    lon: float = Form(...),
    description: str | None = Form(default=None),
    severity: str = Form(default="low"),
    photo: UploadFile | None = File(default=None),
):
    incident_id = str(uuid.uuid4())
    incident = {
        "id": incident_id,
        "type": type,
        "lat": lat,
        "lon": lon,
        "description": description,
        "severity": severity,
        "status": "active",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "zone": "North Gate", # Mocked zone for the demo
    }
    MOCK_INCIDENTS.insert(0, incident)
    return {"success": True, "data": incident}

@router.get("/all")
async def fetch_all_incidents():
    return {"success": True, "data": MOCK_INCIDENTS}

@router.patch("/{incident_id}/status")
async def update_status(incident_id: str, status: str = Query(..., alias="status")):
    for inc in MOCK_INCIDENTS:
        if inc["id"] == incident_id:
            inc["status"] = status
            return {"success": True, "data": inc}
    return {"success": False, "error": {"message": "Not found"}}

# Fallback mock endpoints to prevent the mobile app from crashing if it polls
@router.get("/nearby")
async def fetch_incidents_nearby():
    return {"success": True, "data": {"items": MOCK_INCIDENTS, "total": len(MOCK_INCIDENTS), "page": 1, "pages": 1}}

@router.get("/zone/{zone}")
async def fetch_incidents_by_zone():
    return {"success": True, "data": {"items": MOCK_INCIDENTS, "total": len(MOCK_INCIDENTS), "page": 1, "pages": 1}}
