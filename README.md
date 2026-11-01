# J.A.R.V.I.S. Command Center

A hosted personal assistant you can open on your phone, talk to, and keep memory for.

It uses the holographic command-center UI, a real LLM, Neon Postgres for conversation history and long-term memory, browser or Whisper voice input, and spoken replies.

## What you need

1. Node.js 20+
2. The Neon `DATABASE_URL` already in `.env`
3. An AI key in `.env`:
   - `OPENAI_API_KEY` (best: chat + Whisper), or
   - `GROQ_API_KEY` (free tier, fast chat + Whisper)
4. Optional: `JARVIS_ACCESS_PIN` so only you can open the hosted site

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Put it on your site

Push this repo, then import `AmentiAI/jarjarnig` in Vercel. In the Vercel project settings, add these environment variables before the first deploy:

```
DATABASE_URL=
JARVIS_ACCESS_PIN=418293
GROQ_API_KEY=
OPENAI_API_KEY=
```

Use the same Neon `DATABASE_URL` from your local `.env`. Set `JARVIS_ACCESS_PIN` or the site is public. Leave `AI_PROVIDER` unset on Vercel. The local Ollama model only runs on this PC, so the hosted brain needs a working `GROQ_API_KEY` or `OPENAI_API_KEY`.

The neural British voice and the Neon memory work on the host without a local PC.

## Talk from your phone right now

Keep this PC awake. Jarvis is running locally with Ollama and a public HTTPS tunnel.

1. On your phone, open the live tunnel URL printed by `start-jarvis.ps1` or cloudflared.
2. Enter PIN `418293`.
3. Allow the microphone if Safari/Chrome asks.
4. Tap the mic and talk, or type a command.
5. Optional: Share → Add to Home Screen.

The microphone only works over HTTPS. That is why the tunnel exists.

This phone link stays up only while this computer, Ollama, Next.js, and the tunnel are running. For a permanent site that works when the PC is off, add a billed OpenAI or Groq key and deploy to Vercel.

## Environment

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=
GROQ_API_KEY=
JARVIS_ACCESS_PIN=418293
JARVIS_MODEL=
AI_PROVIDER=
```

Leave `AI_PROVIDER` empty to prefer OpenAI when both keys exist. Set it to `groq` to force Groq.
