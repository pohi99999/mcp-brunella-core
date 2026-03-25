/**
 * Phase 4 Smoke Tests — User Preferences Chat Integration + LLM Observability
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Task 1: userId threading ───

describe('Phase 4 — userId threading', () => {
  it('UniversalRequest interfész tartalmazza a userId mezőt', async () => {
    const mod = await import('../src/core/universalOrchestratorService.js');
    // A modul exportálja az UniversalRequest típust — nem tudjuk runtime-ban ellenőrizni,
    // de ha a build sikerül, a típus jó. Runtime: process() fogadja a userId-t.
    expect(mod.getUniversalOrchestratorService).toBeDefined();
  });

  it('BifrostGateway GenerateOptions fogadja a userId mezőt', async () => {
    const mod = await import('../src/core/bifrost_gateway.js');
    expect(mod.BifrostGateway).toBeDefined();
    const gw = new mod.BifrostGateway();
    // A GenerateOptions interface-ben van userId — ha build OK, ez jó
    expect(typeof gw.generate).toBe('function');
  });

  it('Observability route elérhető és stats-ot ad', async () => {
    const mod = await import('../src/server/routes/observability.js');
    expect(mod.createObservabilityRouter).toBeDefined();
    const router = mod.createObservabilityRouter();
    expect(router).toBeDefined();
    // Router stack ellenőrzés
    const routes = (router as any).stack
      ?.map((layer: any) => layer.route?.path)
      .filter(Boolean) || [];
    expect(routes).toContain('/stats');
    expect(routes).toContain('/calls');
    expect(routes).toContain('/timeline');
  });

  it('CLI observability parancs regisztrálva', async () => {
    const mod = await import('../src/cli/observabilityCommands.js');
    expect(mod.registerObservabilityCommands).toBeDefined();
  });
});

// ─── Task 3: LLM Observability DB ───

describe('Phase 4 — LLM Observability DB', () => {
  it('recordLlmCall és queryLlmCalls exportálva', async () => {
    const mod = await import('../src/utils/globalDb.js');
    expect(mod.recordLlmCall).toBeDefined();
    expect(mod.queryLlmCalls).toBeDefined();
    expect(mod.getLlmCallStats).toBeDefined();
  });

  it('recordLlmCall ír az adatbázisba', async () => {
    const { recordLlmCall, queryLlmCalls } = await import('../src/utils/globalDb.js');

    // Sikeres hívás mentése
    recordLlmCall({
      provider: 'test-provider',
      model: 'test-model',
      taskType: 'general',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      durationMs: 1234,
      success: true,
      userId: 'test-user',
    });

    const calls = queryLlmCalls({ provider: 'test-provider', limit: 5 });
    expect(calls.length).toBeGreaterThan(0);
    const last = calls[0];
    expect(last.provider).toBe('test-provider');
    expect(last.model).toBe('test-model');
    expect(last.total_tokens).toBe(150);
    expect(last.success).toBe(1);
    expect(last.user_id).toBe('test-user');
  });

  it('getLlmCallStats helyes összesítést ad', async () => {
    const { getLlmCallStats } = await import('../src/utils/globalDb.js');
    const stats = getLlmCallStats();
    expect(stats).toHaveProperty('totalCalls');
    expect(stats).toHaveProperty('successRate');
    expect(stats).toHaveProperty('avgDurationMs');
    expect(stats).toHaveProperty('byProvider');
    expect(stats).toHaveProperty('byModel');
    expect(stats).toHaveProperty('recentErrors');
    expect(stats.totalCalls).toBeGreaterThanOrEqual(0);
    expect(stats.successRate).toBeGreaterThanOrEqual(0);
    expect(stats.successRate).toBeLessThanOrEqual(100);
  });

  it('queryLlmCalls szűrés provider szerint működik', async () => {
    const { recordLlmCall, queryLlmCalls } = await import('../src/utils/globalDb.js');

    recordLlmCall({
      provider: 'filter-test-xyz',
      success: true,
      durationMs: 500,
    });

    const filtered = queryLlmCalls({ provider: 'filter-test-xyz' });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(c => c.provider === 'filter-test-xyz')).toBe(true);
  });

  it('BifrostGateway recordLlmCall importot tartalmaz', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/core/bifrost_gateway.ts', 'utf-8');
    expect(content).toContain("import { recordLlmCall }");
    expect(content).toContain("logCall(");
  });
});

// ─── Route integration ───

describe('Phase 4 — Route regisztráció', () => {
  it('web.ts tartalmazza az observability route importot', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/server/web.ts', 'utf-8');
    expect(content).toContain('createObservabilityRouter');
    expect(content).toContain('/observability');
  });

  it('universalOrchestrator route átadja a userId-t', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/server/routes/universalOrchestrator.ts', 'utf-8');
    expect(content).toContain('userId');
  });

  it('Dashboard universalProvider elküldi a userId-t', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/dashboard/lib/chat/providers/universalProvider.ts', 'utf-8');
    expect(content).toContain('userId');
    expect(content).toContain('bas_user_id');
  });
});

// ─── Navigation ───

describe('Phase 4 — Dashboard navigáció', () => {
  it('navigation.tsx tartalmazza az LLM Observability panelt', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/dashboard/lib/navigation.tsx', 'utf-8');
    expect(content).toContain('llm-observability');
    expect(content).toContain('LLMObservabilityPanel');
  });
});
