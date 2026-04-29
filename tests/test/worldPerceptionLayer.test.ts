import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  db: undefined as Database.Database | undefined,
  ingestSignal: vi.fn(),
  fireHookSafely: vi.fn(async () => ({ status: 'fired' })),
}));

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => {
    if (!harness.db) {
      throw new Error('Test database not initialized');
    }
    return harness.db;
  }),
}));

vi.mock('@packages/core-logic/intelligenceMonitor.js', () => ({
  ingestSignal: harness.ingestSignal,
}));

vi.mock('@packages/core-logic/hookRegistry.js', () => ({
  fireHookSafely: harness.fireHookSafely,
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
}));

import {
  ignoreWorldSignal,
  ingestWorldSignal,
  listWorldSignals,
  promoteWorldSignal,
  runWorldPerceptionCycle,
} from '@packages/core-logic/worldPerceptionLayer.js';

describe('worldPerceptionLayer', () => {
  beforeEach(() => {
    harness.db = new Database(':memory:');
    harness.ingestSignal.mockReset();
    harness.fireHookSafely.mockClear();
    harness.ingestSignal.mockResolvedValue({
      id: 'int-1',
      sourceClass: 'technology',
      title: 'New AI release',
      status: 'pending_review',
      score: 0.88,
    });
  });

  afterEach(() => {
    harness.db?.close();
    harness.db = undefined;
  });

  it('ingests and deduplicates world perception signals', () => {
    const first = ingestWorldSignal({
      sourceType: 'manual',
      source: 'https://example.com/ai',
      title: 'New AI release',
      summary: 'A notable model release landed this morning.',
      domain: 'technology',
      provenance: 'https://example.com/ai',
      biasLabel: 'low',
      confidence: 0.9,
      tags: ['ai', 'release'],
    });

    const second = ingestWorldSignal({
      sourceType: 'manual',
      source: 'https://example.com/ai',
      title: 'New AI release',
      summary: 'A notable model release landed this morning.',
      domain: 'technology',
      provenance: 'https://example.com/ai',
      biasLabel: 'low',
      confidence: 0.9,
      tags: ['ai', 'release'],
    });

    const rows = listWorldSignals({ limit: 10 });

    expect(first.id).toBe(second.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.domain).toBe('technology');
    expect(rows[0]?.score).toBeGreaterThan(0.5);
  });

  it('builds world signals from recent knowledge cards during the cycle', () => {
    harness.db?.exec(`
      CREATE TABLE knowledge_cards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        tags_json TEXT,
        entities_json TEXT,
        evidence_json TEXT,
        source_refs_json TEXT,
        confidence REAL NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    harness.db?.prepare(`
      INSERT INTO knowledge_cards (
        id, title, summary, tags_json, entities_json, evidence_json, source_refs_json,
        confidence, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'card-1',
      'AI tooling update',
      'Fresh AI automation signals are emerging in the market.',
      JSON.stringify(['ai', 'automation']),
      JSON.stringify(['Brunella']),
      JSON.stringify(['https://example.com/evidence']),
      JSON.stringify(['source-1']),
      0.84,
      'canonical',
      '2026-04-11T09:00:00.000Z',
      '2026-04-11T10:00:00.000Z',
    );

    const result = runWorldPerceptionCycle(5);

    expect(result.scannedCards).toBe(1);
    expect(result.ingestedSignals).toBe(1);
    expect(result.topSignals[0]?.domain).toBe('technology');
    expect(harness.fireHookSafely).toHaveBeenCalledWith(
      'world.cycle.completed',
      expect.objectContaining({ ingestedSignals: 1 }),
      expect.anything(),
    );
  });

  it('promotes and ignores world signals through the intelligence layer', async () => {
    const promotable = ingestWorldSignal({
      sourceType: 'manual',
      source: 'market-watch',
      title: 'Market demand shift',
      summary: 'Demand appears to be shifting toward automation buyers.',
      domain: 'business',
      provenance: 'Market watch summary',
      biasLabel: 'medium',
      confidence: 0.72,
    });
    const ignorable = ingestWorldSignal({
      sourceType: 'manual',
      source: 'ops-watch',
      title: 'Noise-only signal',
      summary: 'An observation that should stay outside the queue.',
      domain: 'business',
      provenance: 'ops summary',
      biasLabel: 'unknown',
      confidence: 0.4,
    });

    const promotion = await promoteWorldSignal(promotable.id, { reviewer: 'qa' });
    const ignored = ignoreWorldSignal(ignorable.id, { reviewer: 'qa', note: 'already reviewed upstream' });

    expect(harness.ingestSignal).toHaveBeenCalledWith(expect.objectContaining({
      sourceClass: 'business',
      title: 'Market demand shift',
    }));
    expect(promotion.worldSignal.status).toBe('promoted');
    expect(promotion.worldSignal.intelligenceSignalId).toBe('int-1');
    expect(ignored.status).toBe('ignored');
    expect(() => ignoreWorldSignal(promotable.id, { reviewer: 'qa' })).toThrow('cannot be ignored');
  });
});
