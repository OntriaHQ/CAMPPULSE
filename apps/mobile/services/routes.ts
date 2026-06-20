import { apiFetch } from '../lib/api';

export interface RoutePoint {
  lat: number;
  lon: number;
}

export async function calculateRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: 'walking' | 'tricycle' = 'walking',
): Promise<{
  polyline: string;
  distance_metres: number;
  duration_seconds: number;
}> {
  const res = await apiFetch<{ success: boolean; data: any }>('/api/v1/routes/calculate', {
    method: 'POST',
    body: JSON.stringify({ origin, destination, mode }),
  });
  return res.data;
}
