import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        field: str | None = None,
        fields: list[dict[str, str]] | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.field = field
        self.fields = fields


class AuthenticationError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code=code, message=message, status_code=401)


class AuthorisationError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code=code, message=message, status_code=403)


class ConflictError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code=code, message=message, status_code=409)


class NotFoundError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code=code, message=message, status_code=404)


class ValidationError(AppError):
    def __init__(
        self,
        message: str = "Request payload validation failed.",
        fields: list[dict[str, str]] | None = None,
    ):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=400,
            fields=fields,
        )


class RateLimitError(AppError):
    def __init__(self, message: str = "Request rate limit exceeded."):
        super().__init__(code="RATE_LIMITED", message=message, status_code=429)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def error_response(request: Request, exc: AppError) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": exc.code,
        "message": exc.message,
    }
    if exc.field is not None:
        error["field"] = exc.field
    if exc.fields is not None:
        error["fields"] = exc.fields
    return {
        "success": False,
        "error": error,
        "meta": {
            "timestamp": int(time.time()),
            "request_id": _request_id(request),
        },
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(request, exc),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields = [
            {"field": ".".join(str(part) for part in err["loc"][1:]), "message": err["msg"]}
            for err in exc.errors()
        ]
        app_exc = ValidationError(fields=fields)
        return JSONResponse(
            status_code=400,
            content=error_response(request, app_exc),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        app_exc = AppError(
            code="HTTP_ERROR",
            message=str(exc.detail),
            status_code=exc.status_code,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(request, app_exc),
        )
