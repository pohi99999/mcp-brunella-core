#!/usr/bin/env node
/**
 * sync_mcp_config.js
 * MCP konfiguráció összehasonlítás: mcp_servers.json <-> .vscode/mcp.json
 *
 * Futtatás: node scripts/sync_mcp_config.js
 * npm script: npm run mcp:sync
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Fájlok beolvasása ---

function loadJson(filePath, label) {
  const fullPath = resolve(ROOT, filePath);
  if (!existsSync(fullPath)) {
    console.error(`[HIBA] Nem talalhato: ${filePath}`);
    return null;
  }
  try {
    const raw = readFileSync(fullPath, 'utf8');
    // Eltavolítjuk az esetleges merge conflict markereket - warningot irunk
    if (raw.includes('<<<<<<<') || raw.includes('>>>>>>>')) {
      console.warn(`[FIGYELEM] ${label}: merge conflict marker talalhato! Oldd fel elobb.`);
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[HIBA] JSON parse sikertelen: ${filePath} - ${e.message}`);
    return null;
  }
}

const internalConfig = loadJson('mcp_servers.json', 'mcp_servers.json');
const vscodeConfig = loadJson('.vscode/mcp.json', '.vscode/mcp.json');

if (!internalConfig || !vscodeConfig) {
  process.exit(1);
}

// --- Szerverek kinyerése ---

/** mcp_servers.json: tömb formátum */
const internalServers = new Map(
  internalConfig.map(s => [s.name, s])
);

/** .vscode/mcp.json: objektum formátum { servers: { name: config } } */
const vscodeServers = new Map(
  Object.entries(vscodeConfig.servers || {})
);

// --- Összehasonlítás ---

const onlyInInternal = [];
const onlyInVscode = [];
const inBoth = [];
const disabledMismatch = [];

for (const [name, server] of internalServers) {
  if (vscodeServers.has(name)) {
    inBoth.push(name);
    // Disabled állapot ellenőrzés
    const vsDisabled = vscodeServers.get(name).disabled === true;
    const intDisabled = server.disabled === true;
    if (vsDisabled !== intDisabled) {
      disabledMismatch.push({ name, internal: intDisabled, vscode: vsDisabled });
    }
  } else {
    onlyInInternal.push(name);
  }
}

for (const name of vscodeServers.keys()) {
  if (!internalServers.has(name)) {
    onlyInVscode.push(name);
  }
}

// --- Riport ---

console.log('\n=== MCP Konfiguracio Osszehasonlitas ===\n');

console.log(`mcp_servers.json szerverek (${internalServers.size}):`);
for (const [name, s] of internalServers) {
  const status = s.disabled ? '[DISABLED]' : '[aktiv]  ';
  console.log(`  ${status} ${name}`);
}

console.log(`\n.vscode/mcp.json szerverek (${vscodeServers.size}):`);
for (const [name, s] of vscodeServers) {
  const status = s.disabled ? '[DISABLED]' : '[aktiv]  ';
  console.log(`  ${status} ${name}`);
}

console.log('\n--- Eltéresek ---\n');

let hasIssue = false;

if (onlyInInternal.length > 0) {
  hasIssue = true;
  console.log(`[CSAK mcp_servers.json-ban] (${onlyInInternal.length}):`);
  onlyInInternal.forEach(n => console.log(`  - ${n}`));
  console.log('  -> Megfontoland: hozd letre .vscode/mcp.json-ban is, ha VSCode-bol is kell\n');
}

if (onlyInVscode.length > 0) {
  console.log(`[CSAK .vscode/mcp.json-ban] (${onlyInVscode.length}):`);
  onlyInVscode.forEach(n => console.log(`  - ${n}`));
  console.log('  -> INFO: VSCode-specifikus szerverek (pl. chrome-devtools, playwright) - OK lehet\n');
}

if (disabledMismatch.length > 0) {
  hasIssue = true;
  console.log(`[DISABLED MISMATCH] (${disabledMismatch.length}):`);
  disabledMismatch.forEach(({ name, internal, vscode }) => {
    console.log(`  - ${name}: mcp_servers.json=${internal ? 'disabled' : 'aktiv'} | .vscode/mcp.json=${vscode ? 'disabled' : 'aktiv'}`);
  });
  console.log('  -> JAVITAS SZUKSEGES: szinkronizald a disabled allapotot!\n');
}

if (!hasIssue && disabledMismatch.length === 0) {
  console.log('[OK] Nincs kritikus elteres a ket konfiguracio kozott.\n');
} else {
  console.log('[FIGYELEM] Vannak eltéresek - ellenorizd a fenti listakat.\n');
}

console.log(`Kozos szerverek (${inBoth.length}): ${inBoth.join(', ')}`);
console.log('\n=====================================\n');

// Exit code: 0 = OK, 1 = kritikus mismatch (disabled elteres)
process.exit(disabledMismatch.length > 0 ? 1 : 0);
