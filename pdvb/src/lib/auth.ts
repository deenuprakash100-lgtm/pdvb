import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'pdvb_session';
export type SessionUser = { id: string; name: string; role: 'CUSTOMER' | 'STAFF' | 'ADMIN' };

const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set (32+ characters).');
  return new TextEncoder().encode(s);
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(key());
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { id: String(payload.sub), name: String(payload.name), role: payload.role as SessionUser['role'] };
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().delete(SESSION_COOKIE);
}

/** Use at the top of every admin page and server action. The middleware is only a first gate. */
export async function requireRole(roles: SessionUser['role'][]): Promise<SessionUser> {
  const s = await getSession();
  if (!s || !roles.includes(s.role)) redirect('/admin/login');
  return s;
}
