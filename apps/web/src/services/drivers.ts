import { apiFetch } from './api';

export interface DriverAvailable {
  user_id: string;
  full_name: string;
  vehicle_type: string;
  distance_metres: number;
  current_location: { lat: number; lon: number };
}

export interface LiveDriver {
  user_id: string;
  lat: number;
  lon: number;
  zone: string;
  timestamp: string;
}

export interface LiveMapData {
  incidents: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    zone: string;
    lat: number;
    lon: number;
    created_at: string;
  }>;
  users: Array<{
    user_id: string;
    lat: number;
    lon: number;
    zone: string;
    timestamp: string;
  }>;
}

export async function fetchAvailableDrivers(
  lat: number,
  lon: number,
  radiusMetres = 2000,
): Promise<{ drivers: DriverAvailable[]; total: number }> {
  const res = await apiFetch<{ success: boolean; data: { drivers: DriverAvailable[]; total: number } }>(
    `/api/v1/users/drivers/available?lat=${lat}&lon=${lon}&radius_metres=${radiusMetres}`,
  );
  return res.data;
}

export async function fetchLiveDrivers(): Promise<LiveDriver[]> {
  const res = await apiFetch<{ success: boolean; data: { drivers: LiveDriver[] } }>(
    '/api/v1/admin/drivers/live',
  );
  return res.data.drivers;
}

export async function fetchLiveMapData(): Promise<LiveMapData> {
  const res = await apiFetch<{ success: boolean; data: LiveMapData }>(
    '/api/v1/admin/map/live',
  );
  return res.data;
}
