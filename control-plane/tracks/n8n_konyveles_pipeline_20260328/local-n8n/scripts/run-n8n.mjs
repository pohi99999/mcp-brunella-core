#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');
const envCandidates = [
  path.join(workspaceRoot, '.env'),
  path.join(workspaceRoot, '.env.example'),
];

const envPath = envCandidates.find((candidate) => existsSync(candidate));
const npmCliPath = path.join(
  process.env.ProgramFiles ?? 'C:\\Program Files',
  'nodejs',
  'node_modules',
  'npm',
  'bin',
  'npm-cli.js'
);

if (envPath) {
  loadEnvFile(envPath);

  if (path.basename(envPath) === '.env.example') {
    console.warn(
      '[n8n-local] .env is missing; using .env.example. Copy .env.example to .env to customize the local runtime.'
    );
  }
} else {
  console.warn('[n8n-local] No local env file found; using the current shell environment.');
}

const commandArgs = process.argv.slice(2);
const args = commandArgs.length > 0 ? commandArgs : ['start'];
const child = spawn(process.execPath, [npmCliPath, 'exec', '--yes', '--', 'n8n', ...args], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('error', (error) => {
  console.error(`[n8n-local] Failed to start n8n: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 0);
});

function loadEnvFile(filePath) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const entry = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const equalsIndex = entry.indexOf('=');

    if (equalsIndex < 0) {
      continue;
    }

    const key = entry.slice(0, equalsIndex).trim();
    let value = entry.slice(equalsIndex + 1).trim();

    if (!key) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
