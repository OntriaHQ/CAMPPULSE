import { apiFetch } from './api';

export interface UserPublic {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  kyc_status: string;
}

export interface UserProfile extends UserPublic {
  phone: string | null;
  camp_id: string | null;
  zone: string | null;
  created_at: string;
}

interface AuthResponse {
  success: boolean;
  data: {
    user: UserPublic;
    tokens: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  };
}

interface RefreshResponse {
  success: boolean;
  data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export async function loginApi(email: string, password: string): Promise<AuthResponse['data']> {
  const res = await apiFetch<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.data;
}

export async function registerApi(data: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'resident' | 'driver';
  camp_id?: string;
  zone?: string;
}): Promise<AuthResponse['data']> {
  const res = await apiFetch<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function refreshTokenApi(refreshToken: string): Promise<RefreshResponse['data']> {
  const res = await apiFetch<RefreshResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return res.data;
}

export async function logoutApi(): Promise<void> {
  await apiFetch<void>('/api/v1/auth/logout', { method: 'POST' });
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const res = await apiFetch<{ success: boolean; data: UserProfile }>('/api/v1/users/me');
  return res.data;
}
