'use client';
/**
 * src/lib/AuthContext.tsx
 *
 * BACKEND TRUTH (from index.ts):
 *   - Users table has: id, email, password, full_name, phone, role
 *   - DB role values: INVESTOR | CONTRACTOR | GOVERNMENT | ADMIN |
 *                     VERIFIER | SUPPLIER | BANK | DEVELOPER | TENANT
 *   - Default role on register: PROJECT_SPONSOR (treated as DEVELOPER)
 *   - Login response: { user: {id,email,full_name,role}, tokens: {access_token} }
 *   - Register response: { user, tokens: {access_token} }
 *   - /api/auth/me response: { user: {id,email,full_name,role} }
 *
 * ARCHITECTURAL DECISION (Business vs Technical role separation):
 *   - `role` = DB/auth role (DEVELOPER, TENANT, INVESTOR, etc.)
 *   - `accountType` = business context derived at login time, stored in
 *     localStorage as 'ark_account_type'. NOT sent to backend.
 *
 * FIX APPLIED:
 *   - setCookie now also writes `ark_token` so middleware's `!token` check
 *     does not falsely trigger the auth_required redirect loop.
 *   - login() and register() use window.location.href so the browser fully
 *     commits all cookies before navigation begins (eliminates race condition).
 *   - Secure flag added on HTTPS origins.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { useRouter } from 'next/navigation';
import api from './api';

// ─────────────────────────────────────────────────────────────────────────────
// DB ROLES
// ─────────────────────────────────────────────────────────────────────────────

export type DbRole =
  | 'INVESTOR'
  | 'CONTRACTOR'
  | 'GOVERNMENT'
  | 'ADMIN'
  | 'FOUNDER'
  | 'VERIFIER'
  | 'SUPPLIER'
  | 'BANK'
  | 'DEVELOPER'
  | 'TENANT'
  | 'PROJECT_SPONSOR';

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AccountType =
  | 'LANDLORD'
  | 'INFRASTRUCTURE'
  | 'DIASPORA'
  | 'GOVERNMENT'
  | 'INVESTOR'
  | 'CONTRACTOR'
  | 'SUPPLIER'
  | 'BANK'
  | 'TENANT'
  | 'ADMIN';

// ─────────────────────────────────────────────────────────────────────────────
// USER TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: DbRole;
  accountType: AccountType;
  phone?: string;
  kyc_status?: string;
  avatar_url?: string;
  tenancy_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT TYPE
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;

  isLandlord: boolean;
  isInfraBuilder: boolean;

  login: (email: string, password: string) => Promise<void>;

  /**
   * Google Sign-In. Unlike `login`/`register`, this does NOT auto-redirect —
   * per product decision, every Google sign-in (new or returning) must pass
   * through role confirmation first. Returns whether a role still needs to
   * be picked so the caller can route to the role-selection screen or
   * straight to the dashboard.
   */
  loginWithGoogle: (credential: string) => Promise<{ needsRoleSelection: boolean }>;

  /** Confirms/sets the user's role — called from the role-selection screen shown after every Google sign-in. */
  setRole: (role: DbRole) => Promise<void>;

  register: (data: RegisterData) => Promise<void>;

  logout: () => void;

  refresh: () => Promise<void>;

  setAccountType: (type: AccountType) => void;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: DbRole;
  accountType?: AccountType;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// ROLE ACCESS HELPER
// ─────────────────────────────────────────────────────────────────────────────

export const canAccess = (
  userRole: DbRole | undefined,
  allowedRoles: DbRole[]
): boolean => {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
};

// ─────────────────────────────────────────────────────────────────────────────
// COOKIE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return;

  const expires = new Date(Date.now() + days * 864e5).toUTCString();

  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';

  document.cookie =
    `${name}=${encodeURIComponent(value)}; ` +
    `expires=${expires}; path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;

  document.cookie =
    `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT TYPE DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

function deriveAccountType(
  role: DbRole,
  storedType?: string | null
): AccountType {
  // HARD LOCK FOR TENANTS
  if (role === 'TENANT') return 'TENANT';

  if (storedType) {
    const compatible: Record<string, DbRole[]> = {
      LANDLORD:       ['DEVELOPER', 'PROJECT_SPONSOR'],
      INFRASTRUCTURE: ['DEVELOPER', 'PROJECT_SPONSOR'],
      DIASPORA:       ['DEVELOPER', 'PROJECT_SPONSOR', 'INVESTOR'],
      INVESTOR:       ['INVESTOR'],
      CONTRACTOR:     ['CONTRACTOR'],
      SUPPLIER:       ['SUPPLIER'],
      BANK:           ['BANK'],
      GOVERNMENT:     ['GOVERNMENT', 'VERIFIER'],
      TENANT:         ['TENANT'],
      ADMIN:          ['ADMIN'],
    };
    if (compatible[storedType]?.includes(role)) {
      return storedType as AccountType;
    }
  }

  switch (role) {
    case 'INVESTOR':    return 'INVESTOR';
    case 'CONTRACTOR':  return 'CONTRACTOR';
    case 'SUPPLIER':    return 'SUPPLIER';
    case 'BANK':        return 'BANK';
    case 'GOVERNMENT':
    case 'VERIFIER':    return 'GOVERNMENT';
    case 'ADMIN':       return 'ADMIN';
    case 'FOUNDER':                 return 'ADMIN';
    case 'DEVELOPER':
    case 'PROJECT_SPONSOR':
      if (storedType === 'LANDLORD') return 'LANDLORD';
      if (storedType === 'DIASPORA') return 'DIASPORA';
      return 'INFRASTRUCTURE';
    default:            return 'INFRASTRUCTURE';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE HOME PATH
// ─────────────────────────────────────────────────────────────────────────────

export function roleHomePath(
  role: DbRole,
  accountType: AccountType
): string {
  switch (role) {
    case 'TENANT':                  return '/tenant/dashboard';
    case 'INVESTOR':                return '/portfolio';
    case 'ADMIN':
    case 'FOUNDER':                 return '/admin/founder';
    case 'GOVERNMENT':
    case 'VERIFIER':                return '/admin';
    case 'CONTRACTOR':
    case 'SUPPLIER':
    case 'BANK':                    return '/dashboard';
    case 'DEVELOPER':
    case 'PROJECT_SPONSOR':
      if (accountType === 'LANDLORD') return '/landlord/tenants';
      return '/projects/my';
    default:                        return '/dashboard';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Build typed user from raw backend user ────────────────────────────────
  const buildUser = useCallback(
    (backendUser: any, storedAccountType?: string | null): AuthUser => {
      const accountType = deriveAccountType(backendUser.role, storedAccountType);
      return { ...backendUser, accountType };
    },
    []
  );

  // ── Persist to localStorage + cookies ────────────────────────────────────
  // FIX: ark_token cookie is now written here so middleware's !token check
  //      never falsely fires after a successful login.
  const persist = useCallback((jwt: string, u: AuthUser) => {
    localStorage.setItem('ark_token',       jwt);
    localStorage.setItem('token',           jwt);
    localStorage.setItem('ark_account_type', u.accountType);

    setCookie('ark_token',       jwt);          // ← THE FIX: middleware reads this
    setCookie('ark_role',        u.role);
    setCookie('ark_account_type', u.accountType);

    setToken(jwt);
    setUser(u);
  }, []);

  // ── Clear all auth state ──────────────────────────────────────────────────
  const clearAuth = useCallback(() => {
    localStorage.removeItem('ark_token');
    localStorage.removeItem('token');
    localStorage.removeItem('ark_account_type');

    deleteCookie('ark_token');
    deleteCookie('ark_role');
    deleteCookie('ark_account_type');

    setToken(null);
    setUser(null);
  }, []);

  // ── Hydrate from storage on mount ─────────────────────────────────────────
  const hydrateFromStorage = useCallback(async () => {
    const stored =
      localStorage.getItem('ark_token') ||
      localStorage.getItem('token');

    const storedAT = localStorage.getItem('ark_account_type');

    if (!stored) {
      setLoading(false);
      return;
    }

    setToken(stored);

    try {
      const res = await api.get('/api/auth/me');
      const u   = buildUser(res.data.user ?? res.data, storedAT);
      setUser(u);
      // Re-sync cookies in case they expired (e.g. after browser restart)
      setCookie('ark_token',       stored);
      setCookie('ark_role',        u.role);
      setCookie('ark_account_type', u.accountType);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [buildUser, clearAuth]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  // ── Login ─────────────────────────────────────────────────────────────────
  // FIX: window.location.href (hard navigation) ensures the browser sends the
  //      freshly written cookies on the very first request to the new route,
  //      eliminating the middleware race condition that caused the login loop.
  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });

    const jwt =
      res.data.tokens?.access_token ??
      res.data.token;

    const storedAT = localStorage.getItem('ark_account_type');
    const u        = buildUser(res.data.user, storedAT);

    persist(jwt, u);

    // Hard navigation: cookies are guaranteed committed before the new page loads
    window.location.href = roleHomePath(u.role, u.accountType);
  };

  // ── Google Sign-In ────────────────────────────────────────────────────────
  // Does not redirect itself — the caller (Google button component / login
  // page) decides where to go based on needsRoleSelection, since every
  // Google sign-in must pass through role confirmation per product decision.
  const loginWithGoogle = async (credential: string) => {
    const res = await api.post('/api/auth/google', { credential });

    const jwt =
      res.data.tokens?.access_token ??
      res.data.token;

    const storedAT = localStorage.getItem('ark_account_type');
    const u        = buildUser(res.data.user, storedAT);

    persist(jwt, u);

    return { needsRoleSelection: !!res.data.needs_role_selection };
  };

  // ── Role confirmation (shown after every Google sign-in) ─────────────────
  const setRole = async (role: DbRole) => {
    const res = await api.post('/api/auth/set-role', { role });

    const jwt =
      res.data.tokens?.access_token ??
      res.data.token;

    const storedAT = localStorage.getItem('ark_account_type');
    const u        = buildUser(res.data.user, storedAT);

    persist(jwt, u);

    window.location.href = roleHomePath(u.role, u.accountType);
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const register = async (data: RegisterData) => {
    const { accountType, ...backendData } = data;

    if (accountType) {
      localStorage.setItem('ark_account_type', accountType);
    }

    const res = await api.post('/api/auth/register', backendData);

    const jwt =
      res.data.tokens?.access_token ??
      res.data.token;

    const enforcedAccountType =
      backendData.role === 'TENANT' ? 'TENANT' : (accountType ?? null);

    const u = buildUser(res.data.user, enforcedAccountType);

    persist(jwt, u);

    // Tenant invite flow handles its own redirect
    if (backendData.role !== 'TENANT') {
      window.location.href = roleHomePath(u.role, u.accountType);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    clearAuth();
    router.push('/login');
  };

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refresh = async () => {
    try {
      const res    = await api.get('/api/auth/me');
      const storedAT = localStorage.getItem('ark_account_type');
      const u      = buildUser(res.data.user ?? res.data, storedAT);
      setUser(u);
      setCookie('ark_role',        u.role);
      setCookie('ark_account_type', u.accountType);
    } catch {
      logout();
    }
  };

  // ── setAccountType ────────────────────────────────────────────────────────
  const setAccountType = (type: AccountType) => {
    if (!user) return;
    const updated = { ...user, accountType: type };
    localStorage.setItem('ark_account_type', type);
    setCookie('ark_account_type', type);
    setUser(updated);
  };

  const isLandlord    = user?.accountType === 'LANDLORD';
  const isInfraBuilder =
    user?.accountType === 'INFRASTRUCTURE' ||
    user?.accountType === 'DIASPORA';

  return (
    <AuthContext.Provider
      value={{
        user, token, loading,
        isLandlord, isInfraBuilder,
        login, loginWithGoogle, setRole, register, logout, refresh, setAccountType,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
