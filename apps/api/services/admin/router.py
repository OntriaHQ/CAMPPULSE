from typing import Annotated

from fastapi import APIRouter, Depends
from strawberry.fastapi import GraphQLRouter
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from core.dependencies import get_session, get_redis_client
from services.auth.dependencies import require_role
from services.admin.graphql.schema import schema
from services.admin.rest import router as rest_router
from services.user.models import User


async def get_context(
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis_client),
):
    return {"session": session, "redis": redis}


router = APIRouter(dependencies=[Depends(require_role("admin"))])

router.include_router(rest_router)

graphql_app = GraphQLRouter(schema, context_getter=get_context)
