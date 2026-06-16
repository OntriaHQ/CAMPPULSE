import { apiFetch } from './api';

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface RouteResponse {
  polyline: string;
  distance_metres: number;
  duration_seconds: number;
  origin: RoutePoint;
  destination: RoutePoint;
  mode: string;
  cache_hit: boolean;
  segments: Array<Record<string, unknown>>;
}

export interface SegmentResponse {
  id: string;
  road_id: string;
  name: string;
  zone: string | null;
  is_restricted: boolean;
  restriction_reason: string | null;
}

export async function calculateRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: 'walking' | 'tricycle' = 'walking',
): Promise<RouteResponse> {
  const res = await apiFetch<{ success: boolean; data: RouteResponse }>('/api/v1/routes/calculate', {
    method: 'POST',
    body: JSON.stringify({ origin, destination, mode }),
  });
  return res.data;
}

export async function reroute(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: 'walking' | 'tricycle' = 'walking',
  avoidSegmentIds: string[] = [],
): Promise<RouteResponse> {
  const res = await apiFetch<{ success: boolean; data: RouteResponse }>('/api/v1/routes/reroute', {
    method: 'POST',
    body: JSON.stringify({ origin, destination, mode, avoid_segment_ids: avoidSegmentIds }),
  });
  return res.data;
}

export async function fetchAllSegments(): Promise<SegmentResponse[]> {
  const res = await apiFetch<{ success: boolean; data: SegmentResponse[] }>('/api/v1/routes/segments');
  return res.data;
}

export async function fetchRestrictedSegments(): Promise<SegmentResponse[]> {
  const res = await apiFetch<{ success: boolean; data: SegmentResponse[] }>('/api/v1/routes/segments/restricted');
  return res.data;
}

export async function restrictSegment(id: string, reason: string): Promise<void> {
  await apiFetch(`/api/v1/routes/segments/${id}/restrict`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function clearSegmentRestriction(id: string): Promise<void> {
  await apiFetch(`/api/v1/routes/segments/${id}/clear`, { method: 'PATCH' });
}
