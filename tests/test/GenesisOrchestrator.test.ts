import { describe, it, expect } from 'vitest';
import { GenesisOrchestrator } from '@packages/agents/GenesisOrchestrator.js';
import type { AgentContext } from '@packages/agents/BaseAgent.js';
import type { SpecDocument } from '@packages/types/blueprint.js';

describe('GenesisOrchestrator spec guard', () => {
  it('returns the existing missing-spec message when metadata.spec is absent', async () => {
    const orchestrator = new GenesisOrchestrator();

    const result = await orchestrator.execute('futtasd a genesis protokolt');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Hiányzó SpecDocument (metadata.spec). Először generálj egyet a SpecWriterAgent-tel.');
  });

  it('succeeds with a minimal valid spec and empty task queue', async () => {
    const orchestrator = new GenesisOrchestrator();
    const spec = {
      blueprint_id: 'bp-1',
      app_name: 'Test App',
      generated_at: new Date().toISOString(),
      module_specs: [],
      dependency_order: [],
      total_tasks: 0,
      total_estimated_hours: 0,
      agent_task_queue: [],
    } satisfies SpecDocument;

    const context: AgentContext = {
      task: 'futtasd a genesis protokolt',
      metadata: { spec },
    };

    const result = await orchestrator.execute('futtasd a genesis protokolt', context);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Genesis protokoll befejezve');
    expect(result.data).toMatchObject({
      app_name: 'Test App',
      total: 0,
      completed: 0,
    });
  });
});
