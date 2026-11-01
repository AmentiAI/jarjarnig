'use client';

import { FormEvent, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Activity,
  BrainCircuit,
  Clock3,
  Database,
  Mic,
  Plus,
  Send,
  Shield,
  Smartphone,
} from 'lucide-react';
import { hasBrowserSpeech, listenWithBrowserSpeech, primeVoice, recordUntilSilence, speak, stopSpeaking } from '@/lib/client/voice';

type Msg = { role: 'user' | 'jarvis'; text: string };
type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';
type Status = {
  locked: boolean;
  needsPin: boolean;
  llm: boolean;
  provider: 'openai' | 'groq' | null;
  stt: boolean;
  db: boolean;
};
type Conversation = { id: string; title: string; updated_at: string };

const greeting: Msg = {
  role: 'jarvis',
  text: 'Systems online. I am J.A.R.V.I.S. Speak or type a command.',
};

export function CommandCenter() {
  const [messages, setMessages] = useState<Msg[]>([greeting]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pin, setPin] = useState('');
  const [time, setTime] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = mode === 'listening' || mode === 'thinking';

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setVoiceReady(hasBrowserSpeech() || Boolean(navigator.mediaDevices));
    const unlockAudio = () => primeVoice();
    window.addEventListener('pointerdown', unlockAudio);
    const saved = window.localStorage.getItem('jarvis.conversationId');
    if (saved) setConversationId(saved);
    void refreshStatus(saved);
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mode]);

  useEffect(() => {
    if (conversationId) window.localStorage.setItem('jarvis.conversationId', conversationId);
  }, [conversationId]);

  const modules = useMemo(
    () =>
      [
        [BrainCircuit, 'Neural Core', status?.llm ? `${status.provider} online` : 'API key required'],
        [Database, 'Memory Vault', status?.db ? 'Neon connected' : 'Waiting'],
        [Smartphone, 'Phone Link', voiceReady ? 'Voice ready' : 'Type only'],
        [Shield, 'Security Protocol', status?.needsPin ? 'PIN armed' : 'Open access'],
        [Activity, 'Session Bus', conversationId ? 'Active thread' : 'Standby'],
      ] as Array<[ComponentType<{ size?: number }>, string, string]>,
    [conversationId, status, voiceReady]
  );

  async function refreshStatus(existingId: string | null = conversationId) {
    const response = await fetch('/api/status');
    const next = (await response.json()) as Status;
    setStatus(next);
    if (next.locked) return;
    await loadConversations();
    if (existingId) await loadConversation(existingId);
  }

  async function loadConversations() {
    const response = await fetch('/api/conversations');
    if (!response.ok) return;
    const data = (await response.json()) as { conversations: Conversation[] };
    setConversations(data.conversations);
  }

  async function loadConversation(id: string) {
    const response = await fetch(`/api/conversations/${id}`);
    if (!response.ok) return;
    const data = (await response.json()) as { messages: Msg[] };
    setConversationId(id);
    setMessages(data.messages.length ? data.messages : [greeting]);
  }

  async function unlock(event?: FormEvent) {
    event?.preventDefault();
    setError('');
    const response = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!response.ok) {
      setError('Access denied.');
      setPin('');
      return;
    }
    setPin('');
    await refreshStatus();
  }

  async function send(value = input) {
    const text = value.trim();
    if (!text || busy) return;
    primeVoice();
    stopSpeaking();
    setInput('');
    setError('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setMode('thinking');

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, message: text }),
    });
    const data = (await response.json()) as { conversationId?: string; reply?: string; error?: string };

    if (response.status === 401) {
      setStatus((current) => (current ? { ...current, locked: true } : current));
      setMode('idle');
      return;
    }

    if (!response.ok || !data.reply) {
      const fallback = data.error || 'Neural core unavailable.';
      setMessages((current) => [...current, { role: 'jarvis', text: fallback }]);
      setMode('idle');
      return;
    }

    if (data.conversationId) setConversationId(data.conversationId);
    setMessages((current) => [...current, { role: 'jarvis', text: data.reply! }]);
    setMode('speaking');
    void speak(data.reply).finally(() => setMode((current) => (current === 'speaking' ? 'idle' : current)));
    void loadConversations();
  }

  async function voice() {
    if (busy) return;
    primeVoice();
    setError('');
    setMode('listening');
    try {
      let text = '';
      if (status?.stt && navigator.mediaDevices) {
        const blob = await recordUntilSilence();
        const form = new FormData();
        form.append('audio', blob, blob.type.includes('mp4') ? 'voice.mp4' : 'voice.webm');
        const response = await fetch('/api/transcribe', { method: 'POST', body: form });
        const data = (await response.json()) as { text?: string; error?: string };
        if (!response.ok) throw new Error(data.error || 'Transcription failed.');
        text = data.text?.trim() ?? '';
      } else {
        text = await listenWithBrowserSpeech();
      }
      if (!text) throw new Error('I did not catch that.');
      setMode('idle');
      await send(text);
    } catch (err) {
      setMode('idle');
      setError(err instanceof Error ? err.message : 'Voice capture failed.');
    }
  }

  function newSession() {
    stopSpeaking();
    setConversationId(null);
    window.localStorage.removeItem('jarvis.conversationId');
    setMessages([greeting]);
    setMode('idle');
  }

  if (!status) {
    return (
      <main className="lock">
        <div className="orb compact">
          <div className="ring ring1" />
          <div className="ring ring2" />
          <div className="ring ring3" />
          <div className="core">J</div>
        </div>
        <h1>INITIALIZING</h1>
        <p>Bringing the command center online.</p>
      </main>
    );
  }

  if (status.locked) {
    return (
      <main className="lock">
        <div className="orb compact">
          <div className="ring ring1" />
          <div className="ring ring2" />
          <div className="ring ring3" />
          <div className="core">J</div>
        </div>
        <h1>RESTRICTED ACCESS</h1>
        <p>Enter the command-center PIN to continue.</p>
        <form onSubmit={unlock} className="pin-form">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Access code"
          />
          <button type="submit" onClick={() => void unlock()}>Unlock</button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </main>
    );
  }

  return (
    <main>
      <header>
        <div className="brand">
          <span className="brandmark">◈</span>
          <div>
            <strong>J.A.R.V.I.S.</strong>
            <small>PERSONAL INTELLIGENCE SYSTEM</small>
          </div>
        </div>
        <div className="online">
          <span /> {status?.llm ? 'NEURAL CORE ONLINE' : 'AWAITING API KEY'}
        </div>
      </header>

      <div className="layout">
        <aside>
          <div className="section">SYSTEM MODULES</div>
          {modules.map(([Icon, label, state]) => (
            <div className="module" key={label}>
              <Icon size={19} />
              <div>
                <b>{label}</b>
                <small>{state}</small>
              </div>
            </div>
          ))}
          <div className="section sessions">RECENT SESSIONS</div>
          <div className="session-list">
            {conversations.map((item) => (
              <button
                key={item.id}
                className={item.id === conversationId ? 'session active' : 'session'}
                onClick={() => void loadConversation(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
          <div className="foot">BUILD 1.0.0 • HOSTED COMMAND CENTER</div>
        </aside>

        <section className={`center ${mode}`}>
          <div className="eyebrow">ARTIFICIAL INTELLIGENCE • CENTRAL CORE</div>
          <div className="orb">
            <div className="ring ring1" />
            <div className="ring ring2" />
            <div className="ring ring3" />
            <div className="core">J</div>
          </div>
          <h1>
            {mode === 'listening'
              ? 'LISTENING'
              : mode === 'thinking'
                ? 'PROCESSING'
                : mode === 'speaking'
                  ? 'SPEAKING'
                  : 'AWAITING YOUR COMMAND'}
          </h1>
          <p>
            {status?.llm
              ? 'Voice-enabled command center. Tap the mic on your phone and talk.'
              : 'Neural core is starting. If this stays offline, launch Ollama or add an API key.'}
          </p>
          <div className="stats">
            <div>
              <span>CORE STATUS</span>
              <b>{status?.llm ? 'READY' : 'OFFLINE'}</b>
            </div>
            <div>
              <span>LOCAL TIME</span>
              <b>{time}</b>
            </div>
            <div>
              <span>MEMORY</span>
              <b>{status?.db ? 'ON' : 'OFF'}</b>
            </div>
          </div>
        </section>

        <section className="chat">
          <div className="chathead">
            <span>COMMUNICATIONS</span>
            <div className="chat-actions">
              <button type="button" onClick={newSession} title="New session">
                <Plus size={16} />
              </button>
              <Clock3 size={16} />
            </div>
          </div>
          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === 'jarvis' ? 'J.A.R.V.I.S.' : 'YOU'}</small>
                <p>{message.text}</p>
              </div>
            ))}
            {mode === 'thinking' ? (
              <div className="message jarvis">
                <small>J.A.R.V.I.S.</small>
                <p>Working.</p>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
          {error ? <div className="error-bar">{error}</div> : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <button type="button" onClick={() => void voice()} title="Speak" className={mode === 'listening' ? 'hot' : ''}>
              <Mic size={19} />
            </button>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Enter a command..."
              disabled={busy}
            />
            <button type="submit" title="Send" disabled={busy}>
              <Send size={19} />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
