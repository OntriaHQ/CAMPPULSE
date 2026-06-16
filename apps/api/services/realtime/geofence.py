"""Geofence enforcement for the realtime service.

Pure domain function (Level 3) — no I/O, no async.
Uses the rectangular boundary of Redemption City camp from boundary.json.
"""

# Redemption City camp boundary (from packages/map-config/src/boundary.json)
_BOUNDARY_LON_MIN = 3.3900
_BOUNDARY_LON_MAX = 3.4020
_BOUNDARY_LAT_MIN = 6.9220
_BOUNDARY_LAT_MAX = 6.9320


def is_within_boundary(lat: float, lon: float) -> bool:
    """Return True if the coordinate falls within the camp boundary polygon."""
    return (
        _BOUNDARY_LAT_MIN <= lat <= _BOUNDARY_LAT_MAX
        and _BOUNDARY_LON_MIN <= lon <= _BOUNDARY_LON_MAX
    )
