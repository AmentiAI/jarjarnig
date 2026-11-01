import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { synthesizeSpeech } from '@/lib/speech';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim() ?? '';
  if (!text) {
    return NextResponse.json({ error: 'Nothing to speak.' }, { status: 400 });
  }

  try {
    const audio = await synthesizeSpeech(text);
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voice synthesis failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
