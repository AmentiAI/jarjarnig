type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  abort: () => void;
};

function recognitionEngine() {
  const w = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function hasBrowserSpeech() {
  return Boolean(recognitionEngine());
}

export function listenWithBrowserSpeech() {
  return new Promise<string>((resolve, reject) => {
    const Engine = recognitionEngine();
    if (!Engine) {
      reject(new Error('Speech recognition is not available in this browser.'));
      return;
    }
    const rec = new Engine();
    let settled = false;
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (event) => {
      settled = true;
      const text = event.results[0]?.[0]?.transcript?.trim() ?? '';
      resolve(text);
    };
    rec.onerror = () => {
      if (!settled) reject(new Error('Voice capture failed.'));
    };
    rec.onend = () => {
      if (!settled) reject(new Error('No speech detected.'));
    };
    rec.start();
  });
}

function preferredMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function rms(data: Uint8Array) {
  let total = 0;
  for (const value of data) {
    const centered = (value - 128) / 128;
    total += centered * centered;
  }
  return Math.sqrt(total / data.length);
}

export async function recordUntilSilence(onLevel?: (level: number) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const mimeType = preferredMime();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const blob = await new Promise<Blob>((resolve, reject) => {
    let silentFor = 0;
    let heardVoice = false;
    const started = Date.now();

    recorder.onerror = () => reject(new Error('Recorder failed.'));
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    };

    const tick = () => {
      if (recorder.state !== 'recording') return;
      analyser.getByteTimeDomainData(samples);
      const level = rms(samples);
      onLevel?.(level);
      if (level > 0.045) {
        heardVoice = true;
        silentFor = 0;
      } else if (heardVoice) {
        silentFor += 80;
      }
      const elapsed = Date.now() - started;
      if ((heardVoice && silentFor >= 1100) || elapsed > 20000) {
        recorder.stop();
        return;
      }
      window.setTimeout(tick, 80);
    };

    recorder.start();
    window.setTimeout(tick, 80);
  });

  stream.getTracks().forEach((track) => track.stop());
  await context.close();
  return blob;
}

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let speakToken = 0;

export function primeVoice() {
  const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  if (!audioContext) audioContext = new Context();
  if (audioContext.state === 'suspended') void audioContext.resume();
}

export function stopSpeaking() {
  speakToken += 1;
  currentSource?.stop();
  currentSource = null;
  window.speechSynthesis?.cancel();
}

function speakWithBrowser(text: string) {
  return new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const british =
      voices.find((voice) => /en-GB/i.test(voice.lang) && /male|ryan|thomas|daniel/i.test(voice.name)) ||
      voices.find((voice) => /en-GB/i.test(voice.lang)) ||
      voices.find((voice) => /en/i.test(voice.lang));
    if (british) utterance.voice = british;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export async function speak(text: string) {
  primeVoice();
  const token = ++speakToken;
  currentSource?.stop();
  currentSource = null;
  window.speechSynthesis?.cancel();

  try {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok || !audioContext) throw new Error('Neural voice unavailable.');
    const bytes = await response.arrayBuffer();
    if (token !== speakToken) return;
    const decoded = await audioContext.decodeAudioData(bytes.slice(0));
    if (token !== speakToken) return;

    await new Promise<void>((resolve) => {
      const source = audioContext!.createBufferSource();
      source.buffer = decoded;
      source.connect(audioContext!.destination);
      currentSource = source;
      source.onended = () => {
        if (currentSource === source) currentSource = null;
        resolve();
      };
      source.start();
    });
  } catch {
    if (token === speakToken) await speakWithBrowser(text);
  }
}
