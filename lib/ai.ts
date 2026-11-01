import OpenAI from 'openai';

export type AIProvider = 'openai' | 'groq' | 'ollama';

export class MissingAIKeyError extends Error {
  constructor() {
    super('No AI backend is ready. Start Ollama or add OPENAI_API_KEY / GROQ_API_KEY.');
    this.name = 'MissingAIKeyError';
  }
}

function ollamaBase() {
  return process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
}

function chatModel(provider: AIProvider) {
  const requested = process.env.JARVIS_MODEL?.trim() || '';
  const localModel = !requested || requested === 'llama3.2' || requested.startsWith('llama3.2:');
  if (provider === 'ollama') return localModel ? 'llama3.2' : requested;
  if (provider === 'groq') return localModel ? 'llama-3.3-70b-versatile' : requested;
  return localModel ? 'gpt-4o-mini' : requested;
}

export function configuredProvider(): AIProvider | null {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === 'ollama') return 'ollama';
  if (forced === 'groq' && process.env.GROQ_API_KEY) return 'groq';
  if (forced === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.VERCEL) return null;
  return 'ollama';
}

export function hasSpeechToText() {
  const provider = configuredProvider();
  return provider === 'openai' || provider === 'groq';
}

export function getClient() {
  const provider = configuredProvider();
  if (!provider) throw new MissingAIKeyError();

  if (provider === 'groq') {
    return {
      provider,
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      }),
      chatModel: chatModel('groq'),
      sttModel: 'whisper-large-v3',
      supportsTools: true,
    };
  }

  if (provider === 'ollama') {
    return {
      provider,
      client: new OpenAI({
        apiKey: 'ollama',
        baseURL: ollamaBase(),
      }),
      chatModel: chatModel('ollama'),
      sttModel: '',
      supportsTools: false,
    };
  }

  return {
    provider,
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    chatModel: chatModel('openai'),
    sttModel: 'whisper-1',
    supportsTools: true,
  };
}
