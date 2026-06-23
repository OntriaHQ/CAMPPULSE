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
        const storedUser = await storage.getUser();
        if (token && storedUser) {
          // DEMO MOCK: Use stored user so they stay as a driver if they logged in as one
          setUser(storedUser);
          setIsLoading(false);
          return;
        } else if (token) {
          setUser({
             id: 'demo-user',
             email: 'demo@campulse.local',
             full_name: 'Demo User',
             role: 'resident',
             kyc_status: 'verified',
             camp_id: 'RDC-1234',
             zone: 'Central Camp'
          });
          setIsLoading(false);
          return;
        }
      } catch {
        await storage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // DEMO MOCK: Instantly succeed login without backend
    const isDriver = email.toLowerCase().includes('driver');
    const mockUser = {
      id: isDriver ? 'demo-driver' : 'demo-user',
      email,
      full_name: isDriver ? 'Demo Driver' : 'Demo User',
      role: isDriver ? 'driver' : 'resident',
      kyc_status: 'verified',
      camp_id: 'RDC-1234',
      zone: 'Central Camp'
    } as any;
    await storage.setTokens('mock_access_token', 'mock_refresh_token');
    await storage.setUser(mockUser);
    setUser(mockUser);
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
