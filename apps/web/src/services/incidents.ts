import { apiFetch } from './api';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'submitted' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

export interface IncidentDetail {
  id: string;
  type: string;
  description: string | null;
  photo_url: string | null;
  location: { lat: number; lon: number };
  address_label: string | null;
  zone: string | null;
  severity: Severity;
  status: Status;
  department: string | null;
  upvote_count: number;
  is_duplicate: boolean;
  reporter_name: string | null;
  assignee_name: string | null;
  comments: Array<{
    id: string;
    body: string;
    author_name: string;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface IncidentNearbyItem {
  id: string;
  type: string;
  severity: Severity;
  status: Status;
  address_label: string | null;
  upvote_count: number;
  distance_metres: number;
}

export interface IncidentCreateResponse {
  success: boolean;
  data: {
    incident_id: string | null;
    is_duplicate: boolean;
    parent_incident_id: string | null;
    parent_upvote_count: number | null;
    status: string | null;
    department: string | null;
    photo_url: string | null;
    estimated_response_window: string | null;
    message: string | null;
    dispatch: Record<string, unknown> | null;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    pagination: {
      page: number;
      page_size: number;
      total: number;
      has_next: boolean;
    };
  };
}

export async function createIncident(formData: FormData): Promise<IncidentCreateResponse['data']> {
  const res = await apiFetch<IncidentCreateResponse>('/api/v1/incidents', {
    method: 'POST',
    body: formData,
  });
  return res.data;
}

export async function getIncident(id: string): Promise<IncidentDetail> {
  const res = await apiFetch<{ success: boolean; data: IncidentDetail }>(`/api/v1/incidents/${id}`);
  return res.data;
}

export async function getIncidentsNearby(
  lat: number,
  lon: number,
  radiusMetres = 500,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<IncidentNearbyItem>> {
  return apiFetch<PaginatedResponse<IncidentNearbyItem>>(
    `/api/v1/incidents/nearby?lat=${lat}&lon=${lon}&radius_metres=${radiusMetres}&page=${page}&page_size=${pageSize}`,
  );
}

export async function getIncidentsByZone(
  zone: string,
  status?: string,
  type?: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<IncidentDetail>> {
  let path = `/api/v1/incidents/zone/${encodeURIComponent(zone)}?page=${page}&page_size=${pageSize}`;
  if (status) path += `&status=${encodeURIComponent(status)}`;
  if (type) path += `&type=${encodeURIComponent(type)}`;
  return apiFetch<PaginatedResponse<IncidentDetail>>(path);
}

export async function upvoteIncident(id: string): Promise<{ incident_id: string; upvote_count: number }> {
  const res = await apiFetch<{ success: boolean; data: { incident_id: string; upvote_count: number } }>(
    `/api/v1/incidents/${id}/upvote`, { method: 'POST' },
  );
  return res.data;
}

export async function addComment(id: string, body: string): Promise<{ comment_id: string; body: string; created_at: string }> {
  const res = await apiFetch<{ success: boolean; data: { comment_id: string; body: string; created_at: string } }>(
    `/api/v1/incidents/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) },
  );
  return res.data;
}

export async function updateIncidentStatus(id: string, status: string, note?: string): Promise<void> {
  await apiFetch(`/api/v1/incidents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}

export async function assignIncident(id: string, assignedTo: string, department?: string): Promise<void> {
  await apiFetch(`/api/v1/incidents/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assigned_to: assignedTo, department }),
  });
}
