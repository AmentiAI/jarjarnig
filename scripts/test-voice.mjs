import { writeFileSync } from 'fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const tts = new MsEdgeTTS();
await tts.setMetadata('en-GB-RyanNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
const { audioStream } = tts.toStream('Good evening. Systems are online and standing by.', {
  rate: '-6%',
  pitch: '-8%',
  volume: '+8%',
});

const chunks = [];
await new Promise((resolve, reject) => {
  audioStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  audioStream.on('error', reject);
  audioStream.on('close', resolve);
});
tts.close();

const audio = Buffer.concat(chunks);
writeFileSync('scripts/voice-sample.mp3', audio);
console.log('VOICE_BYTES', audio.length, audio.subarray(0, 3).toString('hex'));
