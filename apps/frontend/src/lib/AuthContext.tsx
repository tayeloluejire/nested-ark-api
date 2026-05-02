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
 *   Why: Backend has no account_type column. Adding it requires a migration.
 *   This pattern lets the frontend apply business logic today, with a clear
 *   upgrade path when the backend adds account_type to the users table.
 *
 *   DEVELOPER with accountType=LANDLORD → can reach /landlord/* routes
 *   DEVELOPER with accountType=DEVELOPER → infrastructure/project builder
 *   DEVELOPER with no accountType → defaults to project builder
 *
 *   The user self-declares accountType on register (UI only, no DB write).
 *   On login, we restore it from localStorage (persisted across sessions).
 *
 * MULTI-ROLE DESIGN NOTE:
 *   True multi-role (same user is investor on project A, landlord on project B)
 *   requires backend support (user_project_roles table). This version stores
 *   a primary accountType. Per-project role context is handled at page level
 *   by checking project.sponsor_id === user.id for landlord actions.
 *
 * MIDDLEWARE COOKIE:
 *   Writes `ark_role` cookie = DB role (DEVELOPER, TENANT, etc.)
 *   Writes `ark_account_type` cookie = business type (LANDLORD, DEVELOPER, etc.)
 *   Middleware reads BOTH to enforce routing correctly.
 */

import {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import api from './api';

// ── Exact DB role values (backend constraint) ─────────────────────────────────
export type DbRole =
  | 'INVESTOR'
  | 'CONTRACTOR'
  | 'GOVERNMENT'
  | 'ADMIN'
  | 'VERIFIER'
  | 'SUPPLIER'
  | 'BANK'
  | 'DEVELOPER'
  | 'TENANT'
  | 'PROJECT_SPONSOR'; // backend default, maps to DEVELOPER for routing

// ── Business account types (frontend-only, not in DB) ────────────────────────
export type AccountType =
  | 'LANDLORD'        // DEVELOPER who owns rental properties
  | 'INFRASTRUCTURE'  // DEVELOPER building roads/bridges/energy projects
  | 'DIASPORA'        // DEVELOPER investing from abroad (owner_type=CORPORATE/INDIVIDUAL)
  | 'GOVERNMENT'      // GOVERNMENT role user
  | 'INVESTOR'        // INVESTOR role
  | 'CONTRACTOR'      // CONTRACTOR role
  | 'SUPPLIER'        // SUPPLIER role
  | 'BANK'            // BANK role
  | 'TENANT'          // TENANT role
  | 'ADMIN';          // ADMIN role

export interface AuthUser {
  id:           string;
  email:        string;
  full_name:    string;
  role:         DbRole;          // from DB — the auth truth
  accountType:  AccountType;     // derived business context — frontend only
  phone?:       string;
  kyc_status?:  string;
  avatar_url?:  string;
  tenancy_id?:  string;
}

interface AuthContextValue {
  user:           AuthUser | null;
  token:          string | null;
  loading:        boolean;
  isLandlord:     boolean;  // DEVELOPER with accountType=LANDLORD
  isInfraBuilder: boolean;  // DEVELOPER with accountType=INFRASTRUCTURE
  login:          (email: string, password: string) => Promise<void>;
  register:       (data: RegisterData) => Promise<void>;
  logout:         () => void;
  refresh:        () => Promise<void>;
  setAccountType: (type: AccountType) => void;
}

export interface RegisterData {
  email:        string;
  password:     string;
  full_name:    string;
  phone?:       string;
  role?:        DbRole;
  accountType?: AccountType; // UI-only, not sent to backend
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Cookie helpers (no external dep) ─────────────────────────────────────────
function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}
function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

/**
 * Derive AccountType from DB role.
 * Falls back to localStorage-persisted value if set (user chose on register).
 * This is the single source of truth for business context.
 */
function deriveAccountType(role: DbRole, storedType?: string | null): AccountType {
  // If user explicitly set an account type (from register page), honour it
  // but only if it's compatible with their DB role
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
  // Default derivation from DB role
  switch (role) {
    case 'TENANT':          return 'TENANT';
    case 'INVESTOR':        return 'INVESTOR';
    case 'CONTRACTOR':      return 'CONTRACTOR';
    case 'SUPPLIER':        return 'SUPPLIER';
    case 'BANK':            return 'BANK';
    case 'GOVERNMENT':      return 'GOVERNMENT';
    case 'VERIFIER':        return 'GOVERNMENT';
    case 'ADMIN':           return 'ADMIN';
    case 'DEVELOPER':
    case 'PROJECT_SPONSOR':
    default:                return 'INFRASTRUCTURE'; // safe default for DEVELOPER
  }
}

/**
 * roleHomePath — where each user lands after login.
 * Uses BOTH role and accountType for routing.
 */
export function roleHomePath(role: DbRole, accountType: AccountType): string {
  switch (role) {
    case 'TENANT':          return '/tenant/dashboard';
    case 'INVESTOR':        return '/portfolio';
    case 'ADMIN':           return '/admin';
    case 'GOVERNMENT':
    case 'VERIFIER':        return '/admin';
    case 'CONTRACTOR':      return '/dashboard';
    case 'SUPPLIER':        return '/dashboard';
    case 'BANK':            return '/dashboard';
    case 'DEVELOPER':
    case 'PROJECT_SPONSOR':
      // DEVELOPER routing depends on accountType
      switch (accountType) {
        case 'LANDLORD':       return '/landlord/tenants';
        case 'DIASPORA':       return '/projects/my';
        case 'INFRASTRUCTURE': return '/projects/my';
        default:               return '/projects/my';
      }
    default:                return '/dashboard';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router  = useRouter();
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Build full AuthUser from backend user + stored accountType ────────────
  const buildUser = useCallback((backendUser: any, storedAccountType?: string | null): AuthUser => {
    const accountType = deriveAccountType(backendUser.role, storedAccountType);
    return { ...backendUser, accountType };
  }, []);

  // ── Persist to cookies + localStorage ────────────────────────────────────
  const persist = useCallback((jwt: string, u: AuthUser) => {
    localStorage.setItem('ark_token', jwt);
    localStorage.setItem('token', jwt);                              // legacy key
    localStorage.setItem('ark_account_type', u.accountType);
    setCookie('ark_role', u.role);
    setCookie('ark_account_type', u.accountType);
    setToken(jwt);
    setUser(u);
  }, []);

  // ── Clear everything on logout ────────────────────────────────────────────
  const clearAuth = useCallback(() => {
    localStorage.removeItem('ark_token');
    localStorage.removeItem('token');
    localStorage.removeItem('ark_account_type');
    deleteCookie('ark_role');
    deleteCookie('ark_account_type');
    setToken(null);
    setUser(null);
  }, []);

  // ── Hydrate from localStorage on page load ────────────────────────────────
  const hydrateFromStorage = useCallback(async () => {
    const stored    = localStorage.getItem('ark_token') || localStorage.getItem('token');
    const storedAT  = localStorage.getItem('ark_account_type');
    if (!stored) { setLoading(false); return; }
    setToken(stored);
    try {
      const res = await api.get('/api/auth/me');
      const u   = buildUser(res.data.user ?? res.data, storedAT);
      setUser(u);
      setCookie('ark_role', u.role);
      setCookie('ark_account_type', u.accountType);
    } catch {
      clearAuth();
    } finally { setLoading(false); }
  }, [buildUser, clearAuth]);

  useEffect(() => { hydrateFromStorage(); }, [hydrateFromStorage]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const res  = await api.post('/api/auth/login', { email, password });
    // Login response: { user: {id,email,full_name,role}, tokens: {access_token} }
    const jwt  = res.data.tokens?.access_token ?? res.data.token;
    const storedAT = localStorage.getItem('ark_account_type'); // may have been set on register
    const u    = buildUser(res.data.user, storedAT);
    persist(jwt, u);
    router.push(roleHomePath(u.role, u.accountType));
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const register = async (data: RegisterData) => {
    const { accountType, ...backendData } = data;
    // Store accountType BEFORE the API call so buildUser can pick it up
    if (accountType) {
      localStorage.setItem('ark_account_type', accountType);
    }
    // Backend receives: { email, password, full_name, phone, role }
    // Role is the DB role (DEVELOPER, INVESTOR, etc.)
    const res  = await api.post('/api/auth/register', backendData);
    const jwt  = res.data.tokens?.access_token ?? res.data.token;
    const u    = buildUser(res.data.user, accountType ?? null);
    persist(jwt, u);
    router.push(roleHomePath(u.role, u.accountType));
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    clearAuth();
    router.push('/login');
  };

  // ── Refresh from /api/auth/me ─────────────────────────────────────────────
  const refresh = async () => {
    try {
      const res  = await api.get('/api/auth/me');
      const storedAT = localStorage.getItem('ark_account_type');
      const u    = buildUser(res.data.user ?? res.data, storedAT);
      setUser(u);
      setCookie('ark_role', u.role);
      setCookie('ark_account_type', u.accountType);
    } catch { logout(); }
  };

  // ── Allow runtime accountType change (e.g., switching context) ────────────
  const setAccountType = (type: AccountType) => {
    if (!user) return;
    const updated = { ...user, accountType: type };
    localStorage.setItem('ark_account_type', type);
    setCookie('ark_account_type', type);
    setUser(updated);
  };

  // ── Convenience booleans ──────────────────────────────────────────────────
  const isLandlord     = user?.accountType === 'LANDLORD';
  const isInfraBuilder = user?.accountType === 'INFRASTRUCTURE' || user?.accountType === 'DIASPORA';

  return (
    <AuthContext.Provider value={{
      user, token, loading, isLandlord, isInfraBuilder,
      login, register, logout, refresh, setAccountType,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
