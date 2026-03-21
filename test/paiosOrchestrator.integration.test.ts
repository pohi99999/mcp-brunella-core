/**
 * PAIOS Orchestrator REST API — Integrációs Tesztek (supertest)
 *
 * Valódi HTTP kéréseket küld a mountolt Express routernek.
 * Mockolja a külső függőségeket (UniversalOrchestratorService, SocketService, AgentManager, paiosConfig).
 *
 * @track paios_e2e_tests_20260321
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// --- MOCK-OK (modulok nem töltődnek be ténylegesen) ---

const mockProcess = vi.fn();
const mockListAgents = vi.fn();
const mockEmit = vi.fn();
const mockLoadPaiosConfig = vi.fn();

vi.mock('../src/core/universalOrchestratorService.js', () => ({
  getUniversalOrchestratorService: vi.fn(() => ({
    process: mockProcess,
  })),
}));

vi.mock('../src/server/SocketService.js', () => ({
  socketService: {
    emit: mockEmit,
  },
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    listAgents: mockListAgents,
  },
}));

vi.mock('../src/config/paiosConfig.js', () => ({
  loadPaiosConfig: mockLoadPaiosConfig,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// --- APP SETUP ---

async function buildTestApp() {
  const { default: router } = await import('../src/server/routes/paiosOrchestrator.js');
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
}

// --- MOCK ADAT GYÁR ---

function makeMockUniversalResponse(overrides: Record<string, unknown> = {}) {
  return {
    reply: 'Mock válasz az orchestratortól',
    actionsTriggered: [
      { agent: 'SpecWriterAgent', task: 'Spec írás', taskId: 1001, status: 'started' },
    ],
    provider: 'github',
    thinkingMs: 42,
    sessionId: 'test-session-abc',
    suggestions: ['Mutasd a progresszt'],
    missionTimeline: [
      { phase: 'intake', status: 'started', detail: 'Kérés fogadva', timestamp: new Date().toISOString() },
    ],
    approvalRequired: false,
    riskLevel: 'low',
    runbookHint: 'Runbook: 1 futás',
    ...overrides,
  };
}

// --- TESZTEK ---

describe('PAIOS Orchestrator — Integrációs Tesztek', () => {
  let app: ReturnType<typeof express>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  // ====================================================================
  // POST /chat — Kérés Validáció
  // ====================================================================
  describe('POST /chat — Kérés Validáció', () => {
    it('400 — hiányzó message mező', async () => {
      const res = await request(app)
        .post('/chat')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: 'message is required',
      });
    });

    it('400 — üres message (csak szóközök)', async () => {
      const res = await request(app)
        .post('/chat')
        .send({ message: '   ' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — null message', async () => {
      const res = await request(app)
        .post('/chat')
        .send({ message: null })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ====================================================================
  // POST /chat — Sikeres Válasz
  // ====================================================================
  describe('POST /chat — Sikeres Válasz', () => {
    it('200 — siker, taskokkal', async () => {
      mockProcess.mockResolvedValueOnce(makeMockUniversalResponse());

      const res = await request(app)
        .post('/chat')
        .send({ message: 'Készíts egy API végpontot' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reply).toBe('Mock válasz az orchestratortól');
      expect(res.body.provider).toBe('github');
      expect(res.body.sessionId).toBe('test-session-abc');
      expect(Array.isArray(res.body.taskIds)).toBe(true);
      expect(res.body.taskIds).toContain(1001);
      expect(Array.isArray(res.body.actionsTriggered)).toBe(true);
      expect(Array.isArray(res.body.missionTimeline)).toBe(true);
    });

    it('200 — siker, task nélkül (nincs Socket.IO broadcast)', async () => {
      mockProcess.mockResolvedValueOnce(
        makeMockUniversalResponse({ actionsTriggered: [] })
      );

      const res = await request(app)
        .post('/chat')
        .send({ message: 'Egyszerű kérdés' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.taskIds).toEqual([]);
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('200 — Socket.IO broadcast taskokkal', async () => {
      mockProcess.mockResolvedValueOnce(makeMockUniversalResponse());

      await request(app)
        .post('/chat')
        .send({ message: 'Feladat delegálás' })
        .set('Content-Type', 'application/json');

      expect(mockEmit).toHaveBeenCalledWith('paios:tasks_created', expect.objectContaining({
        taskIds: [1001],
      }));
    });

    it('200 — egyéni provider ("gemini")', async () => {
      mockProcess.mockResolvedValueOnce(makeMockUniversalResponse({ provider: 'gemini' }));

      const res = await request(app)
        .post('/chat')
        .send({ message: 'Teszt kérés', provider: 'gemini' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'gemini',
      }));
    });

    it('200 — model mező provider-ként értelmezve', async () => {
      mockProcess.mockResolvedValueOnce(makeMockUniversalResponse({ provider: 'github' }));

      const res = await request(app)
        .post('/chat')
        .send({ message: 'Teszt', model: 'github' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'github',
      }));
    });

    it('200 — conversationHistory átadva a service-nek', async () => {
      mockProcess.mockResolvedValueOnce(makeMockUniversalResponse());

      const history = [
        { role: 'user', content: 'Előző üzenet' },
        { role: 'assistant', content: 'Előző válasz' },
      ];

      await request(app)
        .post('/chat')
        .send({ message: 'Folytatás', conversationHistory: history })
        .set('Content-Type', 'application/json');

      expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({
        conversationHistory: history,
      }));
    });

    it('200 — approvalRequired jelzés visszaadva', async () => {
      mockProcess.mockResolvedValueOnce(makeMockUniversalResponse({
        approvalRequired: true,
        approvalId: 'approval-xyz',
        riskLevel: 'high',
      }));

      const res = await request(app)
        .post('/chat')
        .send({ message: 'Kockázatos feladat' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.approvalRequired).toBe(true);
      expect(res.body.approvalId).toBe('approval-xyz');
      expect(res.body.riskLevel).toBe('high');
    });
  });

  // ====================================================================
  // POST /chat — Hibakezelés
  // ====================================================================
  describe('POST /chat — Hibakezelés', () => {
    it('500 — service hiba', async () => {
      mockProcess.mockRejectedValueOnce(new Error('LLM api hiba'));

      const res = await request(app)
        .post('/chat')
        .send({ message: 'Teszt kérés' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('LLM api hiba');
      expect(res.body.taskIds).toEqual([]);
      expect(res.body.plan).toEqual([]);
    });

    it('500 — string hiba objektum', async () => {
      mockProcess.mockRejectedValueOnce('Rate limit exceeded');

      const res = await request(app)
        .post('/chat')
        .send({ message: 'Teszt' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Rate limit exceeded');
    });
  });

  // ====================================================================
  // GET /status — Agent Registry
  // ====================================================================
  describe('GET /status — Agent Registry', () => {
    it('200 — agent lista visszaadva', async () => {
      const agents = [
        { name: 'SpecWriterAgent', description: 'Spec írás', status: 'idle' },
        { name: 'DeveloperAgent', description: 'Kód írás', status: 'working' },
      ];
      mockListAgents.mockReturnValueOnce(agents);

      const res = await request(app).get('/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.agents).toEqual(agents);
      expect(res.body.totalAgents).toBe(2);
    });

    it('200 — üres agent lista', async () => {
      mockListAgents.mockReturnValueOnce([]);

      const res = await request(app).get('/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.agents).toEqual([]);
      expect(res.body.totalAgents).toBe(0);
    });
  });

  // ====================================================================
  // GET /config — PAIOS Konfig
  // ====================================================================
  describe('GET /config — PAIOS Konfig', () => {
    it('200 — konfig visszaadva', async () => {
      const config = {
        orchestrator: { default_model: 'gemini', max_tasks_per_request: 5 },
        providers: {
          gemini: { enabled: true, model: 'gemini-2.0-flash-exp', api_key_env: 'GEMINI_API_KEY' },
        },
      };
      mockLoadPaiosConfig.mockReturnValueOnce(config);

      const res = await request(app).get('/config');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        orchestrator: { default_model: 'gemini' },
      });
    });
  });
});
