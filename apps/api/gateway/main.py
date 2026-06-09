from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import close_db_pool, create_db_pool
from core.redis import close_redis, create_redis
from gateway.config import settings
from gateway.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_pool(settings.database_url)
    await create_redis(settings.redis_url)
    yield
    await close_redis()
    await close_db_pool()


app = FastAPI(title="CampPulse API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
