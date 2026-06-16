import { createContext, useContext, useState, useEffect } from 'react';

interface User { id: string; email: string; full_name: string; role: string; kyc_status: string; }

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const API       = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'cp_admin_token';
const USER_KEY  = 'cp_admin_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,  setUser]  = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const u = localStorage.getItem(USER_KEY);
    if (t && u) {
      try { setToken(t); setUser(JSON.parse(u)); } catch {}
    }
  }, []);

  async function login(email: string, password: string) {
    // 1. Exchange credentials for tokens
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
    // Response shape: { success, data: { user: {...}, tokens: { access_token, ... } }, meta }
    const data = body?.data;
    const accessToken: string = data?.tokens?.access_token;
    if (!accessToken) throw new Error('No access token in response');

    const profile = data?.user;
    const userObj: User = {
      id:         profile?.id ?? '',
      email:      profile?.email ?? email,
      full_name:  profile?.full_name ?? email,
      role:       profile?.role ?? 'admin',
      kyc_status: profile?.kyc_status ?? 'pending',
    };

    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    setToken(accessToken);
    setUser(userObj);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
