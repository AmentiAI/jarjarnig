import { NextResponse } from 'next/server';
import { accessPin, AUTH_COOKIE, authToken, cookieOptions, pinRequired } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!pinRequired()) {
    return NextResponse.json({ ok: true, unlocked: true });
  }

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  const pin = body?.pin?.trim() ?? '';

  if (pin !== accessPin()) {
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, unlocked: true });
  response.cookies.set(AUTH_COOKIE, authToken(), cookieOptions());
  return response;
}
