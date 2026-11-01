import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { ensureSchema, getSql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 });
  }

  const { id } = await params;
  await ensureSchema();
  const rows = await getSql()`
    SELECT role, content
    FROM messages
    WHERE conversation_id = ${id}
    ORDER BY created_at ASC
  `;

  return NextResponse.json({
    messages: rows.map((row) => ({
      role: row.role === 'user' ? 'user' : 'jarvis',
      text: row.content,
    })),
  });
}
