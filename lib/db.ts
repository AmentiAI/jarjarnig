import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

function connectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

let sql: NeonQueryFunction<false, false> | null = null;
let ready: Promise<void> | null = null;

export function getSql() {
  if (!sql) sql = neon(connectionString());
  return sql;
}

export async function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      const db = getSql();
      await db`
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL DEFAULT 'New session',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS memories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

export async function pingDatabase() {
  try {
    await ensureSchema();
    await getSql()`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
