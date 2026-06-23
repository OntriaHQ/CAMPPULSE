"""Ride fare/ETA domain logic (Level 3 — pure, no I/O)."""

import math
from decimal import Decimal, ROUND_HALF_UP

EARTH_RADIUS_METRES = 6_371_000

_BASE_FARE = Decimal("300")
_PER_KM_RATE = {
    "bicycle": Decimal("0"),
    "tricycle": Decimal("80"),
    "car": Decimal("150"),
    "van": Decimal("220"),
    "ambulance": Decimal("0"),
}
_AVG_SPEED_MPS = {
    "bicycle": 4.0,
    "tricycle": 6.0,
    "car": 8.5,
    "van": 7.5,
    "ambulance": 11.0,
}


def haversine_distance_metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return EARTH_RADIUS_METRES * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_fare(distance_metres: float, vehicle_type: str) -> Decimal:
    rate = _PER_KM_RATE.get(vehicle_type, _PER_KM_RATE["car"])
    distance_km = Decimal(str(distance_metres / 1000))
    fare = _BASE_FARE + rate * distance_km
    return fare.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def estimate_duration_seconds(distance_metres: float, vehicle_type: str) -> int:
    speed = _AVG_SPEED_MPS.get(vehicle_type, _AVG_SPEED_MPS["car"])
    return max(60, int(distance_metres / speed))
