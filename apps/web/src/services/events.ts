import { apiFetch } from './api';

export interface CampEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  area: string;
  category: string;
  status: string;
  attendance: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedEvents {
  items: CampEvent[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export async function fetchEvents(
  category?: string,
  status?: string,
  search?: string,
  page = 1,
  pageSize = 50,
): Promise<PaginatedEvents> {
  let path = `/api/v1/events?page=${page}&page_size=${pageSize}`;
  if (category) path += `&category=${encodeURIComponent(category)}`;
  if (status) path += `&status=${encodeURIComponent(status)}`;
  if (search) path += `&search=${encodeURIComponent(search)}`;

  const res = await apiFetch<{ success: boolean; data: PaginatedEvents }>(path);
  return res.data;
}

export async function fetchEvent(id: string): Promise<CampEvent> {
  const res = await apiFetch<{ success: boolean; data: CampEvent }>(`/api/v1/events/${id}`);
  return res.data;
}

export async function createEvent(data: {
  title: string;
  description?: string;
  date: string;
  time: string;
  area: string;
  category: string;
  status?: string;
  attendance?: string;
}): Promise<CampEvent> {
  const res = await apiFetch<{ success: boolean; data: CampEvent }>('/api/v1/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateEvent(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    date: string;
    time: string;
    area: string;
    category: string;
    status: string;
    attendance: string;
  }>,
): Promise<CampEvent> {
  const res = await apiFetch<{ success: boolean; data: CampEvent }>(`/api/v1/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteEvent(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/events/${id}`, { method: 'DELETE' });
}
