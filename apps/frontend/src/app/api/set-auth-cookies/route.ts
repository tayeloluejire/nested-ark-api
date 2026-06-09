// apps/frontend/src/app/api/set-auth-cookies/route.ts
//
// Called by founder/login (and optionally any login page) immediately
// after a successful auth to write HttpOnly-style cookies that the
// Next.js middleware can read on the very next navigation request.
//
// POST /api/set-auth-cookies
// Body: { token: string, role: string }

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { token, role } = await req.json();

    if (!token || !role) {
      return NextResponse.json(
        { error: 'token and role are required' },
        { status: 400 }
      );
    }

    const res = NextResponse.json({ ok: true });

    // SameSite=Lax so cookies are sent on same-origin navigations
    // Not HttpOnly so client JS can still read them for API calls
    res.cookies.set('ark_token', token, {
      path:     '/',
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   60 * 60 * 24, // 24 hours
    });

    res.cookies.set('ark_role', role.toUpperCase(), {
      path:     '/',
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   60 * 60 * 24,
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
