#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
// Do not statically import heavy external libs so the script can run without a full install in some environments.
let google; // will be dynamically imported when needed
let axios;  // dynamic import
let linearImportTried = false;
let linearAvailable = true;
import { fileURLToPath } from 'url';

const ROOT = path.resolve(process.cwd());

function safeLog(...args) { console.log('[tracks-sync]', ...args); }

// Load .env manually if present (simple parser) to avoid requiring dotenv as a dependency
try {
  const dotenvPath = path.join(ROOT, '.env');
  const envRaw = await fs.readFile(dotenvPath, 'utf8').catch(() => null);
  if (envRaw) {
    for (const line of envRaw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
} catch (e) {
  // ignore .env read errors
}

async function listTracksFromFolders() {
  const tracksDir = path.join(ROOT, 'conductor', 'tracks');
  try {
    const dirents = await fs.readdir(tracksDir, { withFileTypes: true });
    const dirs = dirents.filter(d => d.isDirectory()).map(d => d.name);
    const tracks = [];
    for (const name of dirs) {
      const folder = path.join(tracksDir, name);
      let meta = {};
      try {
        const metaPath = path.join(folder, 'meta.json');
        const raw = await fs.readFile(metaPath, 'utf8');
        meta = JSON.parse(raw);
      } catch (e) {
        // ignore, fallback to heuristics
        meta = { name };
      }
      const stats = await fs.stat(folder);
      tracks.push({
        id: name,
        title: meta.title || meta.name || name,
        status: (meta.status || meta.state || meta.phase || guessStatus(meta)).toString(),
        owner: meta.owner || meta.assignee || '',
        updated_at: meta.updated_at || stats.mtime.toISOString(),
        link: `conductor/tracks/${name}`,
        notes: meta.notes || ''
      });
    }
    return tracks;
  } catch (err) {
    safeLog('No conductor/tracks folder or error reading it:', err.message);
    return [];
  }
}

function guessStatus(meta) {
  if (!meta) return 'unknown';
  if (meta.archived || meta.status === 'archived' || meta.state === 'archived') return 'archived';
  if (meta.status === 'active' || meta.state === 'in_progress' || meta.phase === 'active') return 'in_progress';
  if (meta.status === 'proposed' || meta.phase === 'proposed' || meta.state === 'proposed') return 'queued';
  return 'unknown';
}

async function authGoogle() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_SHEETS_CREDS || process.env.GOOGLE_CLOUD_CREDENTIALS_PATH || process.env.GOOGLE_SHEETS_CREDS || process.env.GOOGLE_CREDENTIALS_PATH;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON (set service account JSON as env)');
  let creds;
  try {
    // support both file path and JSON string
    if (raw.trim().startsWith('{')) creds = JSON.parse(raw);
    else creds = JSON.parse(await fs.readFile(raw, 'utf8'));
  } catch (e) {
    throw new Error('Failed to parse Google service account JSON: ' + e.message);
  }
  // dynamic import to avoid failing at static import time
  if (!google) google = (await import('googleapis')).google;
  const client = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  await client.authorize();
  return client;
}

async function writeSheet(auth, sheetId, rows) {
  const sheets = google.sheets({ version: 'v4', auth });
  const range = 'Tracks!A1';
  const values = [
    ['id', 'title', 'status', 'owner', 'updated_at', 'link', 'notes', 'linear_links'],
    ...rows.map(r => [r.id, r.title, r.status, r.owner, r.updated_at, r.link, r.notes || '', r.linear_links || ''])
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

async function fetchLinearMatches(title) {
  const apiKey = process.env.LINEAR_API_KEY || process.env.Linear_API_KEY || process.env.linear_api_key || process.env.LINEAR_APIKEY || process.env.LINEAR_KEY || process.env.LINEAR;
  if (!apiKey) return [];
  if (!linearAvailable) return [];
  if (!linearImportTried) {
    linearImportTried = true;
    try {
      axios = (await import('axios')).default;
    } catch (err) {
      linearAvailable = false;
      safeLog('Linear API disabled (axios not installed):', err.message);
      return [];
    }
  }
  // GraphQL query searching issues by title
  const query = `query Issues($search: String) { issues(filter: {search: $search}) { nodes { id title url state { name } } } }`;
  try {
    const resp = await axios.post('https://api.linear.app/graphql', { query, variables: { search: title } }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
    return resp.data?.data?.issues?.nodes || [];
  } catch (err) {
    safeLog('Linear API error:', err.message);
    return [];
  }
}

async function main() {
  safeLog('Starting tracks export...');
  const sheetId = process.env.SHEET_ID || process.env.TRACKS_SHEET_ID || process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) {
    console.error('Missing SHEET_ID / TRACKS_SHEET_ID / GOOGLE_SHEET_ID environment variable. See conductor/tracks_sync_README.md.');
    process.exit(2);
  }

  const tracks = await listTracksFromFolders();
  safeLog(`Discovered ${tracks.length} track(s)`);

  // enrich with Linear links if available
  for (const t of tracks) {
    const matches = await fetchLinearMatches(t.title);
    t.linear_links = matches.map(m => m.url).filter(Boolean).join(', ');
  }

  const auth = await authGoogle();
  await writeSheet(auth, sheetId, tracks);
  safeLog('Wrote', tracks.length, 'rows to sheet', sheetId);
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main().catch(err => { console.error(err); process.exit(1); });
}
