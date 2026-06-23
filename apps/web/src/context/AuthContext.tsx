import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User { id: string; email: string; full_name: string; role: string; kyc_status: string; }

interface AuthCtx {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const API       = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'cp_admin_token';
const REFRESH_KEY = 'cp_admin_refresh';
const USER_KEY  = 'cp_admin_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,         setUser]         = useState<User | null>(() => {
    try { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; } catch { return null; }
  });
  const [token,        setToken]        = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(REFRESH_KEY));

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? body?.error?.message ?? 'Login failed');
    }

    const body = await res.json();
    const data = body?.data;
    const accessToken: string = data?.tokens?.access_token;
    const refToken: string = data?.tokens?.refresh_token;
    if (!accessToken || !refToken) throw new Error('No tokens in response');

    const profile = data?.user;
    const userObj: User = {
      id:         profile?.id ?? '',
      email:      profile?.email ?? email,
      full_name:  profile?.full_name ?? email,
      role:       profile?.role ?? 'admin',
      kyc_status: profile?.kyc_status ?? 'pending',
    };

    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    setToken(accessToken);
    setRefreshToken(refToken);
    setUser(userObj);
  }

  const logout = useCallback(async () => {
    try {
      const tok = localStorage.getItem(TOKEN_KEY);
      if (tok) {
        await fetch(`${API}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok}` },
        });
      }
    } catch {
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  }, []);

  return (
    <Ctx.Provider value={{ user, token, refreshToken, login, logout, isAuthenticated: !!token }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
