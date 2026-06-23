import { gql } from './graphql';

export interface DashboardSummary {
  total_incidents: number;
  open_incidents: number;
  in_progress_incidents: number;
  active_zones: number;
  congestion_zones_count: number;
}

export interface IncidentType {
  id: string;
  type: string;
  severity: string;
  status: string;
  zone: string | null;
  description: string | null;
  photo_url: string | null;
  address_label: string | null;
  upvote_count: number;
  department: string | null;
  reporter_name: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  location: { lat: number; lon: number } | null;
}

export interface HotspotType {
  zone: string;
  incident_count: number;
  lat: number;
  lon: number;
}

export interface EquityMetricType {
  zone: string;
  total_incidents: number;
  avg_resolution_time_minutes: number;
}

export interface UserType {
  id: string;
  email: string;
  full_name: string;
  role: string;
  zone: string | null;
}

export interface MutationResponse {
  success: boolean;
  message: string | null;
  id: string | null;
}

// Queries

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8005';

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/api/v1/incidents/all`);
  const { data } = await res.json();
  return {
    total_incidents: data.length,
    open_incidents: data.filter((i: any) => i.status === 'active' || i.status === 'submitted').length,
    in_progress_incidents: data.filter((i: any) => i.status === 'in_progress').length,
    active_zones: new Set(data.map((i: any) => i.zone)).size,
    congestion_zones_count: 0,
  };
}

export async function fetchIncidentList(
  status?: string,
  zone?: string,
  limit = 50,
  offset = 0,
): Promise<IncidentType[]> {
  const res = await fetch(`${API_URL}/api/v1/incidents/all`);
  const { data } = await res.json();
  let incidents = data;
  if (status) incidents = incidents.filter((i: any) => i.status === status);
  if (zone) incidents = incidents.filter((i: any) => i.zone === zone);

  // Map our simple REST payload to the GraphQL schema the dashboard expects
  return incidents.map((i: any) => ({
    id: i.id,
    type: i.type,
    severity: i.severity,
    status: i.status === 'active' ? 'submitted' : i.status,
    zone: i.zone,
    description: i.description,
    photo_url: null,
    address_label: i.zone,
    upvote_count: 0,
    department: null,
    reporter_name: 'Demo User',
    assignee_name: null,
    created_at: i.created_at,
    updated_at: null,
    resolved_at: null,
    location: { lat: i.lat, lon: i.lon }
  }));
}

export async function fetchIncidentHotspots(): Promise<HotspotType[]> {
  return [];
}

export async function fetchEquityMetrics(): Promise<EquityMetricType[]> {
  return [];
}

export async function fetchUsers(role?: string, zone?: string, limit = 50, offset = 0): Promise<UserType[]> {
  return [];
}

// Mutations

export async function gqlUpdateIncidentStatus(id: string, status: string, note?: string): Promise<MutationResponse> {
  const res = await fetch(`${API_URL}/api/v1/incidents/${id}/status?status=${status}`, { method: 'PATCH' });
  const data = await res.json();
  return { success: data.success, message: null, id };
}

export async function gqlAssignIncident(id: string, userId: string, department?: string): Promise<MutationResponse> {
  // Mock assign by changing status to 'assigned'
  const res = await fetch(`${API_URL}/api/v1/incidents/${id}/status?status=assigned`, { method: 'PATCH' });
  const data = await res.json();
  return { success: data.success, message: null, id };
}

export async function gqlBulkUpdateIncidentStatus(ids: string[], status: string): Promise<MutationResponse> {
  for (const id of ids) {
    await fetch(`${API_URL}/api/v1/incidents/${id}/status?status=${status}`, { method: 'PATCH' });
  }
  return { success: true, message: null, id: null };
}

export async function gqlSendZoneBroadcast(zone: string, title: string, body: string): Promise<MutationResponse> {
  return { success: true, message: null, id: null };
}
