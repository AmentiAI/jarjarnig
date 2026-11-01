import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const line = readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .find((entry) => entry.startsWith('DATABASE_URL='));

if (!line) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const url = new URL(line.slice('DATABASE_URL='.length));
url.searchParams.delete('channel_binding');
const sql = neon(url.toString());

await sql`
  CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New session',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const ping = await sql`SELECT 1 AS ok`;
console.log('DB_OK', ping);
