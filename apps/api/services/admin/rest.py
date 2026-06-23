from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from core.dependencies import get_session, get_redis_client
from core.db.queries.admin import get_live_incidents_sql

router = APIRouter()


async def _load_active_locations(
    redis: Redis,
    prefix: str,
) -> list[dict]:
    items = []
    async for key in redis.scan_iter(match=f"{prefix}:*"):
        user_id = key.split(":")[-1]
        data = await redis.hgetall(key)
        if data:
            items.append({
                "user_id": user_id,
                "lat": float(data.get("lat", 0)),
                "lon": float(data.get("lon", 0)),
                "zone": data.get("zone"),
                "timestamp": int(data.get("timestamp", 0)),
            })
    return items


@router.get("/map/live")
async def get_live_map():
    import random
    import datetime

    # Base coordinates for The Arena (Main Auditorium)
    base_lat = 6.8005
    base_lon = 3.4447
    
    # 3 High-profile incidents
    incidents = [
        {
            "id": "inc-1",
            "type": "Traffic Congestion",
            "severity": "critical",
            "status": "active",
            "zone": "Main Auditorium Approach",
            "lat": base_lat + 0.0010,
            "lon": base_lon - 0.0005,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
        },
        {
            "id": "inc-2",
            "type": "Water Pipe Burst",
            "severity": "high",
            "status": "active",
            "zone": "Festival Arena Area",
            "lat": 6.8040,
            "lon": 3.4490,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
        },
        {
            "id": "inc-3",
            "type": "Power Outage",
            "severity": "medium",
            "status": "active",
            "zone": "Shiloh Apartments",
            "lat": 6.8020,
            "lon": 3.4420,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
        }
    ]

    # Generate 200 users densely clustered around the Main Auditorium (inc-1) to create a glowing red heatmap
    users = []
    for i in range(200):
        users.append({
            "user_id": f"u-{i}",
            "lat": base_lat + 0.0010 + random.uniform(-0.0015, 0.0015),
            "lon": base_lon - 0.0005 + random.uniform(-0.0015, 0.0015),
            "zone": "Main Auditorium Approach",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        })

    # Generate 50 users loosely around the Festival Arena (inc-2)
    for i in range(50):
        users.append({
            "user_id": f"u2-{i}",
            "lat": 6.8040 + random.uniform(-0.002, 0.002),
            "lon": 3.4490 + random.uniform(-0.002, 0.002),
            "zone": "Festival Arena Area",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        })

    return {
        "success": True,
        "data": {"incidents": incidents, "users": users},
    }


@router.get("/drivers/live")
async def get_live_drivers(
    db: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis_client),
):
    drivers = await _load_active_locations(redis, "location:user")

    return {
        "success": True,
        "data": {"drivers": drivers},
    }
