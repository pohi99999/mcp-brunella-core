import { describe, it, expect, vi } from 'vitest';
import { fireHook } from '@packages/core-logic/agentHookEngine.js';
import { phoenixEventBus } from '@packages/core-logic/phoenixEventBus.js';
import '@packages/core-logic/phoenixHookBridge.js'; // Import triggers registration

describe('PhoenixHookBridge', () => {
  it('should relay agent:task:failed hook to phoenixEventBus', async () => {
    const phoenixSpy = vi.fn();
    phoenixEventBus.subscribe('phoenix:agent_failed', phoenixSpy);

    await fireHook('agent:task:failed', { 
      agentName: 'TestAgent', 
      error: 'Simulated failure',
      task: 'test task'
    });

    expect(phoenixSpy).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'TestAgent',
      error: 'Simulated failure'
    }));
  });
});
