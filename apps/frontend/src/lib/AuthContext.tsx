'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api';

// ── 8 distinct operator roles ─────────────────────────────────────────────────
export type UserRole =
  | 'DEVELOPER'   // Project owners — submit, manage, 3D/2D uploads
  | 'INVESTOR'    // Capital providers — portfolio, yield, Paystack
  | 'CONTRACTOR'  // Builders — browse by trade, bid on milestones
  | 'VERIFIER'    // Independent auditors — site inspection, release gate
  | 'SUPPLIER'    // Material supply chain — dispatch, delivery tracking
  | 'BANK'        // Institutional capital — tranche management, ledger
  | 'GOVERNMENT'  // Regulators — mandate projects, approve milestones
  | 'ADMIN';      // Super admin — system-wide access, user management

interface User {
  id: string; email: string; role: UserRole; full_name: string;
  email_verified?: boolean; totp_enabled?: boolean;
}

interface AuthContextType {
  user: User | null; token: string | null; isLoading: boolean; isAuthenticated: boolean;
  login:    (email: string, password: string) => Promise<string>;
  register: (email: string, password: string, full_name: string, role: string) => Promise<string>;
  logout:   () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Single source of truth for post-login routing ─────────────────────────────
export function getRoleRoute(role: UserRole): string {
  switch (role) {
    case 'ADMIN':      return '/admin';
    case 'GOVERNMENT': return '/gov';
    case 'DEVELOPER':  return '/projects/my';
    case 'INVESTOR':   return '/portfolio';
    case 'CONTRACTOR': return '/projects';
    case 'VERIFIER':   return '/admin/approval';
    case 'SUPPLIER':   return '/supplier';
    case 'BANK':       return '/bank';
    default:           return '/dashboard';
  }
}

// ── Page-level access guard ───────────────────────────────────────────────────
export function canAccess(role: UserRole, path: string): boolean {
  if (role === 'ADMIN') return true;

  const rules: Record<string, UserRole[]> = {
    '/admin':              ['ADMIN'],
    '/gov':                ['GOVERNMENT'],
    '/portfolio':          ['INVESTOR', 'ADMIN'],
    '/investments':        ['INVESTOR', 'ADMIN'],
    '/projects/my':        ['DEVELOPER', 'GOVERNMENT', 'ADMIN'],
    '/projects/submit':    ['DEVELOPER', 'GOVERNMENT', 'ADMIN', 'CONTRACTOR'],
    '/projects':           ['DEVELOPER', 'GOVERNMENT', 'CONTRACTOR', 'SUPPLIER', 'ADMIN', 'INVESTOR', 'VERIFIER', 'BANK'],
    '/milestones':         ['GOVERNMENT', 'DEVELOPER', 'CONTRACTOR', 'ADMIN', 'VERIFIER'],
    '/ledger':             ['ADMIN', 'GOVERNMENT', 'BANK', 'INVESTOR', 'VERIFIER', 'DEVELOPER'],
    '/supplier':           ['SUPPLIER'],
    '/bank':               ['BANK'],
    '/dashboard':          ['INVESTOR', 'CONTRACTOR', 'SUPPLIER', 'BANK', 'GOVERNMENT', 'ADMIN', 'VERIFIER', 'DEVELOPER'],
    '/kyc':                ['INVESTOR', 'CONTRACTOR', 'SUPPLIER', 'BANK', 'DEVELOPER'],
    '/map':                ['INVESTOR', 'GOVERNMENT', 'ADMIN', 'BANK', 'CONTRACTOR', 'DEVELOPER', 'VERIFIER'],
    '/contractor-profile': ['CONTRACTOR', 'ADMIN'],
    '/about':              ['INVESTOR', 'CONTRACTOR', 'SUPPLIER', 'BANK', 'GOVERNMENT', 'ADMIN', 'VERIFIER', 'DEVELOPER'],
    '/landing':            ['INVESTOR', 'CONTRACTOR', 'SUPPLIER', 'BANK', 'GOVERNMENT', 'ADMIN', 'VERIFIER', 'DEVELOPER'],
  };

  for (const [prefix, allowed] of Object.entries(rules)) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      return (allowed as string[]).includes(role);
    }
  }
  return true; // public routes
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null);
  const [token,     setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (authToken: string) => {
    try {
      const res = await api.get('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } });
      setUser(res.data.user);
      setToken(authToken);
    } catch {
      localStorage.removeItem('token');
      setToken(null); setUser(null);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) fetchUser(stored);
    else setIsLoading(false);
  }, [fetchUser]);

  const login = async (email: string, password: string): Promise<string> => {
    const res = await api.post('/api/auth/login', { email: email.toLowerCase(), password });
    const accessToken = res.data.tokens.access_token;
    localStorage.setItem('token', accessToken);
    setToken(accessToken); setUser(res.data.user);
    return getRoleRoute(res.data.user.role as UserRole);
  };

  const register = async (email: string, password: string, full_name: string, role: string): Promise<string> => {
    const res = await api.post('/api/auth/register', { email: email.toLowerCase(), password, full_name, role });
    const accessToken = res.data.tokens.access_token;
    localStorage.setItem('token', accessToken);
    setToken(accessToken); setUser(res.data.user);
    return getRoleRoute(res.data.user.role as UserRole);
  };

  const logout = () => { setUser(null); setToken(null); localStorage.removeItem('token'); };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
