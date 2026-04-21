/**
 * startPythonServer — FastAPI test helper
 *
 * Felindítja a Python bridge szervert (uvicorn) az integrációs
 * tesztekhez, 8099-es porton (nem ütközik a 8000-es dev porttal).
 * beforeAll / afterAll hook-okból hívható.
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

/** A Python FastAPI szerver portja — szándékosan különbözik a 8000-es dev portjától. */
export const PYTHON_TEST_PORT = 8099;
export const PYTHON_TEST_HOST = '127.0.0.1';

const HEALTH_URL = `http://${PYTHON_TEST_HOST}:${PYTHON_TEST_PORT}/health`;
const POLL_INTERVAL_MS = 500;
const MAX_WAIT_MS = 15_000;
let serverProcess: ChildProcess | null = null;

/**
 * Elindítja a FastAPI szervert és megvárja, amíg a /health endpoint
 * elérhető lesz (max 15 s). Dobja el az Error-t, ha nem jön fel.
 */
export async function startPythonServer(): Promise<void> {
  serverProcess = spawn(
    'uv',
    ['run', 'uvicorn', 'server:app', '--host', PYTHON_TEST_HOST, '--port', String(PYTHON_TEST_PORT), '--app-dir', 'myai'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      // Windows-on shell kell az uv feloldásához; a host fixen 127.0.0.1.
      shell: true,
    },
  );

  serverProcess.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text.length > 0) {
      console.warn('[python-server]', text);
    }
  });

  serverProcess.on('error', (err: Error) => {
    console.error('[python-server] spawn hiba:', err.message);
  });

  // Poll /health amíg a szerver nem válaszol vagy le nem jár az idő
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) {
        return; // Szerver kész
      }
    } catch {
      // Még nem érhető el — következő iterációban próbáljuk
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Python szerver (port ${PYTHON_TEST_PORT}) nem indult el ${MAX_WAIT_MS}ms-on belül.`,
  );
}

/**
 * Leállítja a FastAPI szervert. afterAll hook-ból hívandó.
 */
export function stopPythonServer(): void {
  if (serverProcess != null) {
    serverProcess.kill();
    serverProcess = null;
  }
}
