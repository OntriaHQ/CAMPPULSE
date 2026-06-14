import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import (
    close_db_pool,
    close_sqlalchemy_engine,
    create_db_pool,
    create_sqlalchemy_engine,
    get_session_factory,
)
from core.exceptions import register_exception_handlers
from core.redis import close_redis, create_redis, get_redis
from gateway.config import settings
from gateway.health import router as health_router
from gateway.middleware.logging import LoggingMiddleware
from gateway.middleware.rate_limit import RateLimitMiddleware
from services.auth.router import router as auth_router
from services.incident.router import router as incident_router
from services.routing.router import router as routing_router
from services.routing.subscriber import RoutingSubscriber
from services.user.router import rbac_router, router as user_router

logger = logging.getLogger(__name__)

_routing_subscriber: RoutingSubscriber | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_pool(settings.database_url)
    await create_sqlalchemy_engine(settings.database_url)
    await create_redis(settings.redis_url)

    redis_client = get_redis()
    session_factory = get_session_factory()
    global _routing_subscriber
    _routing_subscriber = RoutingSubscriber(redis_client, session_factory)
    await _routing_subscriber.start()

    yield

    if _routing_subscriber:
        await _routing_subscriber.stop()
    await close_redis()
    await close_sqlalchemy_engine()
    await close_db_pool()


app = FastAPI(title="CampPulse API", lifespan=lifespan)

register_exception_handlers(app)

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
app.add_middleware(RateLimitMiddleware)
app.add_middleware(LoggingMiddleware)

app.include_router(health_router)
app.include_router(auth_router, prefix="/api/v1/auth")
app.include_router(incident_router, prefix="/api/v1/incidents")
app.include_router(routing_router, prefix="/api/v1/routes")
app.include_router(user_router, prefix="/api/v1/users")
if settings.environment == "development":
    app.include_router(rbac_router, prefix="/api/v1/users")
