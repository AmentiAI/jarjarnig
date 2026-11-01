const base = 'http://localhost:3001';

const unlock = await fetch(`${base}/api/unlock`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pin: '418293' }),
});

if (!unlock.ok) {
  console.error('UNLOCK_FAIL', await unlock.text());
  process.exit(1);
}

const cookie = unlock.headers.get('set-cookie') ?? '';
const status = await fetch(`${base}/api/status`, { headers: { cookie } });
console.log('STATUS', await status.text());

const chat = await fetch(`${base}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({ message: 'In one short sentence, confirm you are online and ready.' }),
});

const body = await chat.text();
console.log('CHAT_STATUS', chat.status);
console.log('CHAT_BODY', body);
if (!chat.ok) process.exit(1);
