/**
 * briefingService.test.ts
 *
 * Unit tests for the Daily AI Agent Briefing service layer.
 * Tests SQLite schema init, dry-run behavior, persist logic, and agent invocation.
 *
 * Uses an in-memory SQLite database and mocks DailyAgentBriefingAgent directly
 * (AgentRegistry does not exist in this codebase — agents are instantiated directly).
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BriefingReport } from '@apps/mcp-core/server/services/briefingService.js';
import { initBriefingSchema, persistBriefingReport } from '@apps/mcp-core/server/services/briefingService.js';

// ── Mock DailyAgentBriefingAgent at module level ───────────────────────────
// vi.mock hoists to the top — mocks the constructor so `new DailyAgentBriefingAgent()`
// returns our mock instance inside runDailyAgentBriefing.

const mockExecuteTask = vi.fn();

vi.mock('@packages/agents/DailyAgentBriefingAgent.js', () => ({
  DailyAgentBriefingAgent: vi.fn().mockImplementation(() => ({
    executeTask: mockExecuteTask,
  })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function openTestDb(): Database.Database {
  return new Database(':memory:');
}

// ── Fixtures ───────────────────────────────────────────────────────────────

/** A correctly-shaped BriefingReport matching the service's interface. */
const MOCK_BRIEFING_REPORT: BriefingReport = {
  id: 'br-test-1',
  generatedAt: '2026-04-08T11:00:00.000Z',
  triggeredBy: 'test',
  reportDate: '2026-04-08',
  items: [
    {
      title: 'LangChain 0.3 kiadás',
      url: 'https://blog.langchain.dev/release-0.3',
      source: 'LangChain Blog',
      excerpt: 'Az új verzió bemutatja az ágens memória modul javításait és az újratervezett tool-calling API-t.',
      relevance: 'Memoria réteg érintett.',
      brunellaLayers: ['memoria', 'cortex'],
      adoptionStatus: 'prototype',
      adoptionNote: 'Érdemes prototípusra emelni, mert az agent guidance és tool-calling réteghez kapcsolódik.',
      publishedAt: '2026-04-07T10:00:00.000Z',
    },
  ],
  markdownPath: '/tmp/test-briefing.md',
  usedLLM: false,
  dryRun: false,
};

/**
 * AgentResult returned by a successful DailyAgentBriefingAgent.executeTask() call.
 * The service reads `data.reportDate`, `data.reportPath`, `data.usedLLM`.
 */
const MOCK_AGENT_RESULT = {
  success: true,
  message: 'Briefing kész',
  data: {
    reportDate: '2026-04-08',
    reportPath: '/tmp/test-briefing.md',
    usedLLM: false,
    githubSignalsCount: 3,
    pageSignalsCount: 2,
    briefingItemsCount: 1,
    items: MOCK_BRIEFING_REPORT.items,
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('briefingService — initBriefingSchema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it('creates the ai_agent_briefing_reports table', () => {
    initBriefingSchema(db);

    const row = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'ai_agent_briefing_reports'`,
      )
      .get() as { name: string } | undefined;

    expect(row).toBeDefined();
    expect(row?.name).toBe('ai_agent_briefing_reports');
  });

  it('creates required indexes', () => {
    initBriefingSchema(db);

    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'index' AND tbl_name = 'ai_agent_briefing_reports'`,
      )
      .all() as Array<{ name: string }>;

    const names = indexes.map((i) => i.name);
    expect(names).toContain('idx_briefing_reports_generated_at');
    expect(names).toContain('idx_briefing_reports_report_date');
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => {
      initBriefingSchema(db);
      initBriefingSchema(db);
    }).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe('briefingService — persistBriefingReport', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openTestDb();
    initBriefingSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('inserts a row for a successful briefing result', () => {
    persistBriefingReport(db, MOCK_BRIEFING_REPORT);

    const row = db
      .prepare('SELECT * FROM ai_agent_briefing_reports LIMIT 1')
      .get() as Record<string, unknown> | undefined;

    expect(row).toBeDefined();
    expect(row?.id).toBe(MOCK_BRIEFING_REPORT.id);
    expect(row?.report_date).toBe('2026-04-08');
    expect(row?.items_count).toBe(1);
    // 2 unique layers ('memoria', 'cortex')
    expect(row?.brunella_layers_count).toBe(2);
    expect(row?.triggered_by).toBe('test');
  });

  it('stores the full JSON in report_json', () => {
    persistBriefingReport(db, MOCK_BRIEFING_REPORT);

    const row = db
      .prepare('SELECT report_json FROM ai_agent_briefing_reports LIMIT 1')
      .get() as { report_json: string } | undefined;

    expect(row).toBeDefined();
    const parsed = JSON.parse(row!.report_json) as BriefingReport;
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].title).toBe('LangChain 0.3 kiadás');
    expect(parsed.items[0].brunellaLayers).toEqual(['memoria', 'cortex']);
    expect(parsed.items[0].adoptionStatus).toBe('prototype');
    expect(parsed.items[0].adoptionNote).toContain('tool-calling');
  });

  it('calling persistBriefingReport twice with different IDs inserts two rows', () => {
    persistBriefingReport(db, MOCK_BRIEFING_REPORT);
    persistBriefingReport(db, { ...MOCK_BRIEFING_REPORT, id: 'br-test-2', reportDate: '2026-04-09' });

    const count = (db.prepare('SELECT COUNT(*) as c FROM ai_agent_briefing_reports').get() as { c: number }).c;
    expect(count).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe('briefingService — runDailyAgentBriefing (mocked agent)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openTestDb();
    initBriefingSchema(db);
    mockExecuteTask.mockReset();
  });

  afterEach(() => {
    db.close();
  });

  it('persists a row when dryRun is false', async () => {
    mockExecuteTask.mockResolvedValue(MOCK_AGENT_RESULT);

    const { runDailyAgentBriefing } = await import('@apps/mcp-core/server/services/briefingService.js');
    const result = await runDailyAgentBriefing({ db, triggeredBy: 'test', dryRun: false });

    expect(result).toBeDefined();
    expect(result.triggeredBy).toBe('test');
    expect(result.dryRun).toBe(false);
    expect(mockExecuteTask).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);

    const row = db
      .prepare('SELECT id, triggered_by, items_count, brunella_layers_count FROM ai_agent_briefing_reports LIMIT 1')
      .get() as { id: string; triggered_by: string; items_count: number; brunella_layers_count: number } | undefined;
    expect(row).toBeDefined();
    expect(row?.triggered_by).toBe('test');
    expect(row?.items_count).toBe(1);
    expect(row?.brunella_layers_count).toBe(2);
  });

  it('does NOT persist when dryRun is true', async () => {
    mockExecuteTask.mockResolvedValue({ ...MOCK_AGENT_RESULT, data: { ...MOCK_AGENT_RESULT.data } });

    const { runDailyAgentBriefing } = await import('@apps/mcp-core/server/services/briefingService.js');
    const result = await runDailyAgentBriefing({ db, triggeredBy: 'test', dryRun: true });

    expect(result.dryRun).toBe(true);

    const count = (db.prepare('SELECT COUNT(*) as c FROM ai_agent_briefing_reports').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('throws when the agent returns success=false', async () => {
    mockExecuteTask.mockResolvedValue({ success: false, message: 'Valami hiba történt', data: null });

    const { runDailyAgentBriefing } = await import('@apps/mcp-core/server/services/briefingService.js');
    await expect(runDailyAgentBriefing({ db, triggeredBy: 'test', dryRun: false })).rejects.toThrow(
      'Valami hiba történt',
    );

    // Nothing persisted on failure
    const count = (db.prepare('SELECT COUNT(*) as c FROM ai_agent_briefing_reports').get() as { c: number }).c;
    expect(count).toBe(0);
  });
});
