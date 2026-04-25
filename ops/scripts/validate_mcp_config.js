#!/usr/bin/env node
/**
 * validate_mcp_config.js
 * JSON-szeru validacio a BAS MCP konfiguracios feluleteire.
 *
 * Futtatas: node scripts/validate_mcp_config.js
 * npm script: npm run mcp:validate
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

let exitCode = 0;
let validatedFiles = 0;

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

function section(title) {
  console.log(`\n=== ${title} ===\n`);
}

function readJson(relativePath, label) {
  const fullPath = resolve(ROOT, relativePath);
  if (!existsSync(fullPath)) {
    fail(`${label} nem talalhato`);
    return null;
  }

  try {
    const raw = readFileSync(fullPath, 'utf8');
    if (raw.includes('<<<<<<<') || raw.includes('>>>>>>>')) {
      fail(`${label}: merge conflict marker talalhato`);
      return null;
    }
    ok(`${label}: JSON parse OK`);
    validatedFiles += 1;
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${label}: JSON parse hiba: ${message}`);
    return null;
  }
}

function validateLocalServer(name, server, label) {
  if (!server.command) {
    fail(`${label} -> "${name}": local/stdio tipusnal hianyzik a "command"`);
  }
  if (!Array.isArray(server.args)) {
    fail(`${label} -> "${name}": local/stdio tipusnal az "args" nem tomb`);
  }
}

function validateHttpServer(name, server, label) {
  if (!server.url) {
    fail(`${label} -> "${name}": http tipusnal hianyzik az "url"`);
  }
}

function validateGenericServer(name, server, label) {
  if (!server || typeof server !== 'object' || Array.isArray(server)) {
    fail(`${label} -> "${name}": ervenytelen szerver objektum`);
    return;
  }

  const type = server.type || 'stdio';
  if (type === 'http') {
    validateHttpServer(name, server, label);
  } else if (type === 'stdio' || type === 'local') {
    validateLocalServer(name, server, label);
  } else {
    warn(`${label} -> "${name}": ismeretlen tipus (${type})`);
  }

  if ('tools' in server && !Array.isArray(server.tools)) {
    fail(`${label} -> "${name}": a "tools" mezo nem tomb`);
  }
}

function validateInputs(data, label) {
  if (!data.inputs || !Array.isArray(data.inputs)) {
    warn(`${label}: "inputs" tomb hianyzik vagy ures`);
    return;
  }
  ok(`${label}: ${data.inputs.length} input konfiguralva`);
}

section('mcp_servers.json validacio');
const internalData = readJson('mcp_servers.json', 'mcp_servers.json');
if (internalData) {
  if (!Array.isArray(internalData)) {
    fail('mcp_servers.json: tomb formatumot var ([ { name, ... } ])');
  } else {
    ok(`mcp_servers.json: ${internalData.length} szerver bejegyzes talalhato`);
    internalData.forEach((server, index) => {
      if (!server.name) {
        fail(`mcp_servers.json -> [${index}] hianyzik a "name" mezo`);
        return;
      }
      const transport = server.transport === 'self' || server.transport === 'http' ? server.transport : 'stdio';
      if (transport === 'http') {
        validateHttpServer(server.name, server, 'mcp_servers.json');
      } else if (transport === 'stdio') {
        validateLocalServer(server.name, server, 'mcp_servers.json');
      }
      if (server.disabled === undefined) {
        warn(`mcp_servers.json -> "${server.name}": nincs "disabled" mezo`);
      }
    });
  }
}

section('.vscode/mcp.json validacio');
const vscodeData = readJson('.vscode/mcp.json', '.vscode/mcp.json');
if (vscodeData) {
  if (!vscodeData.servers || typeof vscodeData.servers !== 'object') {
    fail('.vscode/mcp.json: hianyzik a "servers" objektum');
  } else {
    const names = Object.keys(vscodeData.servers);
    ok(`.vscode/mcp.json: ${names.length} szerver bejegyzes talalhato`);
    Object.entries(vscodeData.servers).forEach(([name, server]) => {
      validateGenericServer(name, server, '.vscode/mcp.json');
    });
  }
  validateInputs(vscodeData, '.vscode/mcp.json');
}

section('.github/copilot/cloud-agent-mcp-settings.json validacio');
const cloudAgentData = readJson(
  '.github/copilot/cloud-agent-mcp-settings.json',
  '.github/copilot/cloud-agent-mcp-settings.json',
);
if (cloudAgentData) {
  if (!cloudAgentData.mcpServers || typeof cloudAgentData.mcpServers !== 'object') {
    fail('.github/copilot/cloud-agent-mcp-settings.json: hianyzik az "mcpServers" objektum');
  } else {
    const names = Object.keys(cloudAgentData.mcpServers);
    ok(`.github/copilot/cloud-agent-mcp-settings.json: ${names.length} szerver bejegyzes talalhato`);
    Object.entries(cloudAgentData.mcpServers).forEach(([name, server]) => {
      validateGenericServer(name, server, '.github/copilot/cloud-agent-mcp-settings.json');
    });
  }
}

section('fastmcp.json validacio');
const fastMcpData = readJson('fastmcp.json', 'fastmcp.json');
if (fastMcpData) {
  if (!fastMcpData.source || typeof fastMcpData.source !== 'object') {
    fail('fastmcp.json: hianyzik a "source" objektum');
  } else {
    if (!fastMcpData.source.path) {
      fail('fastmcp.json: hianyzik a source.path');
    }
    if (!fastMcpData.source.entrypoint) {
      fail('fastmcp.json: hianyzik a source.entrypoint');
    }
    if (fastMcpData.source.path && fastMcpData.source.entrypoint) {
      ok(`fastmcp.json: source OK (${fastMcpData.source.path}#${fastMcpData.source.entrypoint})`);
    }
  }

  if (!fastMcpData.environment || typeof fastMcpData.environment !== 'object') {
    fail('fastmcp.json: hianyzik az "environment" objektum');
  } else {
    if (!fastMcpData.environment.python) {
      fail('fastmcp.json: hianyzik az environment.python');
    }
    if (!Array.isArray(fastMcpData.environment.dependencies) || fastMcpData.environment.dependencies.length === 0) {
      fail('fastmcp.json: az environment.dependencies nincs vagy ures');
    } else {
      ok(`fastmcp.json: ${fastMcpData.environment.dependencies.length} Python dependency deklaralva`);
      const hasFastMcpDependency = fastMcpData.environment.dependencies.some(dependency => String(dependency).startsWith('fastmcp'));
      if (!hasFastMcpDependency) {
        fail('fastmcp.json: a fastmcp dependency hianyzik az environment.dependencies listabol');
      }
    }
  }

  if (!fastMcpData.deployment || typeof fastMcpData.deployment !== 'object') {
    fail('fastmcp.json: hianyzik a "deployment" objektum');
  } else {
    const allowedTransports = new Set(['http', 'sse', 'stdio', 'streamable-http']);
    const transport = fastMcpData.deployment.transport;
    if (!transport) {
      fail('fastmcp.json: hianyzik a deployment.transport');
    } else if (!allowedTransports.has(transport)) {
      warn(`fastmcp.json: szokatlan deployment.transport (${transport})`);
    } else {
      ok(`fastmcp.json: deployment transport = ${transport}`);
    }
  }
}

section('Eredmeny');
if (exitCode === 0) {
  console.log(`[OK] ${validatedFiles} konfiguracios felulet valid.\n`);
} else {
  console.error('[HIBA] Vannak validacios hibak - lasd fent.\n');
}

process.exit(exitCode);
