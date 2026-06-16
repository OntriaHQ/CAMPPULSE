"""Circuit breaker instance registry."""

from core.circuit_breaker import CircuitBreaker

_breakers: dict[str, CircuitBreaker] = {}


def get_mapbox_breaker() -> CircuitBreaker:
    if "mapbox" not in _breakers:
        _breakers["mapbox"] = CircuitBreaker(
            name="mapbox",
            failure_threshold=3,
            recovery_timeout=20.0,
            half_open_max_requests=1,
        )
    return _breakers["mapbox"]


def get_ors_breaker() -> CircuitBreaker:
    if "openrouteservice" not in _breakers:
        _breakers["openrouteservice"] = CircuitBreaker(
            name="openrouteservice",
            failure_threshold=3,
            recovery_timeout=20.0,
            half_open_max_requests=1,
        )
    return _breakers["openrouteservice"]


def reset_all() -> None:
    _breakers.clear()
