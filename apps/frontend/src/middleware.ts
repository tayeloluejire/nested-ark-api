// src/middleware.ts
// Next.js Edge Middleware — role-based route protection.
// Fixes:
// 1. infinite /login ↔ /login/ redirect loop
// 2. _rsc prefetch auth collisions
// 3. public FAQ route incorrectly resolving to 404

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
  '/about/',
  '/faq',
  '/faq/',
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
  '/tenant/invite',
  '/marketplace',
  '/faq',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // ── 1. Static assets / Next.js internals ───────────────────────────────
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

  // ── 2. Public routes ───────────────────────────────────────────────────
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // ── 3. _rsc prefetch safety valve ──────────────────────────────────────
  if (searchParams.has('_rsc')) {
    const isAuthPage =
      pathname === '/login' ||
      pathname === '/login/' ||
      pathname === '/register' ||
      pathname === '/register/';

    if (isAuthPage) {
      return NextResponse.next();
    }
  }

  // ── 4. Read auth cookies ───────────────────────────────────────────────
  const role = req.cookies.get('ark_role')?.value ?? '';
  const accountType = req.cookies.get('ark_account_type')?.value ?? '';

  // ── Redirect helper ────────────────────────────────────────────────────
  const toLogin = (reason: string) => {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?reason=${reason}`;
    return NextResponse.redirect(url);
  };

  // ── 5. TENANT routes ───────────────────────────────────────────────────
  if (pathname.startsWith('/tenant')) {
    if (role !== 'TENANT') {
      return toLogin('tenant_only');
    }
    return NextResponse.next();
  }

  // ── 6. LANDLORD routes ─────────────────────────────────────────────────
  if (pathname.startsWith('/landlord')) {
    const ok = ['DEVELOPER', 'PROJECT_SPONSOR', 'ADMIN'].includes(role);

    if (!ok) {
      return toLogin('landlord_only');
    }

    return NextResponse.next();
  }

  // ── 7. ADMIN routes ────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (role !== 'ADMIN') {
      return toLogin('admin_only');
    }

    return NextResponse.next();
  }

  // ── 8. GOVERNMENT routes ───────────────────────────────────────────────
  if (pathname.startsWith('/gov')) {
    const ok = ['GOVERNMENT', 'VERIFIER', 'ADMIN'].includes(role);

    if (!ok) {
      return toLogin('gov_only');
    }

    return NextResponse.next();
  }

  // ── 9. Rental management ───────────────────────────────────────────────
  if (pathname.includes('/rental-management')) {
    const ok = [
      'DEVELOPER',
      'PROJECT_SPONSOR',
      'ADMIN',
      'GOVERNMENT',
    ].includes(role);

    if (!ok) {
      return toLogin('access_denied');
    }

    return NextResponse.next();
  }

  // ── 10. Portfolio / investments ───────────────────────────────────────
  if (
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/investments')
  ) {
    const ok = [
      'INVESTOR',
      'DEVELOPER',
      'PROJECT_SPONSOR',
      'ADMIN',
    ].includes(role);

    if (!ok) {
      return toLogin('investor_only');
    }

    return NextResponse.next();
  }

  // ── 11. Catch-all auth gate ────────────────────────────────────────────
  if (!role) {
    if (
      pathname === '/login' ||
      pathname === '/login/' ||
      pathname === '/register' ||
      pathname === '/register/'
    ) {
      return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};