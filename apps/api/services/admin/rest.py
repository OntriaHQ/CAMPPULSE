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
async def get_live_map(
    db: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis_client),
):
    incident_rows = await get_live_incidents_sql(db)
    incidents = [
        {
            "id": str(r[0]),
            "type": r[1],
            "severity": r[2],
            "status": r[3],
            "zone": r[4],
            "lat": float(r[5]),
            "lon": float(r[6]),
            "created_at": r[7].isoformat() if r[7] else None,
        }
        for r in incident_rows
    ]

    users = await _load_active_locations(redis, "location:user")

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
