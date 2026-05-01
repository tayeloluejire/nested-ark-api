/**
 * lib/auth.ts
 *
 * Central auth helpers used by AuthContext, middleware, and any page that
 * needs to check the current user's role without going to the server.
 *
 * Token is stored in:
 *   - localStorage  (key: "ark_token")   — for API calls via api.ts
 *   - document.cookie (key: "ark_token") — for middleware edge reads
 *
 * Both are written on login and cleared on logout.
 */

export interface ArkUser {
  id:        string;
  email:     string;
  role:      string;
  full_name: string;
}

const TOKEN_KEY = 'ark_token';

// ── Token storage ─────────────────────────────────────────────────────────────

export function saveToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  // Also write as a non-HttpOnly cookie so middleware can read it at the edge.
  // SameSite=Lax prevents CSRF; Secure is set in production via HTTPS.
  const maxAge = 60 * 60 * 24; // 24 h — matches JWT_EXPIRY on backend
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) ?? null;
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  // Expire the cookie immediately
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

// ── JWT decode (no-verify, role reading) ─────────────────────────────────────

export function decodeToken(token: string): ArkUser | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );
    if (json.exp && json.exp * 1000 < Date.now()) return null;
    return {
      id:        json.id        ?? json.sub ?? '',
      email:     json.email     ?? '',
      role:      json.role      ?? '',
      full_name: json.full_name ?? json.name ?? json.email ?? '',
    };
  } catch {
    return null;
  }
}

export function getCurrentUser(): ArkUser | null {
  const token = getToken();
  return token ? decodeToken(token) : null;
}

// ── Role guards (use in page-level checks as a secondary UI layer) ────────────

export const ROLE = {
  TENANT:          'TENANT',
  LANDLORD:        'LANDLORD',
  DEVELOPER:       'DEVELOPER',
  PROJECT_SPONSOR: 'PROJECT_SPONSOR',
  ADMIN:           'ADMIN',
  SUPER_ADMIN:     'SUPER_ADMIN',
} as const;

export type Role = typeof ROLE[keyof typeof ROLE];

export function isLandlordRole(role: string): boolean {
  return ['LANDLORD', 'DEVELOPER', 'ADMIN', 'SUPER_ADMIN', 'PROJECT_SPONSOR'].includes(role);
}

export function isTenantRole(role: string): boolean {
  return role === 'TENANT';
}

export function isAdminRole(role: string): boolean {
  return ['ADMIN', 'SUPER_ADMIN'].includes(role);
}

/** Returns the correct post-login redirect path for a given role. */
export function dashboardFor(role: string): string {
  if (isTenantRole(role))  return '/tenant/dashboard';
  if (isAdminRole(role))   return '/admin/dashboard';
  return '/dashboard'; // landlord / developer / sponsor
}
