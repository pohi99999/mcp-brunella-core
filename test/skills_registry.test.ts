import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/utils/pythonShell.js', () => ({
  globalPythonShell: {
    run: vi.fn(async () => '{"count":2,"total":3000,"average":1500,"minimum":1000,"maximum":2000,"median":1500}'),
  },
}));

vi.mock('../src/tools/getSzamlazzInvoices.js', () => ({
  getSzamlazzInvoicesHandler: vi.fn(async () => ({
    success: true,
    data: [
      { invoice_number: 'INV-1', partner_name: 'ACME', issue_date: '2026-01-01', due_date: '2026-01-15', amount: 1000, currency: 'HUF', status: 'paid' },
      { invoice_number: 'INV-2', partner_name: 'Beta', issue_date: '2026-01-02', due_date: '2026-01-16', total: 2000, currency: 'HUF', status: 'open' },
    ],
    stats: { count: 2 },
  })),
}));

vi.mock('../src/tools/unifiedGoogleWorkspaceTool.js', () => ({
  googleWorkspaceHandler: vi.fn(async () => ({ success: true, operation: 'sheet_write', data: { updatedRows: 2 } })),
}));

vi.mock('../src/tools/evHunterTool.js', () => ({
  evHunterHandler: vi.fn(async () => ({ content: [{ type: 'text', text: 'mock ev hunter' }] })),
}));

vi.mock('../src/utils/rag.js', () => ({
  searchRAG: vi.fn(async () => [{ text: 'knowledge hit', path: 'doc.md', score: 0.9 }]),
}));

vi.mock('../src/tools/memoryTool.js', () => ({
  memoryStoreHandler: vi.fn(async () => ({ success: true })),
  memoryQueryHandler: vi.fn(async () => ({ success: true, count: 1, preferences: [] })),
  memoryContextHandler: vi.fn(async () => ({ success: true, context: {}, stats: {} })),
  memoryDeleteHandler: vi.fn(async () => ({ success: true })),
  memoryPurgeHandler: vi.fn(async () => ({ success: true, purged: 0 })),
}));

vi.mock('../src/tools/negotiationEngine.js', () => ({
  negotiationEngineHandler: vi.fn(async () => ({ success: true, data: { subject: 'Deal', body: 'Body' } })),
}));

describe('skills registry', () => {
  it('exposes the six requested skills', async () => {
    const { listSkills, getSkill, SKILL_REGISTRY } = await import('../src/skills/index.js');

    expect(listSkills()).toHaveLength(6);
    expect(new Set(Object.keys(SKILL_REGISTRY))).toEqual(new Set([
      'lead-hunter',
      'finance-report',
      'content-writer',
      'market-watch',
      'workflow-trigger',
      'negotiation',
    ]));
    expect(getSkill('finance-report')).toBeDefined();
    expect(getSkill('missing-skill')).toBeUndefined();
  });

  it('executes finance report skill with workspace write support', async () => {
    const { getSkill } = await import('../src/skills/index.js');
    const skill = getSkill('finance-report');
    expect(skill).toBeDefined();

    const result = await skill!.execute({
      spreadsheetId: 'sheet-1',
      sheetName: 'Riport',
      since_date: '2026-01-01',
      limit: 50,
    });

    const typed = result as {
      success: boolean;
      invoiceCount?: number;
      metrics?: { count: number; total: number };
      workspaceResult: unknown;
    };
    expect(typed.success).toBe(true);
    expect(typed.invoiceCount).toBe(2);
    expect(typed.metrics?.total).toBe(3000);
    expect(typed.workspaceResult).toBeDefined();
  });

  it('rejects invalid skill validation inputs', async () => {
    const { getSkill } = await import('../src/skills/index.js');
    const skill = getSkill('negotiation');
    expect(skill?.validate?.({})).toBe(false);
  });
});
