import { NextResponse } from 'next/server';
import { configuredProvider, hasSpeechToText } from '@/lib/ai';
import { isAuthorized, pinRequired } from '@/lib/auth';
import { pingDatabase } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const authorized = await isAuthorized();
  const db = authorized ? await pingDatabase() : false;

  return NextResponse.json({
    locked: !authorized,
    needsPin: pinRequired(),
    llm: Boolean(configuredProvider()),
    provider: configuredProvider(),
    stt: hasSpeechToText(),
    db,
  });
}
