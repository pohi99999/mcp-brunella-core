/*
Simple OAuth demo server for Google Workspace (Gmail "last 5 emails")
Usage:
  - Install dependencies: npm install googleapis
  - Set env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (or edit constants below)
  - Optionally set PORT (default 5678) and REDIRECT_PATH (default '/rest/oauth2-credential/callback')
  - Run: node oauth_server.js

Security: This script saves token.json locally in this folder. Do NOT commit token.json to git.
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '<YOUR_CLIENT_ID>'; // set via env
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '<YOUR_CLIENT_SECRET>'; // set via env
const PORT = process.env.PORT || process.env.REDIRECT_PORT || 5678;
const REDIRECT_PATH = process.env.REDIRECT_PATH || '/rest/oauth2-credential/callback';
const REDIRECT_URI = `http://localhost:${PORT}${REDIRECT_PATH}`;
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const TOKEN_PATH = path.join(__dirname, 'token.json');

if (CLIENT_ID.startsWith('<')) {
  console.warn('Warning: GOOGLE_CLIENT_ID not set. Set env var GOOGLE_CLIENT_ID to your GCP OAuth Client ID.');
}
if (CLIENT_SECRET.startsWith('<')) {
  console.warn('Warning: GOOGLE_CLIENT_SECRET not set. For server-side token exchange you need the client secret.');
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
  include_granted_scopes: true,
});

console.log('\n=== Google OAuth demo server ===');
console.log(`Redirect URI: ${REDIRECT_URI}`);
console.log('\nOpen this URL in your browser to authorize the demo:');
console.log(authUrl);
console.log('\nAfter consenting, Google will redirect to the callback URL and this server will exchange the code for tokens.');
console.log('Tokens will be saved to:', TOKEN_PATH);
console.log('\nIf you already have a token.json file, the server will attempt to use it to call Gmail immediately.');

async function callGmailList(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  try {
    const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 5 });
    if (!listRes.data.messages || listRes.data.messages.length === 0) {
      console.log('No messages found.');
      return;
    }
    console.log('\nLast messages (snippets):');
    for (const m of listRes.data.messages) {
      const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' });
      console.log('---');
      console.log(`id: ${m.id}`);
      console.log(`snippet: ${msg.data.snippet || '<no snippet>'}`);
    }
  } catch (err) {
    console.error('Error calling Gmail API:', err.message || err);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === REDIRECT_PATH) {
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing code parameter in query string.');
      return;
    }
    try {
      const r = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(r.tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(r.tokens, null, 2));
      console.log('\nReceived tokens and saved to', TOKEN_PATH);

      // Call Gmail to list last 5 messages
      await callGmailList(oauth2Client);

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Authentication successful. You can close this page. Check the console where the server is running.');

      // keep the server alive briefly so console output can finish
      setTimeout(() => { /* noop */ }, 1000);
    } catch (err) {
      console.error('Error exchanging code for tokens:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error exchanging code for tokens. See server console for details.');
    }
    return;
  }

  // Root/help page
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Google OAuth demo server\n\n1) Open the following URL in your browser to authorize:\n${authUrl}\n\n2) After consenting, Google will redirect to ${REDIRECT_URI} and this server will handle the code and print last 5 Gmail snippets to the console.\n\nNote: Ensure your OAuth Client's redirect URI includes ${REDIRECT_URI}`);
});

server.listen(PORT, () => {
  console.log(`\nServer listening on http://localhost:${PORT}  (callback path: ${REDIRECT_PATH})`);
  // If token exists, try to use it immediately
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oauth2Client.setCredentials(tokens);
      callGmailList(oauth2Client);
    } catch (e) {
      console.warn('Failed to read token.json:', e.message || e);
    }
  }
});
