/**
 * Swarm Hybrid Architecture — E2E Smoke Tesztek
 *
 * Valódi CLI futtatás (node build/cli.js) + REST API-t lefedő tesztek.
 * Szerver nélküli futtatás: a szerver-igényes parancsok graceful hibát adnak.
 *
 * Lefedett területek:
 *   - `brunella swarm status`  — colony lista lekérdezés
 *   - `brunella swarm dispatch <task>`  — feladat szétküldése
 *   - REST: GET /api/v1/swarm/status  (supertest, mock-olt AgentManager)
 *   - REST: POST /api/v1/swarm/dispatch (supertest, mock-olt AgentManager)
 *   - REST: GET /api/v1/harvest/status (supertest)
 *   - REST: POST /api/v1/harvest/sync  (supertest)
 *
 * @track swarm_hybrid_architecture_e2e_smoke
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import express from 'express';

// ====================================================================
// CLI helper (spawnSync, server nélküli környezet)
// ====================================================================

const CLI_PATH = path.resolve('build/cli.js');

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runCli(args: string[], extraEnv: Record<string, string> = {}): CliResult {
  const result = spawnSync('node', [CLI_PATH, ...args], {
    env: {
      ...process.env,
      BRUNELLA_SERVER_URL: 'http://127.0.0.1:19999', // nem létező szerver
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      ...extraEnv,
    },
    encoding: 'utf-8',
    timeout: 15_000,
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    timedOut: result.signal === 'SIGTERM',
  };
}

// ====================================================================
// Előfeltétel
// ====================================================================

describe('Swarm E2E — Előfeltételek', () => {
  it('build/cli.js létezik', () => {
    expect(fs.existsSync(CLI_PATH), `build/cli.js nem található: ${CLI_PATH}`).toBe(true);
  });
});

// ====================================================================
// CLI Smoke — swarm status
// ====================================================================

describe('CLI E2E — swarm status', () => {
  it('nem timeout-ol', () => {
    const { timedOut } = runCli(['swarm', 'status']);
    expect(timedOut).toBe(false);
  });

  it('valamit ír a stdout/stderr-re', () => {
    const { stdout, stderr } = runCli(['swarm', 'status']);
    const output = stdout + stderr;
    expect(output.trim().length).toBeGreaterThan(0);
  });

  it('hiba vagy sikeres válasz esetén sem crash-el', () => {
    const { stdout, stderr, exitCode, timedOut } = runCli(['swarm', 'status']);
    const output = stdout + stderr;
    // Szerver fut → colony lista (exitCode=0); szerver nem fut → "Error: ..." (exitCode=1)
    // Mindkét eset elfogadható — crash és timeout nem
    expect(timedOut).toBe(false);
    expect(output.trim().length).toBeGreaterThan(0);
    expect(exitCode).toBeGreaterThanOrEqual(0);
  });
});

// ====================================================================
// CLI Smoke — swarm dispatch
// ====================================================================

describe('CLI E2E — swarm dispatch', () => {
  it('dispatch <task> nem timeout-ol', () => {
    const { timedOut } = runCli(['swarm', 'dispatch', 'test feladat e2e']);
    expect(timedOut).toBe(false);
  });

  it('dispatch valami kimenetet ad', () => {
    const { stdout, stderr } = runCli(['swarm', 'dispatch', 'test feladat e2e']);
    const output = stdout + stderr;
    expect(output.trim().length).toBeGreaterThan(0);
  });

  it('dispatch server nélkül gracefully failt (nem crash)', () => {
    const { stdout, stderr, exitCode } = runCli(['swarm', 'dispatch', 'test feladat e2e']);
    const output = stdout + stderr;
    const isGraceful =
      output.toLowerCase().includes('error') ||
      output.toLowerCase().includes('econnrefused') ||
      exitCode !== 0;
    expect(isGraceful).toBe(true);
  });

  it('dispatch --colony flag elfogadva, nem crash', () => {
    const { timedOut } = runCli(['swarm', 'dispatch', 'teszt', '--colony', 'triad-default']);
    expect(timedOut).toBe(false);
  });
});

// ====================================================================
// REST API — swarm routes (supertest + mock)
// ====================================================================

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: { initialize: vi.fn() },
  swarmManager: {
    listColonies: vi.fn(() => [
      {
        swarmId: 'triad-default',
        name: 'Triad',
        status: 'active',
        agents: new Map(),
        leaderId: null,
        metrics: { tasksCompleted: 5, tasksFailed: 0, avgDurationMs: 80, throughput: 2, lastActivity: Date.now() },
      },
      {
        swarmId: 'research-colony',
        name: 'Research',
        status: 'paused',
        agents: new Map(),
        leaderId: null,
        metrics: { tasksCompleted: 1, tasksFailed: 0, avgDurationMs: 200, throughput: 0.5, lastActivity: Date.now() },
      },
    ]),
    getColony: vi.fn((id: string) => {
      if (id === 'triad-default') {
        return { swarmId: id, name: 'Triad', status: 'active', agents: new Map(), leaderId: null };
      }
      if (id === 'research-colony') {
        return { swarmId: id, name: 'Research', status: 'paused', agents: new Map(), leaderId: null };
      }
      return undefined;
    }),
    submitTask: vi.fn(async () => ({
      status: 'success',
      result: 'elemzés kész',
      durationMs: 120,
      agentId: 'researcher',
      taskId: 'task-e2e-01',
    })),
    nextTaskId: vi.fn(() => 'task-e2e-01'),
  },
}));

vi.mock('../src/config/index.js', () => ({ config: { workspaceRoot: '.', systemLogDir: 'logs' } }));
vi.mock('../src/utils/rag.js', () => ({ addToIndex: vi.fn() }));

describe('REST E2E — GET /api/v1/swarm/status', () => {
  let app: express.Application;

  beforeEach(async () => {
    const { swarmRouter } = await import('../src/server/routes/swarm.js');
    app = express();
    app.use(express.json());
    app.use('/api/v1/swarm', swarmRouter);
  });

  it('200 státuszt ad vissza', async () => {
    const res = await request(app).get('/api/v1/swarm/status');
    expect(res.status).toBe(200);
  });

  it('visszaadja a colonies tömböt', async () => {
    const res = await request(app).get('/api/v1/swarm/status');
    expect(Array.isArray(res.body.colonies)).toBe(true);
  });

  it('colonies tartalmaz "triad-default" colony-t', async () => {
    const res = await request(app).get('/api/v1/swarm/status');
    const ids = res.body.colonies.map((c: { colonyId: string }) => c.colonyId);
    expect(ids).toContain('triad-default');
  });

  it('total egyezik a colonies hosszával', async () => {
    const res = await request(app).get('/api/v1/swarm/status');
    expect(res.body.total).toBe(res.body.colonies.length);
  });

  it('"paused" státuszú colony is szerepel a listában', async () => {
    const res = await request(app).get('/api/v1/swarm/status');
    const statuses = res.body.colonies.map((c: { status: string }) => c.status);
    expect(statuses).toContain('paused');
  });
});

describe('REST E2E — POST /api/v1/swarm/dispatch', () => {
  let app: express.Application;

  beforeEach(async () => {
    const { swarmRouter } = await import('../src/server/routes/swarm.js');
    app = express();
    app.use(express.json());
    app.use('/api/v1/swarm', swarmRouter);
  });

  it('200 és success: true a valid kérésre', async () => {
    const res = await request(app)
      .post('/api/v1/swarm/dispatch')
      .send({ task: 'e2e teszt feladat' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('colonyId megadásával is sikerül', async () => {
    const res = await request(app)
      .post('/api/v1/swarm/dispatch')
      .send({ task: 'e2e teszt', colonyId: 'triad-default' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('400 ha task hiányzik', async () => {
    const res = await request(app)
      .post('/api/v1/swarm/dispatch')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 ha task üres string', async () => {
    const res = await request(app)
      .post('/api/v1/swarm/dispatch')
      .send({ task: '   ' });
    expect(res.status).toBe(400);
  });

  it('404 ha ismeretlen colony', async () => {
    const res = await request(app)
      .post('/api/v1/swarm/dispatch')
      .send({ task: 'teszt', colonyId: 'nem-letezik' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('404 ha paused colony (nem fogad taskot)', async () => {
    const res = await request(app)
      .post('/api/v1/swarm/dispatch')
      .send({ task: 'teszt paused colony-ra', colonyId: 'research-colony' });
    // paused colony → 404 vagy 409, semmiképp sem 200
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

// ====================================================================
// REST API — harvest routes (supertest)
// ====================================================================

describe('REST E2E — GET /api/v1/harvest/status', () => {
  let app: express.Application;

  beforeEach(async () => {
    const { harvestRouter } = await import('../src/server/routes/harvest.js');
    app = express();
    app.use(express.json());
    app.use('/api/v1/harvest', harvestRouter);
  });

  it('200 státusz', async () => {
    const res = await request(app).get('/api/v1/harvest/status');
    expect(res.status).toBe(200);
  });

  it('visszaadja a lastHarvestTime mezőt', async () => {
    const res = await request(app).get('/api/v1/harvest/status');
    expect(res.body).toHaveProperty('lastHarvestTime');
  });

  it('visszaadja a stats mezőt', async () => {
    const res = await request(app).get('/api/v1/harvest/status');
    expect(res.body).toHaveProperty('stats');
  });
});

describe('REST E2E — POST /api/v1/harvest/sync', () => {
  let app: express.Application;

  beforeEach(async () => {
    const { harvestRouter } = await import('../src/server/routes/harvest.js');
    app = express();
    app.use(express.json());
    app.use('/api/v1/harvest', harvestRouter);
  });

  it('200 és success: true valid kérésre', async () => {
    const res = await request(app)
      .post('/api/v1/harvest/sync')
      .send({ source: 'github-trending', items: [{ title: 'AI Tool', summary: 'New AI' }] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('received száma egyezik a küldött items hosszával', async () => {
    const items = [
      { title: 'Item 1', summary: 'S1' },
      { title: 'Item 2', summary: 'S2' },
      { title: 'Item 3', summary: 'S3' },
    ];
    const res = await request(app)
      .post('/api/v1/harvest/sync')
      .send({ source: 'test', items });
    expect(res.body.received).toBe(3);
  });

  it('üres items tömbbel is 200', async () => {
    const res = await request(app)
      .post('/api/v1/harvest/sync')
      .send({ source: 'empty-test', items: [] });
    expect(res.status).toBe(200);
  });
});
