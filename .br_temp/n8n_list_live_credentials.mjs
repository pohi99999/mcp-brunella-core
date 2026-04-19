import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/^N8N_API_KEY=(.+)$/m)?.[1]?.trim();
if (!token) throw new Error('N8N_API_KEY not found');

const baseUrl = 'https://iszapfalo.app.n8n.cloud';

const res = await fetch(`${baseUrl}/api/v1/credentials`, {
  headers: {
    'X-N8N-API-KEY': token,
    'Content-Type': 'application/json',
  },
});

console.log('status=', res.status);
const text = await res.text();
console.log(text);
