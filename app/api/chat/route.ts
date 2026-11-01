import { NextResponse } from 'next/server';
import { getClient, MissingAIKeyError } from '@/lib/ai';
import { isAuthorized } from '@/lib/auth';
import { ensureSchema, getSql } from '@/lib/db';
import { JARVIS_TOOLS, systemPrompt } from '@/lib/jarvis';

export const runtime = 'nodejs';
export const maxDuration = 120;

type ChatBody = {
  conversationId?: string;
  message?: string;
};

function titleFrom(message: string) {
  const compact = message.replace(/\s+/g, ' ').trim();
  return compact.length > 48 ? `${compact.slice(0, 45)}...` : compact || 'New session';
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ChatBody | null;
  const message = body?.message?.trim() ?? '';
  if (!message) {
    return NextResponse.json({ error: 'Message required.' }, { status: 400 });
  }

  try {
    await ensureSchema();
    const db = getSql();
    const { client, chatModel, supportsTools } = getClient();

    let conversationId = body?.conversationId;
    if (conversationId) {
      const existing = await db`SELECT id FROM conversations WHERE id = ${conversationId} LIMIT 1`;
      if (existing.length === 0) conversationId = undefined;
    }

    if (!conversationId) {
      const created = await db`
        INSERT INTO conversations (title)
        VALUES (${titleFrom(message)})
        RETURNING id
      `;
      conversationId = String(created[0].id);
    }

    const [history, memories] = await Promise.all([
      db`
        SELECT role, content
        FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at DESC
        LIMIT 20
      `,
      db`SELECT id, content FROM memories ORDER BY created_at DESC LIMIT 50`,
    ]);

    await db`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${conversationId}, 'user', ${message})
    `;

    const modelMessages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      tool_call_id?: string;
      tool_calls?: unknown;
    }> = [
      { role: 'system', content: systemPrompt(memories.map((row) => String(row.content))) },
      ...history.reverse().map((row) => ({
        role: (row.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: String(row.content),
      })),
      { role: 'user', content: message },
    ];

    let reply = '';
    for (let step = 0; step < 4; step += 1) {
      const completion = await client.chat.completions.create({
        model: chatModel,
        temperature: 0.6,
        messages: modelMessages as never,
        ...(supportsTools ? { tools: JARVIS_TOOLS } : {}),
      });

      const choice = completion.choices[0];
      const toolCalls = choice.message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        reply = choice.message.content?.trim() || 'Standing by.';
        break;
      }

      modelMessages.push({
        role: 'assistant',
        content: choice.message.content || '',
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        if (call.type !== 'function') continue;
        const args = JSON.parse(call.function.arguments || '{}') as {
          fact?: string;
          query?: string;
        };
        let result = 'ok';

        if (call.function.name === 'remember' && args.fact) {
          await db`INSERT INTO memories (content) VALUES (${args.fact.trim()})`;
          result = `Remembered: ${args.fact.trim()}`;
        } else if (call.function.name === 'forget' && args.query) {
          const query = args.query.trim();
          await db`DELETE FROM memories WHERE content ILIKE ${'%' + query + '%'}`;
          result = `Forgot memories matching: ${query}`;
        } else if (call.function.name === 'current_datetime') {
          result = new Date().toString();
        }

        modelMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result,
        });
      }
    }

    if (!reply) reply = 'Standing by.';

    await db`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${conversationId}, 'assistant', ${reply})
    `;
    await db`
      UPDATE conversations
      SET updated_at = now(),
          title = CASE WHEN title = 'New session' THEN ${titleFrom(message)} ELSE title END
      WHERE id = ${conversationId}
    `;

    return NextResponse.json({ conversationId, reply });
  } catch (error) {
    if (error instanceof MissingAIKeyError) {
      return NextResponse.json({ error: error.message, code: 'missing_llm' }, { status: 503 });
    }
    const messageText = error instanceof Error ? error.message : 'Neural core unavailable.';
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}
