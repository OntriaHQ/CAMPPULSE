import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, User } from '@/lib/api';
import { storage } from '@/lib/storage';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'resident' | 'driver';
  camp_id?: string;
  zone?: string;
}

type AuthContextType = AuthState & AuthActions;

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getAccessToken();
        if (token) {
          const res = await api.users.me();
          if (res.success && res.data) {
            setUser(res.data);
            await storage.setUser(res.data);
          } else {
            await storage.clearTokens();
          }
        }
      } catch {
        await storage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? 'Login failed');
    }
    await storage.setTokens(res.data.tokens.access_token, res.data.tokens.refresh_token);
    await storage.setUser(res.data.user);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api.auth.register(data);
    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? 'Registration failed');
    }
    await storage.setTokens(res.data.tokens.access_token, res.data.tokens.refresh_token);
    await storage.setUser(res.data.user);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // silent — clear local state regardless
    }
    await storage.clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.users.me();
    if (res.success && res.data) {
      setUser(res.data);
      await storage.setUser(res.data);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
