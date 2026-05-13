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

  document.cookie =
    `${name}=${encodeURIComponent(value)}; ` +
    `expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;

  document.cookie =
    `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT TYPE DERIVATION (FIX 1 APPLIED)
// ─────────────────────────────────────────────────────────────────────────────

function deriveAccountType(
  role: DbRole,
  storedType?: string | null
): AccountType {
  // HARD LOCK FOR TENANTS
  // Prevents accidental landlord/developer hydration
  if (role === 'TENANT') {
    return 'TENANT';
  }

  // Respect previously selected compatible type
  if (storedType) {
    const compatible: Record<string, DbRole[]> = {
      LANDLORD: ['DEVELOPER', 'PROJECT_SPONSOR'],
      INFRASTRUCTURE: ['DEVELOPER', 'PROJECT_SPONSOR'],
      DIASPORA: ['DEVELOPER', 'PROJECT_SPONSOR', 'INVESTOR'],
      INVESTOR: ['INVESTOR'],
      CONTRACTOR: ['CONTRACTOR'],
      SUPPLIER: ['SUPPLIER'],
      BANK: ['BANK'],
      GOVERNMENT: ['GOVERNMENT', 'VERIFIER'],
      TENANT: ['TENANT'],
      ADMIN: ['ADMIN'],
    };

    if (compatible[storedType]?.includes(role)) {
      return storedType as AccountType;
    }
  }

  switch (role) {
    case 'INVESTOR':
      return 'INVESTOR';

    case 'CONTRACTOR':
      return 'CONTRACTOR';

    case 'SUPPLIER':
      return 'SUPPLIER';

    case 'BANK':
      return 'BANK';

    case 'GOVERNMENT':
    case 'VERIFIER':
      return 'GOVERNMENT';

    case 'ADMIN':
      return 'ADMIN';

    case 'DEVELOPER':
    case 'PROJECT_SPONSOR':
      // IMPORTANT:
      // Preserve LANDLORD if already chosen
      if (storedType === 'LANDLORD') {
        return 'LANDLORD';
      }

      if (storedType === 'DIASPORA') {
        return 'DIASPORA';
      }

      return 'INFRASTRUCTURE';

    default:
      return 'INFRASTRUCTURE';
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
    case 'TENANT':
      return '/tenant/dashboard';

    case 'INVESTOR':
      return '/portfolio';

    case 'ADMIN':
      return '/admin';

    case 'GOVERNMENT':
    case 'VERIFIER':
      return '/admin';

    case 'CONTRACTOR':
    case 'SUPPLIER':
    case 'BANK':
      return '/dashboard';

    case 'DEVELOPER':
    case 'PROJECT_SPONSOR':
      switch (accountType) {
        case 'LANDLORD':
          return '/landlord/tenants';

        case 'DIASPORA':
        case 'INFRASTRUCTURE':
        default:
          return '/projects/my';
      }

    default:
      return '/dashboard';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);

  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // ───────────────────────────────────────────────────────────────────────────

  const buildUser = useCallback(
    (backendUser: any, storedAccountType?: string | null): AuthUser => {
      const accountType = deriveAccountType(
        backendUser.role,
        storedAccountType
      );

      return {
        ...backendUser,
        accountType,
      };
    },
    []
  );

  // ───────────────────────────────────────────────────────────────────────────

  const persist = useCallback((jwt: string, u: AuthUser) => {
    localStorage.setItem('ark_token', jwt);
    localStorage.setItem('token', jwt);
    localStorage.setItem('ark_account_type', u.accountType);

    setCookie('ark_role', u.role);
    setCookie('ark_account_type', u.accountType);

    setToken(jwt);
    setUser(u);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────

  const clearAuth = useCallback(() => {
    localStorage.removeItem('ark_token');
    localStorage.removeItem('token');
    localStorage.removeItem('ark_account_type');

    deleteCookie('ark_role');
    deleteCookie('ark_account_type');

    setToken(null);
    setUser(null);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────

  const hydrateFromStorage = useCallback(async () => {
    const stored =
      localStorage.getItem('ark_token') ||
      localStorage.getItem('token');

    const storedAT =
      localStorage.getItem('ark_account_type');

    if (!stored) {
      setLoading(false);
      return;
    }

    setToken(stored);

    try {
      const res = await api.get('/api/auth/me');

      const u = buildUser(
        res.data.user ?? res.data,
        storedAT
      );

      setUser(u);

      setCookie('ark_role', u.role);
      setCookie('ark_account_type', u.accountType);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [buildUser, clearAuth]);

  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  // ───────────────────────────────────────────────────────────────────────────

  const login = async (
    email: string,
    password: string
  ) => {
    const res = await api.post('/api/auth/login', {
      email,
      password,
    });

    const jwt =
      res.data.tokens?.access_token ??
      res.data.token;

    const storedAT =
      localStorage.getItem('ark_account_type');

    const u = buildUser(
      res.data.user,
      storedAT
    );

    persist(jwt, u);

    router.push(
      roleHomePath(u.role, u.accountType)
    );
  };

  // ───────────────────────────────────────────────────────────────────────────

  const register = async (
    data: RegisterData
  ) => {
    const {
      accountType,
      ...backendData
    } = data;

    // Persist intended account type BEFORE auth hydration
    if (accountType) {
      localStorage.setItem(
        'ark_account_type',
        accountType
      );
    }

    const res = await api.post(
      '/api/auth/register',
      backendData
    );

    const jwt =
      res.data.tokens?.access_token ??
      res.data.token;

    // HARD ENFORCE TENANT ACCOUNT TYPE (FIX 2 APPLIED)
    const enforcedAccountType =
      backendData.role === 'TENANT'
        ? 'TENANT'
        : (accountType ?? null);

    const u = buildUser(
      res.data.user,
      enforcedAccountType
    );

    persist(jwt, u);

    // IMPORTANT:
    // Prevent redirect race condition.
    // Tenant invite flow handles redirect itself.
    if (backendData.role !== 'TENANT') {
      router.push(
        roleHomePath(
          u.role,
          u.accountType
        )
      );
    }
  };

  // ───────────────────────────────────────────────────────────────────────────

  const logout = () => {
    clearAuth();
    router.push('/login');
  };

  // ───────────────────────────────────────────────────────────────────────────

  const refresh = async () => {
    try {
      const res = await api.get('/api/auth/me');

      const storedAT =
        localStorage.getItem('ark_account_type');

      const u = buildUser(
        res.data.user ?? res.data,
        storedAT
      );

      setUser(u);

      setCookie('ark_role', u.role);
      setCookie('ark_account_type', u.accountType);
    } catch {
      logout();
    }
  };

  // ───────────────────────────────────────────────────────────────────────────

  const setAccountType = (
    type: AccountType
  ) => {
    if (!user) return;

    const updated = {
      ...user,
      accountType: type,
    };

    localStorage.setItem(
      'ark_account_type',
      type
    );

    setCookie(
      'ark_account_type',
      type
    );

    setUser(updated);
  };

  // ───────────────────────────────────────────────────────────────────────────

  const isLandlord =
    user?.accountType === 'LANDLORD';

  const isInfraBuilder =
    user?.accountType === 'INFRASTRUCTURE' ||
    user?.accountType === 'DIASPORA';

  // ───────────────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,

        isLandlord,
        isInfraBuilder,

        login,
        register,
        logout,
        refresh,
        setAccountType,
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

  if (!ctx) {
    throw new Error(
      'useAuth must be used inside <AuthProvider>'
    );
  }

  return ctx;
}