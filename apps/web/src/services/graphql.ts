import { apiUrl } from './api';

const API = apiUrl();
const TOKEN_KEY = 'cp_admin_token';
const REFRESH_KEY = 'cp_admin_refresh';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

interface GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: Array<{ line: number; column: number }>; path?: string[] }>;
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

function isAuthError(body: GqlResponse<unknown>): boolean {
  return !!body.errors?.some(e => /token|unauthoriz|unauthenticated/i.test(e.message));
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  async function attempt(token: string | null): Promise<GqlResponse<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    return res.json();
  }

  let body = await attempt(getToken());

  if (isAuthError(body)) {
    const newToken = await refreshAccessToken();
    if (newToken) body = await attempt(newToken);
  }

  if (body.errors?.length) {
    throw Object.assign(new Error(body.errors[0].message), { errors: body.errors });
  }

  return body.data as T;
}
