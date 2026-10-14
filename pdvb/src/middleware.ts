import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// First gate only. Every admin page/action ALSO calls requireRole() on the server.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();

  const token = req.cookies.get('pdvb_session')?.value;
  let ok = false;
  if (token && process.env.AUTH_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      ok = payload.role === 'ADMIN' || payload.role === 'STAFF';
    } catch { ok = false; }
  }
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL('/admin/login', req.url));
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
