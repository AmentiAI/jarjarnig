import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { ensureSchema, getSql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 });
  }

  await ensureSchema();
  const rows = await getSql()`
    SELECT id, title, updated_at
    FROM conversations
    ORDER BY updated_at DESC
    LIMIT 20
  `;

  return NextResponse.json({ conversations: rows });
}
