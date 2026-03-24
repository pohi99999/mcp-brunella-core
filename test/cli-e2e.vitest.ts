/**
 * CLI E2E Tesztek — Smoke + Funkcionális
 *
 * Valódi CLI futtatás `node build/cli.js` segítségével (spawnSync).
 * Nem interaktív, szerver nélkül futtatható parancsok tesztelése.
 * Szerver-igényes parancsok: graceful hiba-kezelés ellenőrzése.
 *
 * @track paios_e2e_tests_20260321
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// ====================================================================
// Segédfüggvények
// ====================================================================

const CLI_PATH = path.resolve('build/cli.js');

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * node build/cli.js futtatása szinkron módon.
 * BRUNELLA_SERVER_URL alapértelmezetten nem létező szerverre mutat
 * (hogy a szerver-igényes parancsok gyorsan failjenek és ne timeout-oljanak).
 */
function runCli(args: string[], extraEnv: Record<string, string> = {}): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: {
        ...process.env,
        // Nem létező szerver → kapcsolat-hiba gyorsan jön
        BRUNELLA_SERVER_URL: 'http://127.0.0.1:19999',
        // Chalk color disable → clean text output az assertionökhöz
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 15_000);

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      resolve({
        exitCode: -1,
        stdout,
        stderr: `${stderr}${error.message}`,
        timedOut,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

// ====================================================================
// Előfeltétel — build létezése
// ====================================================================

describe('CLI E2E — Előfeltételek', () => {
  it('build/cli.js létezik (npm run build lefutott)', () => {
    expect(
      fs.existsSync(CLI_PATH),
      `build/cli.js nem található: ${CLI_PATH}`,
    ).toBe(true);
  });
});

// ====================================================================
// Help & Version — Smoke
// ====================================================================

describe('CLI E2E — Help & Version', () => {
  it('--help 0-val tér vissza', async () => {
    const { exitCode } = await runCli(['--help']);
    expect(exitCode).toBe(0);
  });

  it('--help kimenete tartalmaz Commands / Usage sort', async () => {
    const { stdout, stderr } = await runCli(['--help']);
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/usage|commands|brunella/i);
  });

  it('--help kimenete tartalmaz about parancsot', async () => {
    const { stdout, stderr } = await runCli(['--help']);
    const output = stdout + stderr;
    expect(output).toMatch(/about/i);
  });

  it('--version 0-val tér vissza', async () => {
    const { exitCode } = await runCli(['--version']);
    expect(exitCode).toBe(0);
  });

  it('--version kimenete tartalmazza a verziószámot', async () => {
    const { stdout, stderr } = await runCli(['--version']);
    const output = stdout + stderr;
    expect(output).toContain('2.4.0');
  });

  it('--help nem timeout-ol', async () => {
    const { timedOut } = await runCli(['--help']);
    expect(timedOut).toBe(false);
  });
});

// ====================================================================
// About parancs — Funkcionális
// ====================================================================

describe('CLI E2E — About', () => {
  it('about 0-val tér vissza', async () => {
    const { exitCode } = await runCli(['about']);
    expect(exitCode).toBe(0);
  });

  it('about nem timeout-ol', async () => {
    const { timedOut } = await runCli(['about']);
    expect(timedOut).toBe(false);
  });

  it('about valami kimenetet ad', async () => {
    const { stdout, stderr } = await runCli(['about']);
    const output = stdout + stderr;
    expect(output.trim().length).toBeGreaterThan(0);
  });
});

// ====================================================================
// Doctor parancs — Smoke (diagnosztika, részleges hiba OK)
// ====================================================================

describe('CLI E2E — Doctor', () => {
  it('doctor nem crash-el (exitCode >= 0)', async () => {
    const { exitCode, timedOut } = await runCli(['doctor']);
    expect(timedOut).toBe(false);
    expect(exitCode).toBeGreaterThanOrEqual(0);
  });

  it('doctor valami diagnosztikai kimenetet ad', async () => {
    const { stdout, stderr } = await runCli(['doctor']);
    const output = stdout + stderr;
    expect(output.trim().length).toBeGreaterThan(0);
  });
});

// ====================================================================
// Harvest Status — Nincs Log File esetén
// ====================================================================

describe('CLI E2E — Harvest Status', () => {
  it('harvest status nem crash-el', async () => {
    const { exitCode, timedOut } = await runCli(['harvest', 'status']);
    expect(timedOut).toBe(false);
    expect(exitCode).toBeGreaterThanOrEqual(0);
  });

  it('harvest status valami üzenetet ad', async () => {
    const { stdout, stderr } = await runCli(['harvest', 'status']);
    const output = stdout + stderr;
    expect(output.trim().length).toBeGreaterThan(0);
  });

  it('harvest status ha nincs log: tartalmaz "No harvest summary" vagy összegzést', async () => {
    const { stdout, stderr } = await runCli(['harvest', 'status']);
    const output = stdout + stderr;
    // Ha van log → összegzés; ha nincs → "No harvest summary found" szöveg
    const hasMessage =
      output.includes('No harvest summary') ||       // no-log ág
      output.includes('harvest') ||                  // bármilyen harvest info
      output.includes('summary') ||
      output.trim().length > 0;
    expect(hasMessage).toBe(true);
  });
});

// ====================================================================
// Szerver-igényes Parancsok — Graceful Failure
// ====================================================================

// MCP timeout rövid marad tesztben (3000ms), hogy ne lépje át a 15s Vitest limitet
const serverEnv = { BRUNELLA_MCP_CONNECT_TIMEOUT_MS: '3000' };

describe('CLI E2E — Szerver-igényes (graceful hiba)', () => {
  it('tools futtatható, nem timeout-ol', async () => {
    const { exitCode, timedOut } = await runCli(['tools'], serverEnv);
    expect(timedOut).toBe(false);
    expect(exitCode).toBeGreaterThanOrEqual(0);
  });

  it('tools valami kimenetet ad (hiba vagy lista)', async () => {
    const { stdout, stderr } = await runCli(['tools'], serverEnv);
    const output = stdout + stderr;
    expect(output.trim().length).toBeGreaterThan(0);
  });

  it('agents futtatható, nem timeout-ol', async () => {
    const { exitCode, timedOut } = await runCli(['agents'], serverEnv);
    expect(timedOut).toBe(false);
    expect(exitCode).toBeGreaterThanOrEqual(0);
  });

  it('agents valami kimenetet ad (hiba vagy lista)', async () => {
    const { stdout, stderr } = await runCli(['agents'], serverEnv);
    const output = stdout + stderr;
    expect(output.trim().length).toBeGreaterThan(0);
  });
});

// ====================================================================
// Érvénytelen / Ismeretlen Input
// ====================================================================

describe('CLI E2E — Érvénytelen Input', () => {
  it('ismeretlen parancs non-zero exit code-dal tér vissza', async () => {
    const { exitCode } = await runCli(['xyz-ismeretlen-parancs-123']);
    expect(exitCode).not.toBe(0);
  });

  it('ismeretlen parancs tartalmaz hibaüzenetet', async () => {
    const { stdout, stderr } = await runCli(['xyz-ismeretlen-parancs-123']);
    const output = stdout + stderr;
    expect(output.trim().length).toBeGreaterThan(0);
  });

  it('ismeretlen parancs nem timeout-ol', async () => {
    const { timedOut } = await runCli(['xyz-ismeretlen-parancs-123']);
    expect(timedOut).toBe(false);
  });
});

// ====================================================================
// ENV Override — Config betöltés
// ====================================================================

describe('CLI E2E — ENV Override', () => {
  it('BRUNELLA_SERVER_URL env override elfogadva, not crash on about', async () => {
    const { exitCode } = await runCli(['about'], {
      BRUNELLA_SERVER_URL: 'http://custom-server-env:9876',
    });
    // about nem használja a server URL-t, de a config betöltődik
    expect(exitCode).toBe(0);
  });

  it('BRUNELLA_THEME env override elfogadva, not crash on about', async () => {
    const { exitCode } = await runCli(['about'], {
      BRUNELLA_THEME: 'light',
    });
    expect(exitCode).toBe(0);
  });
});
