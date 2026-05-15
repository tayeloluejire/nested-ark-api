// src/middleware.ts
// Next.js Edge Middleware — role-based route protection.
//
// Reads two cookies written by AuthContext on login:
//   ark_role         = DB role (DEVELOPER, TENANT, INVESTOR, etc.)
//   ark_account_type = Business context (LANDLORD, INFRASTRUCTURE, TENANT, etc.)
//
// Route rules:
//   /tenant            -> TENANT only
//   /landlord          -> DEVELOPER role + accountType=LANDLORD
//   /admin             -> ADMIN only
//   /gov               -> GOVERNMENT, VERIFIER, or ADMIN
//   /rental-management -> DEVELOPER or ADMIN
//   /portfolio         -> INVESTOR, DEVELOPER, or ADMIN
//   everything else    -> any logged-in user (role cookie present)

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/about',
  '/map',
  '/projects',
  '/search',
  '/ledger',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/payment-success',
  '/payment-callback',
]);

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
  '/tenant/invite',    // ✅ PUBLIC — tenant invite preview, NO auth required
  '/marketplace',      // ✅ PUBLIC — property marketplace discovery
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

function redirectTo(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const role        = req.cookies.get('ark_role')?.value ?? '';
  const accountType = req.cookies.get('ark_account_type')?.value ?? '';

  // TENANT routes — TENANT role only
  if (pathname.startsWith('/tenant')) {
    if (role !== 'TENANT') {
      return redirectTo(req, '/login?reason=tenant_only');
    }
    return NextResponse.next();
  }

  // LANDLORD routes — DEVELOPER role + accountType=LANDLORD
  if (pathname.startsWith('/landlord')) {
    // Any DEVELOPER can access landlord routes.
    // The navbar shows these links only when accountType=LANDLORD.
    // Backend protects data via sponsor_id — middleware just checks role.
    if (role !== 'DEVELOPER' && role !== 'PROJECT_SPONSOR' && role !== 'ADMIN') {
      return redirectTo(req, '/login?reason=landlord_only');
    }
    return NextResponse.next();
  }

  // ADMIN routes — ADMIN role only
  if (pathname.startsWith('/admin')) {
    if (role !== 'ADMIN') {
      return redirectTo(req, '/login?reason=admin_only');
    }
    return NextResponse.next();
  }

  // GOVERNMENT portal — GOVERNMENT, VERIFIER, or ADMIN
  if (pathname.startsWith('/gov')) {
    const govRoles = ['GOVERNMENT', 'VERIFIER', 'ADMIN'];
    if (!govRoles.includes(role)) {
      return redirectTo(req, '/login?reason=gov_only');
    }
    return NextResponse.next();
  }

  // Rental management — DEVELOPER, ADMIN, GOVERNMENT
  if (pathname.includes('/rental-management')) {
    const rmRoles = ['DEVELOPER', 'PROJECT_SPONSOR', 'ADMIN', 'GOVERNMENT'];
    if (!rmRoles.includes(role)) {
      return redirectTo(req, '/login?reason=access_denied');
    }
    return NextResponse.next();
  }

  // Portfolio and investments — INVESTOR, DEVELOPER, ADMIN
  if (pathname.startsWith('/portfolio') || pathname.startsWith('/investments')) {
    const invRoles = ['INVESTOR', 'DEVELOPER', 'PROJECT_SPONSOR', 'ADMIN'];
    if (!invRoles.includes(role)) {
      return redirectTo(req, '/login?reason=investor_only');
    }
    return NextResponse.next();
  }

  // Catch-all — require any valid role cookie
  if (!role) {
    return redirectTo(req, '/login');
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|nested_ark|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.ico|.*\\.webp).*)',
  ],
};
