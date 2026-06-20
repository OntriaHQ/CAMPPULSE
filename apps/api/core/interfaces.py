from typing import Protocol, runtime_checkable


@runtime_checkable
class RouteCalculator(Protocol):
    async def calculate_route(
        self,
        origin: dict,
        destination: dict,
        mode: str,
        redis_client,
        session,
    ) -> dict | None:
        ...
