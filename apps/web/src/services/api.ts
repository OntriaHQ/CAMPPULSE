const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function getToken(): string | null {
  return localStorage.getItem('cp_admin_token');
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(init?.body instanceof FormData)) {
    headers['Content-Type'] ??= 'application/json';
  }

  const res = await fetch(`${API}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message ?? body?.detail ?? `Request failed (${res.status})`;
    const code = body?.error?.code ?? 'UNKNOWN_ERROR';
    throw Object.assign(new Error(msg), { status: res.status, code, body });
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function apiUrl(): string {
  return API;
}
