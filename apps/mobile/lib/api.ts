import { storage } from './storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
    fields?: { field: string; message: string }[];
  };
  meta?: {
    timestamp: number;
    request_id: string;
  };
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'guest' | 'resident' | 'driver' | 'admin';
  kyc_status: 'pending' | 'verified' | 'rejected';
  camp_id?: string;
  zone?: string;
  created_at: string;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

let isRefreshing = false;

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<ApiResponse<T>> {
  const token = await storage.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && !isRefreshing) {
    isRefreshing = true;
    try {
      const refreshToken = await storage.getRefreshToken();
      if (refreshToken) {
        const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const refreshData: ApiResponse<Tokens> = await refreshRes.json();
          if (refreshData.data) {
            await storage.setTokens(
              refreshData.data.access_token,
              refreshData.data.refresh_token,
            );
            isRefreshing = false;
            return request<T>(path, options, false);
          }
        }
      }
    } finally {
      isRefreshing = false;
    }
    await storage.clearTokens();
  }

  if (res.status === 204) {
    return { success: true } as ApiResponse<T>;
  }

  return res.json() as Promise<ApiResponse<T>>;
}

export const api = {
  auth: {
    register: (data: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role: 'resident' | 'driver';
      camp_id?: string;
      zone?: string;
    }) =>
      request<{ user: User; tokens: Tokens }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    login: (data: { email: string; password: string }) =>
      request<{ user: User; tokens: Tokens }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    refresh: (refresh_token: string) =>
      request<Tokens>('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token }),
      }),

    logout: () =>
      request('/api/v1/auth/logout', { method: 'POST' }),
  },

  users: {
    me: () => request<User>('/api/v1/users/me'),

    updateMe: (data: Partial<Pick<User, 'full_name' | 'phone' | 'zone'>>) =>
      request<User>('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  incidents: {
    nearby: (lat: number, lon: number, radius = 500) =>
      request(`/api/v1/incidents/nearby?lat=${lat}&lon=${lon}&radius_metres=${radius}`),

    getById: (id: string) =>
      request(`/api/v1/incidents/${id}`),

    myReports: () =>
      request('/api/v1/incidents/mine'),

    upvote: (id: string) =>
      request(`/api/v1/incidents/${id}/upvote`, { method: 'POST' }),
  },
};
