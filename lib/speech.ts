import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICE = process.env.JARVIS_VOICE || 'en-GB-RyanNeural';

function spokenText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function synthesizeSpeech(text: string) {
  const spoken = spokenText(text);
  if (!spoken) throw new Error('Nothing to speak.');

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(spoken), {
      rate: '-6%',
      pitch: '-8%',
      volume: '+8%',
    });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      audioStream.on('error', reject);
      audioStream.on('close', () => resolve());
    });

    const audio = Buffer.concat(chunks);
    if (audio.length < 200) throw new Error('Voice engine returned empty audio.');
    return audio;
  } finally {
    tts.close();
  }
}
