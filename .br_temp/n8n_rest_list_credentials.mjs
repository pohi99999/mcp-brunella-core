import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const email = env.match(/^N8N_OWNER_EMAIL=(.+)$/m)?.[1]?.trim();
const password = env.match(/^N8N_OWNER_PASSWORD=(.+)$/m)?.[1]?.trim();
if (!email || !password) throw new Error('Missing n8n owner credentials');

const baseUrl = 'https://iszapfalo.app.n8n.cloud';

const loginRes = await fetch(`${baseUrl}/rest/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrLdapLoginId: email, password }),
});

const setCookie = loginRes.headers.get('set-cookie');
if (!setCookie) {
  console.log('login status=', loginRes.status);
  console.log(await loginRes.text());
  process.exit(1);
}
const cookie = setCookie.split(';')[0];

const res = await fetch(`${baseUrl}/rest/credentials`, {
  headers: { Cookie: cookie },
});
console.log('status=', res.status);
console.log(await res.text());
