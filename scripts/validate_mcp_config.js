#!/usr/bin/env node
/**
 * validate_mcp_config.js
 * JSON séma validáció mindkét MCP konfigurációs fájlra
 *
 * Futtatás: node scripts/validate_mcp_config.js
 * npm script: npm run mcp:validate
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let exitCode = 0;

function fail(msg) {
  console.error(`  [HIBA] ${msg}`);
  exitCode = 1;
}

function warn(msg) {
  console.warn(`  [FIGYELEM] ${msg}`);
}

function ok(msg) {
  console.log(`  [OK] ${msg}`);
}

// --- mcp_servers.json validáció ---

console.log('\n=== mcp_servers.json validáció ===\n');

const internalPath = resolve(ROOT, 'mcp_servers.json');
if (!existsSync(internalPath)) {
  fail('mcp_servers.json nem talalhato');
} else {
  let data;
  try {
    data = JSON.parse(readFileSync(internalPath, 'utf8'));
    ok('JSON parse OK');
  } catch (e) {
    fail(`JSON parse hiba: ${e.message}`);
    data = null;
  }

  if (data) {
    if (!Array.isArray(data)) {
      fail('Tomb formatumot var ([ { name, command, args } ])');
    } else {
      ok(`${data.length} szerver bejegyzes talalhato`);
      data.forEach((s, i) => {
        if (!s.name) fail(`[${i}] Hianyzik a "name" mezo`);
        if (!s.command) fail(`[${i}] Hianyzik a "command" mezo`);
        if (!Array.isArray(s.args)) fail(`[${i}] Az "args" nem tomb`);
        if (s.disabled === undefined) warn(`[${i}] "${s.name}": nincs "disabled" mezo — feltételezve: false`);
      });
    }
  }
}

// --- .vscode/mcp.json validáció ---

console.log('\n=== .vscode/mcp.json validáció ===\n');

const vscodePath = resolve(ROOT, '.vscode/mcp.json');
if (!existsSync(vscodePath)) {
  fail('.vscode/mcp.json nem talalhato');
} else {
  let data;
  try {
    const raw = readFileSync(vscodePath, 'utf8');
    if (raw.includes('<<<<<<<')) {
      fail('Merge conflict marker talalhato! Oldd fel elobb a git conflict-ot.');
    }
    data = JSON.parse(raw);
    ok('JSON parse OK');
  } catch (e) {
    fail(`JSON parse hiba: ${e.message}`);
    data = null;
  }

  if (data) {
    if (!data.servers || typeof data.servers !== 'object') {
      fail('Hianyzik a "servers" objektum');
    } else {
      const names = Object.keys(data.servers);
      ok(`${names.length} szerver bejegyzes talalhato`);
      for (const [name, s] of Object.entries(data.servers)) {
        if (!s.type) fail(`"${name}": hianyzik a "type" mezo`);
        if (s.type === 'stdio') {
          if (!s.command) fail(`"${name}": stdio tipusnal hianyzik a "command"`);
          if (!Array.isArray(s.args)) fail(`"${name}": az "args" nem tomb`);
        }
        if (s.type === 'http') {
          if (!s.url) fail(`"${name}": http tipusnal hianyzik az "url"`);
        }
      }
    }

    if (!data.inputs || !Array.isArray(data.inputs)) {
      warn('"inputs" tomb hianyzik vagy ures — token prompting nem mukodik');
    } else {
      ok(`${data.inputs.length} input (token prompt) konfiguralva`);
    }
  }
}

// --- Összefoglaló ---

console.log('\n=== Eredmeny ===\n');
if (exitCode === 0) {
  console.log('[OK] Mindket MCP konfiguracio valid.\n');
} else {
  console.error('[HIBA] Vannak validacios hibak — lasd fent.\n');
}

process.exit(exitCode);
