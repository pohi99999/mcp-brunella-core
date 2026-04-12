import { describe, it, expect, vi } from 'vitest';
import { fireHook } from '../src/core/agentHookEngine.js';
import { phoenixEventBus } from '../src/core/phoenixEventBus.js';
import '../src/core/phoenixHookBridge.js'; // Import triggers registration

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
