const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8005';
const TOKEN_KEY = 'cp_admin_token';
const REFRESH_KEY = 'cp_admin_refresh';
const USER_KEY = 'cp_admin_user';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearSessionAndRedirect(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof window !== 'undefined') window.location.href = '/login';
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;

      const body = await res.json();
      const newAccess: string | undefined = body?.data?.access_token;
      const newRefresh: string | undefined = body?.data?.refresh_token;
      if (!newAccess) return null;

      localStorage.setItem(TOKEN_KEY, newAccess);
      if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh);
      return newAccess;
    } catch {
      return null;
    }
  })();

  const result = await refreshInFlight;
  refreshInFlight = null;
  return result;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  async function attempt(token: string | null): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(init?.body instanceof FormData)) {
      headers['Content-Type'] ??= 'application/json';
    }
    return fetch(`${API}${path}`, { ...init, headers });
  }

  let res = await attempt(getToken());

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await attempt(newToken);
    } else {
      clearSessionAndRedirect();
    }
  }

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
