"""Google Polyline Encoding Algorithm implementation.

Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
"""


def _encode_value(value: int) -> str:
    value = value << 1
    if value < 0:
        value = ~value
    chunks = []
    while value >= 0x20:
        chunks.append((0x20 | (value & 0x1F)) + 63)
        value >>= 5
    chunks.append(value + 63)
    return "".join(chr(c) for c in chunks)


def encode_polyline(coords: list[tuple[float, float]]) -> str:
    """Encode a list of (lat, lon) coordinates into a Google polyline string."""
    if not coords:
        return ""

    result = []
    prev_lat = 0
    prev_lon = 0

    for lat, lon in coords:
        lat_int = round(lat * 1e5)
        lon_int = round(lon * 1e5)
        dlat = lat_int - prev_lat
        dlon = lon_int - prev_lon
        result.append(_encode_value(dlat))
        result.append(_encode_value(dlon))
        prev_lat = lat_int
        prev_lon = lon_int

    return "".join(result)


def _decode_value(chars: str, index: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        b = ord(chars[index]) - 63
        index += 1
        result |= (b & 0x1F) << shift
        shift += 5
        if b < 0x20:
            break
    if result & 1:
        result = ~result
    result >>= 1
    return result, index


def decode_polyline(polyline: str) -> list[tuple[float, float]]:
    """Decode a Google polyline string back into a list of (lat, lon) coordinates."""
    coords = []
    index = 0
    prev_lat = 0
    prev_lon = 0

    while index < len(polyline):
        dlat, index = _decode_value(polyline, index)
        dlon, index = _decode_value(polyline, index)
        prev_lat += dlat
        prev_lon += dlon
        coords.append((prev_lat / 1e5, prev_lon / 1e5))

    return coords
