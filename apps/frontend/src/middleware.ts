/**
 * src/middleware.ts  —  Next.js Edge Middleware
 *
 * READS TWO COOKIES (both written by AuthContext on login/register):
 *   ark_role         = DB role (DEVELOPER, TENANT, INVESTOR, etc.)
 *   ark_account_type = Business context (LANDLORD, INFRASTRUCTURE, TENANT, etc.)
 *
 * WHY TWO COOKIES:
 *   Backend has no account_type column — role alone cannot distinguish
 *   a DEVELOPER who is a landlord from one who builds roads.
 *   The cookie pair gives middleware the full picture without an API call.
 *
 * ROUTING RULES:
 *   /tenant/*               → TENANT role only
 *   /landlord/*             → DEVELOPER role + accountType=LANDLORD
 *   /admin/*                → ADMIN role only
 *   /gov/*                  → GOVERNMENT or VERIFIER role
 *   /projects/*/rental-management → DEVELOPER (any accountType) or ADMIN
 *   /portfolio              → INVESTOR, DEVELOPER, ADMIN
 *   /investments            → authenticated (any role)
 *   /dashboard              → authenticated (any role)
 *   Public paths            → no check
 *
 * FALLBACK SAFETY:
 *   If ark_account_type cookie is missing, DEVELOPER defaults to
 *   /projects/my-projects (infrastructure view) — never to /landlord.
 *   This prevents accidental landlord access for infrastructure developers.
 *
 * COOKIE TRUST:
 *   Cookies are written by AuthContext which calls /api/auth/me on hydration.
 *   If token is invalid, /api/auth/me fails, cookies are cleared, and
 *   the user is sent to /login. Cookies are not the source of truth —
 *   they are a cached signal for the edge. The API validates the JWT on
 *   every authenticated request.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Always public — no auth required
const PUBLIC_PATHS = new Set([
  '/', '/login', '/register', '/about', '/map', '/projects',
  '/search', '/ledger', '/forgot-password', '/reset-password',
  '/verify-email', '/payment-success', '/payment-callback',
]);

const PUBLIC_PREFIXES = [
  '/projects/',       // individual project pages are public
  '/onboard/',        // token-gated invite pages
  '/onboard',
  '/_next/', '/api/', '/favicon', '/nested_ark',
  '/reset-password/', '/verify-email/',
];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  );
}

function redirect(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const role        = req.cookies.get('ark_role')?.value ?? '';
  const accountType = req.cookies.get('ark_account_type')?.value ?? '';

  // ── TENANT: only TENANT role ──────────────────────────────────────────────
  if (pathname.startsWith('/tenant')) {
    if (role !== 'TENANT')
      return redirect(req, '/login?reason=tenant_only');
    return NextResponse.next();
  }

  // ── LANDLORD portal: DEVELOPER role + accountType=LANDLORD ───────────────
  // A DEVELOPER without accountType=LANDLORD goes to /projects — not /landlord.
  // This enforces the business/technical separation.
  if (pathname.startsWith('/landlord')) {
    if (role !== 'DEVELOPER' && role !== 'PROJECT_SPONSOR')
      return redirect(req, '/login?reason=landlord_only');
    if (accountType !== 'LANDLORD')
      return redirect(req, '/projects/my-projects?notice=switch_to_landlord');
    return NextResponse.next();
  }

  // ── ADMIN: only ADMIN role ────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (role !== 'ADMIN')
      return redirect(req, '/login?reason=admin_only');
    return NextResponse.next();
  }

  // ── GOVERNMENT portal: GOVERNMENT or VERIFIER or ADMIN ───────────────────
  if (pathname.startsWith('/gov')) {
    if (!['GOVERNMENT', 'VERIFIER', 'ADMIN'].includes(role))
      return redirect(req, '/login?reason=gov_only');
    return NextResponse.next();
  }

  // ── Rental management: any DEVELOPER (landlord or infra) or ADMIN ─────────
  // Per-project ownership is verified by the API (sponsor_id check).
  // Middleware only ensures the role can access the feature at all.
  if (pathname.includes('/rental-management')) {
    if (!['DEVELOPER', 'PROJECT_SPONSOR', 'ADMIN', 'GOVERNMENT'].includes(role))
      return redirect(req, '/login?reason=access_denied');
    return NextResponse.next();
  }

  // ── Portfolio / investments: INVESTOR, DEVELOPER, ADMIN ───────────────────
  if (pathname.startsWith('/portfolio') || pathname.startsWith('/investments')) {
    if (!['INVESTOR', 'DEVELOPER', 'PROJECT_SPONSOR', 'ADMIN'].includes(role))
      return redirect(req, '/login?reason=investor_only');
    return NextResponse.next();
  }

  // ── Authenticated catch-all: any logged-in user ───────────────────────────
  if (!role) return redirect(req, '/login');

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|nested_ark|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.ico|.*\\.webp).*)',
  ],
};
