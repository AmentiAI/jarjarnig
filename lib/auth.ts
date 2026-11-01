import { createHmac } from 'crypto';
import { cookies } from 'next/headers';

export const AUTH_COOKIE = 'jarvis_auth';

export function accessPin() {
  return process.env.JARVIS_ACCESS_PIN?.trim() || '';
}

function secret() {
  return process.env.JARVIS_SECRET || process.env.DATABASE_URL || 'jarvis-local-secret';
}

export function authToken() {
  return createHmac('sha256', secret()).update(`jarvis:${accessPin()}`).digest('hex');
}

export function pinRequired() {
  return accessPin().length > 0;
}

export async function isAuthorized() {
  if (!pinRequired()) return true;
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value === authToken();
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };
}
