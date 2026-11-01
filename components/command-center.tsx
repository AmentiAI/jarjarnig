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
  provider: 'openai' | 'groq' | 'ollama' | null;
  stt: boolean;
  db: boolean;
};
type Conversation = { id: string; title: string; updated_at: string };

const greeting: Msg = {
  role: 'jarvis',
  text: 'Systems online. I am J.A.R.V.I.S. Speak or type a command.',
};

function Reactor({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'orb compact' : 'orb'} aria-hidden="true">
      <svg className="reactor" viewBox="0 0 400 400">
        <defs>
          <radialGradient id="well" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#12384c" />
            <stop offset="70%" stopColor="#071018" />
            <stop offset="100%" stopColor="#03070b" />
          </radialGradient>
          <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d5dee6" />
            <stop offset="35%" stopColor="#6d7c89" />
            <stop offset="68%" stopColor="#c5d0d8" />
            <stop offset="100%" stopColor="#4e5c68" />
          </linearGradient>
          <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4fbff" />
            <stop offset="45%" stopColor="#9eb0be" />
            <stop offset="100%" stopColor="#e7f3f8" />
          </linearGradient>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="200" cy="200" r="156" fill="url(#well)" />
        <circle cx="200" cy="200" r="186" fill="none" stroke="url(#metal)" strokeWidth="26" />
        <circle cx="200" cy="200" r="186" fill="none" stroke="#070b10" strokeWidth="28" strokeDasharray="10 86" />
        <circle cx="200" cy="200" r="174" fill="none" stroke="#9aabB8" strokeWidth="1" opacity="0.7" />
        <circle cx="200" cy="200" r="198" fill="none" stroke="#8b9aa6" strokeWidth="2" />

        <g className="reactor-spin" filter="url(#glow)">
          <circle cx="200" cy="200" r="158" fill="none" stroke="#35c8ff" strokeWidth="9" strokeDasharray="54 18 92 26 40 70" strokeLinecap="butt" />
          <circle cx="200" cy="200" r="142" fill="none" stroke="#7adfff" strokeWidth="3" strokeDasharray="8 10" opacity="0.8" />
          <circle cx="200" cy="200" r="128" fill="none" stroke="#1ec6ff" strokeWidth="7" strokeDasharray="36 22 70 48" />
        </g>

        <g filter="url(#glow)">
          <circle cx="200" cy="200" r="186" fill="none" stroke="#ff3b3b" strokeWidth="4" strokeDasharray="16 270" transform="rotate(-40 200 200)" />
          <circle cx="200" cy="200" r="186" fill="none" stroke="#ff3b3b" strokeWidth="4" strokeDasharray="16 270" transform="rotate(48 200 200)" />
          <circle cx="200" cy="200" r="186" fill="none" stroke="#ff3b3b" strokeWidth="4" strokeDasharray="16 270" transform="rotate(150 200 200)" />
          <circle cx="200" cy="200" r="186" fill="none" stroke="#ff3b3b" strokeWidth="4" strokeDasharray="16 270" transform="rotate(230 200 200)" />
        </g>

        <circle cx="200" cy="200" r="108" fill="none" stroke="#7ad8ff" strokeWidth="1" opacity="0.55" />
        <circle cx="200" cy="200" r="108" fill="none" stroke="#9ae7ff" strokeWidth="3" strokeDasharray="2 7" opacity="0.7" />

        <g filter="url(#glow)">
          <polygon points="200,118 252,214 148,214" fill="none" stroke="#d7e7ef" strokeWidth="3" />
          <polygon points="200,136 236,206 164,206" fill="none" stroke="#8fdfff" strokeWidth="2" />
          <polygon points="200,154 220,198 180,198" fill="rgba(80,210,255,0.18)" stroke="#e9fbff" strokeWidth="1.4" />
          <circle className="reactor-core" cx="200" cy="184" r="7" fill="#f7fdff" />
        </g>

        <text className="reactor-word" x="200" y="248" textAnchor="middle">
          JARVIS
        </text>
      </svg>
    </div>
  );
}

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
        <div className="atmosphere" />
        <Reactor compact />
        <p className="kicker">MARK IV • SECURE CHANNEL</p>
        <h1>INITIALIZING</h1>
        <p>Bringing the command center online.</p>
      </main>
    );
  }

  if (status.locked) {
    return (
      <main className="lock">
        <div className="atmosphere" />
        <Reactor compact />
        <p className="kicker">MARK IV • SECURE CHANNEL</p>
        <h1>RESTRICTED ACCESS</h1>
        <p>Identify yourself to enter the command center.</p>
        <form onSubmit={unlock} className="pin-form">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Access code"
          />
          <button type="submit" onClick={() => void unlock()}>
            Unlock
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </main>
    );
  }

  const headline =
    mode === 'listening' ? 'Listening' : mode === 'thinking' ? 'Processing' : mode === 'speaking' ? 'Speaking' : 'Awaiting command';

  return (
    <main className={mode}>
      <div className="atmosphere" />
      <header>
        <div className="brand">
          <span className="brandmark">◈</span>
          <div>
            <strong>J.A.R.V.I.S.</strong>
            <small>Personal intelligence system</small>
          </div>
        </div>
        <div className="header-meta">
          <span className="chip">{time || '--:--:--'}</span>
          <div className={`online ${status.llm ? 'live' : ''}`}>
            <span /> {status.llm ? 'Neural core online' : 'Awaiting key'}
          </div>
        </div>
      </header>

      <div className="layout">
        <aside>
          <div className="section">System modules</div>
          {modules.map(([Icon, label, state], index) => (
            <div className="module" key={label}>
              <em>{String(index + 1).padStart(2, '0')}</em>
              <Icon size={16} />
              <div>
                <b>{label}</b>
                <small>{state}</small>
              </div>
            </div>
          ))}
          <div className="section sessions">Recent sessions</div>
          <div className="session-list">
            {conversations.length === 0 ? <p className="empty">No prior sessions</p> : null}
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
          <div className="foot">Build 1.0 · Hosted command center</div>
        </aside>

        <section className="center">
          <div className="eyebrow">Central core</div>
          <Reactor />
          <h1>{headline}</h1>
          <p>
            {status.llm
              ? 'Speak into the link, or enter a command below.'
              : 'Neural core is standing by for an API key.'}
          </p>
          <div className="stats">
            <div>
              <span>Core</span>
              <b>{status.llm ? 'Ready' : 'Offline'}</b>
            </div>
            <div>
              <span>Voice</span>
              <b>{mode === 'idle' ? 'Standby' : headline}</b>
            </div>
            <div>
              <span>Memory</span>
              <b>{status.db ? 'Synced' : 'Offline'}</b>
            </div>
          </div>
        </section>

        <section className="chat">
          <div className="chathead">
            <span>Communications</span>
            <div className="chat-actions">
              <button type="button" onClick={newSession} title="New session">
                <Plus size={15} />
              </button>
              <Clock3 size={15} />
            </div>
          </div>
          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === 'jarvis' ? 'J.A.R.V.I.S.' : 'You'}</small>
                <p>{message.text}</p>
              </div>
            ))}
            {mode === 'thinking' ? (
              <div className="message jarvis">
                <small>J.A.R.V.I.S.</small>
                <p className="thinking">
                  <i />
                  <i />
                  <i />
                </p>
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
              <Mic size={18} />
            </button>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Enter a command"
              disabled={busy}
            />
            <button type="submit" title="Send" disabled={busy}>
              <Send size={16} />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
