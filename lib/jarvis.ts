import type OpenAI from 'openai';

export const JARVIS_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Store a durable fact about the user or their world for future sessions.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fact: { type: 'string', description: 'A concise standalone fact to remember.' },
        },
        required: ['fact'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget',
      description: 'Remove a previously stored memory that is wrong or no longer wanted.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', description: 'Text that matches the memory to delete.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'current_datetime',
      description: 'Get the current date and time.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
    },
  },
];

export function systemPrompt(memories: string[]) {
  const memoryBlock = memories.length
    ? memories.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : 'No long-term memories stored yet.';

  const now = new Date().toString();
  return `You are J.A.R.V.I.S., a personal intelligence system for one private operator.
Speak like the film version: British, concise, composed, lightly dry, and useful.
You are a real assistant, not a movie prop. Answer questions, help plan, remember preferences, draft messages, and think things through.
Never claim you performed a physical action, controlled a device, or accessed a system you do not actually have.
If you cannot do something, say so plainly and offer the next best option.
Use the remember tool for durable personal facts: name, location, preferences, projects, people, routines.
Use forget when the operator corrects or retracts a memory.
The current date and time is ${now}.
Keep replies short enough to speak aloud unless the operator asks for depth.

Long-term memory:
${memoryBlock}`;
}
