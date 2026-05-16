// src/middleware.ts
// Next.js Edge Middleware — role-based route protection.
// Fixes: infinite /login ↔ /login/ redirect loop caused by trailing slash
// mismatch and _rsc prefetch requests hitting the auth gate.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Exact paths that bypass ALL auth checks ───────────────────────────────
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/login/',
  '/register',
  '/register/',
  '/about',
  '/map',
  '/projects',
  '/search',
  '/ledger',
  '/forgot-password',
  '/forgot-password/',
  '/reset-password',
  '/reset-password/',
  '/verify-email',
  '/verify-email/',
  '/payment-success',
  '/payment-callback',
  '/marketplace',
  '/marketplace/',
]);

// ── Path prefixes that bypass ALL auth checks ─────────────────────────────
const PUBLIC_PREFIXES = [
  '/projects/',
  '/onboard/',
  '/onboard',
  '/_next/',
  '/api/',
  '/favicon',
  '/nested_ark',
  '/reset-password/',
  '/verify-email/',
  '/tenant/invite',    // public — tenant invite preview
  '/marketplace',      // public — property discovery
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // ── 1. Static assets / Next.js internals — always pass ────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/static/') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.json')
  ) {
    return NextResponse.next();
  }

  // ── 2. Exact public paths (including trailing-slash variants) ──────────
  if (isPublic(pathname)) return NextResponse.next();

  // ── 3. _rsc prefetch safety valve ─────────────────────────────────────
  // Next.js App Router sends _rsc=... for client-side navigation prefetches.
  // If the target is already an auth page, pass it through — never redirect.
  if (searchParams.has('_rsc')) {
    const isAuthPage = pathname === '/login' || pathname === '/login/'
                    || pathname === '/register' || pathname === '/register/';
    if (isAuthPage) return NextResponse.next();
  }

  // ── 4. Read auth cookies ───────────────────────────────────────────────
  const role        = req.cookies.get('ark_role')?.value ?? '';
  const accountType = req.cookies.get('ark_account_type')?.value ?? '';

  // Helper — redirect to /login with reason param (uses clone to avoid mutation)
  const toLogin = (reason: string) => {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search   = `?reason=${reason}`;
    return NextResponse.redirect(url);
  };

  // ── 5. TENANT routes ───────────────────────────────────────────────────
  if (pathname.startsWith('/tenant')) {
    if (role !== 'TENANT') return toLogin('tenant_only');
    return NextResponse.next();
  }

  // ── 6. LANDLORD routes ─────────────────────────────────────────────────
  if (pathname.startsWith('/landlord')) {
    const ok = ['DEVELOPER', 'PROJECT_SPONSOR', 'ADMIN'].includes(role);
    if (!ok) return toLogin('landlord_only');
    return NextResponse.next();
  }

  // ── 7. ADMIN routes ────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (role !== 'ADMIN') return toLogin('admin_only');
    return NextResponse.next();
  }

  // ── 8. GOVERNMENT portal ───────────────────────────────────────────────
  if (pathname.startsWith('/gov')) {
    if (!['GOVERNMENT', 'VERIFIER', 'ADMIN'].includes(role)) return toLogin('gov_only');
    return NextResponse.next();
  }

  // ── 9. Rental management ───────────────────────────────────────────────
  if (pathname.includes('/rental-management')) {
    if (!['DEVELOPER', 'PROJECT_SPONSOR', 'ADMIN', 'GOVERNMENT'].includes(role)) {
      return toLogin('access_denied');
    }
    return NextResponse.next();
  }

  // ── 10. Portfolio / investments ────────────────────────────────────────
  if (pathname.startsWith('/portfolio') || pathname.startsWith('/investments')) {
    if (!['INVESTOR', 'DEVELOPER', 'PROJECT_SPONSOR', 'ADMIN'].includes(role)) {
      return toLogin('investor_only');
    }
    return NextResponse.next();
  }

  // ── 11. Catch-all: require any valid role cookie ───────────────────────
  if (!role) {
    // Already on an auth page? Never redirect again — breaks the loop.
    if (pathname === '/login' || pathname === '/login/'
     || pathname === '/register' || pathname === '/register/') {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search   = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *   - _next/static  (Next.js static chunks)
     *   - _next/image   (Next.js image optimisation)
     *   - favicon.ico
     *   - Any file with an extension (png, svg, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
