interface Point {
  lat: number;
  lng: number;
}

function encodeValue(value: number): string {
  let v = value << 1;
  if (v < 0) v = ~v;
  const chunks: number[] = [];
  while (v >= 0x20) {
    chunks.push((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  chunks.push(v + 63);
  return String.fromCharCode(...chunks);
}

export function encodePolyline(coords: Point[]): string {
  if (!coords.length) return '';
  const result: string[] = [];
  let prevLat = 0;
  let prevLng = 0;
  for (const { lat, lng } of coords) {
    const latInt = Math.round(lat * 1e5);
    const lngInt = Math.round(lng * 1e5);
    result.push(encodeValue(latInt - prevLat));
    result.push(encodeValue(lngInt - prevLng));
    prevLat = latInt;
    prevLng = lngInt;
  }
  return result.join('');
}

function decodeValue(chars: string, idx: number): [number, number] {
  let result = 0;
  let shift = 0;
  while (true) {
    const b = chars.charCodeAt(idx) - 63;
    idx += 1;
    result |= (b & 0x1f) << shift;
    shift += 5;
    if (b < 0x20) break;
  }
  if (result & 1) result = ~result;
  result >>= 1;
  return [result, idx];
}

export function decodePolyline(polyline: string): Point[] {
  const coords: Point[] = [];
  let idx = 0;
  let prevLat = 0;
  let prevLng = 0;
  while (idx < polyline.length) {
    const [dlat, next1] = decodeValue(polyline, idx);
    const [dlng, next2] = decodeValue(polyline, next1);
    prevLat += dlat;
    prevLng += dlng;
    coords.push({ lat: prevLat / 1e5, lng: prevLng / 1e5 });
    idx = next2;
  }
  return coords;
}
