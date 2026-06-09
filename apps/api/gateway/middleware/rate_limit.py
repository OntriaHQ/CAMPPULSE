import time

import redis.asyncio as redis
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.exceptions import RateLimitError, error_response
from core.redis import get_redis
from gateway.config import settings
from services.auth.security import decode_access_token_for_rate_limit


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path == "/health":
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(settings.rate_limit_guest)
            response.headers["X-RateLimit-Remaining"] = str(settings.rate_limit_guest)
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) // 60 * 60 + 60)
            response.headers["X-RateLimit-Role"] = "guest"
            return response

        redis_client = get_redis()
        identity, role = await self._resolve_identity(request)

        window_start = int(time.time()) // 60 * 60
        key = f"ratelimit:{identity}:{window_start}"
        limit = settings.rate_limit_for_role(role)

        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, 60)

        remaining = max(limit - count, 0)
        reset_at = window_start + 60

        if count > limit:
            exc = RateLimitError()
            response = JSONResponse(
                status_code=429,
                content=error_response(request, exc),
            )
        else:
            response = await call_next(request)

        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_at)
        response.headers["X-RateLimit-Role"] = role
        return response

    async def _resolve_identity(self, request: Request) -> tuple[str, str]:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
            claims = decode_access_token_for_rate_limit(token)
            if claims and claims.get("sub"):
                return str(claims["sub"]), str(claims.get("role", "guest"))

        client_host = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("X-Forwarded-For")
        identity = forwarded.split(",")[0].strip() if forwarded else client_host
        return identity, "guest"
