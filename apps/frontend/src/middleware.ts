// src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Public exact routes
// ─────────────────────────────────────────────────────────────

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/about',
  '/faq',
  '/map',
  '/projects',
  '/search',
  '/ledger',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/payment-success',
  '/payment-callback',
  '/marketplace',
  '/founder/login',
  '/admin/founder',
]);

// ─────────────────────────────────────────────────────────────
// Public prefixes
// ─────────────────────────────────────────────────────────────

const PUBLIC_PREFIXES = [
  '/_next/',
  '/api/',
  '/favicon',
  '/nested_ark',
  '/projects/',
  '/onboard',
  '/tenant/invite',
  '/marketplace',
  '/faq',
  '/founder',
  '/admin/founder',
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function isPublic(pathname: string): boolean {
  const path = normalizePath(pathname);

  if (PUBLIC_PATHS.has(path)) {
    return true;
  }

  return PUBLIC_PREFIXES.some(prefix =>
    path.startsWith(prefix)
  );
}

function hasStaticExtension(pathname: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
  const rawPath = req.nextUrl.pathname;
  const pathname = normalizePath(rawPath);

  // ─────────────────────────────────────────────────────────
  // Skip static/internal assets
  // ─────────────────────────────────────────────────────────

  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/static/') ||
    hasStaticExtension(pathname)
  ) {
    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────
  // Public routes
  // ─────────────────────────────────────────────────────────

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────
  // Prevent _rsc auth collisions
  // ─────────────────────────────────────────────────────────

  if (req.nextUrl.searchParams.has('_rsc')) {
    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────
  // Read auth state
  // ─────────────────────────────────────────────────────────

  const role =
    req.cookies.get('ark_role')?.value ?? '';

  const token =
    req.cookies.get('ark_token')?.value ?? '';

  // ─────────────────────────────────────────────────────────
  // Redirect helper
  // ─────────────────────────────────────────────────────────

  const redirectToLogin = (reason: string) => {
    const url = req.nextUrl.clone();

    url.pathname = '/login';
    url.search = `?reason=${reason}`;

    return NextResponse.redirect(url);
  };

  // ─────────────────────────────────────────────────────────
  // Auth existence check
  // ─────────────────────────────────────────────────────────

  if (!token || !role) {
    return redirectToLogin('auth_required');
  }

  // ─────────────────────────────────────────────────────────
  // TENANT routes
  // ─────────────────────────────────────────────────────────

  if (pathname.startsWith('/tenant')) {
    if (role !== 'TENANT') {
      return redirectToLogin('tenant_only');
    }

    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────
  // LANDLORD routes
  // ─────────────────────────────────────────────────────────

  if (pathname.startsWith('/landlord')) {
    const allowed = [
      'DEVELOPER',
      'PROJECT_SPONSOR',
      'ADMIN',
    ];

    if (!allowed.includes(role)) {
      return redirectToLogin('landlord_only');
    }

    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────
  // ADMIN routes
  // ─────────────────────────────────────────────────────────

  if (pathname.startsWith('/admin')) {

    // Founder Command Center — auth handled client-side on the page itself
    if (pathname.startsWith('/admin/founder')) {
      return NextResponse.next();
    }

    // All other /admin/* — ADMIN only (unchanged)
    if (role !== 'ADMIN') {
      return redirectToLogin('admin_only');
    }

    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────
  // GOVERNMENT routes
  // ─────────────────────────────────────────────────────────

  if (pathname.startsWith('/gov')) {
    const allowed = [
      'GOVERNMENT',
      'VERIFIER',
      'ADMIN',
    ];

    if (!allowed.includes(role)) {
      return redirectToLogin('gov_only');
    }

    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────
  // Rental management
  // ─────────────────────────────────────────────────────────

  if (pathname.includes('/rental-management')) {
    const allowed = [
      'DEVELOPER',
      'PROJECT_SPONSOR',
      'ADMIN',
      'GOVERNMENT',
    ];

    if (!allowed.includes(role)) {
      return redirectToLogin('access_denied');
    }

    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────
  // Portfolio / investments
  // ─────────────────────────────────────────────────────────

  if (
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/investments')
  ) {
    const allowed = [
      'INVESTOR',
      'DEVELOPER',
      'PROJECT_SPONSOR',
      'ADMIN',
    ];

    if (!allowed.includes(role)) {
      return redirectToLogin('investor_only');
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

// ─────────────────────────────────────────────────────────────
// Matcher
// ─────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};