import { NextResponse } from 'next/server';
import { getClient, MissingAIKeyError } from '@/lib/ai';
import { isAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: 'No audio received.' }, { status: 400 });
    }

    const { client, sttModel } = getClient();
    const result = await client.audio.transcriptions.create({
      file: audio,
      model: sttModel,
    });

    return NextResponse.json({ text: result.text.trim() });
  } catch (error) {
    if (error instanceof MissingAIKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : 'Transcription failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
