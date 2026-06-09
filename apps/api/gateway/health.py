from fastapi import APIRouter, Request

from core.database import check_db_health
from core.redis import check_redis_health

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict[str, str]:
    db_status = await check_db_health()
    redis_status = await check_redis_health()
    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return {"status": overall, "db": db_status, "redis": redis_status}
