import { apiFetch } from '../lib/api';

export interface IncidentNearby {
  id: string;
  type: string;
  severity: string;
  status: string;
  address_label: string | null;
  upvote_count: number;
  distance_metres: number;
  location: {
    lat: number;
    lon: number;
  };
}

export async function getIncidentsNearby(
  lat: number,
  lon: number,
  radiusMetres = 1000,
): Promise<IncidentNearby[]> {
  const res = await apiFetch<{ success: boolean; data: { items: IncidentNearby[] } }>(
    `/api/v1/incidents/nearby?lat=${lat}&lon=${lon}&radius_metres=${radiusMetres}`,
  );
  return res.data.items;
}
