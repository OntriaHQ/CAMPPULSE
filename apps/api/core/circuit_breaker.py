"""Circuit breaker implementation with states: CLOSED, OPEN, HALF_OPEN."""

import time
from enum import Enum
from typing import Any


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        recovery_timeout: float = 20.0,
        half_open_max_requests: int = 1,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_requests = half_open_max_requests

        self.state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._half_open_requests = 0
        self._last_state_change = 0.0

    def _should_trip(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return self._failure_count >= self.failure_threshold
        return False

    async def call(self, action: Any, fallback: Any = None) -> Any:
        now = time.time()

        if self.state == CircuitState.OPEN:
            if now - self._last_state_change >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self._half_open_requests = 0
                self._last_state_change = now
            else:
                if fallback is not None:
                    return fallback() if callable(fallback) else fallback
                raise CircuitBreakerOpenError(self.name)

        if self.state == CircuitState.HALF_OPEN:
            if self._half_open_requests >= self.half_open_max_requests:
                if fallback is not None:
                    return fallback() if callable(fallback) else fallback
                raise CircuitBreakerOpenError(self.name)
            self._half_open_requests += 1

        try:
            result = await action() if callable(action) else action
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            if fallback is not None:
                return fallback() if callable(fallback) else fallback
            raise

    def _on_success(self) -> None:
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            self._failure_count = 0
            self._half_open_requests = 0
            self._last_state_change = time.time()
        elif self.state == CircuitState.CLOSED:
            self._failure_count = 0

    def _on_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.time()

        if self._should_trip():
            self.state = CircuitState.OPEN
            self._last_state_change = time.time()

    @property
    def is_open(self) -> bool:
        return self.state == CircuitState.OPEN

    @property
    def is_closed(self) -> bool:
        return self.state == CircuitState.CLOSED

    @property
    def is_half_open(self) -> bool:
        return self.state == CircuitState.HALF_OPEN


class CircuitBreakerOpenError(Exception):
    def __init__(self, name: str):
        self.name = name
        super().__init__(f"Circuit breaker '{name}' is open")
