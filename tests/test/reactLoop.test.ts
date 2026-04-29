import { describe, it, expect, vi } from 'vitest';
import { ReActExecutor } from '@packages/core-logic/reactLoop.js';

describe('ReActExecutor', () => {
  it('records thought-action-observation steps and returns final message', async () => {
    const reason = vi
      .fn()
      .mockResolvedValueOnce({
        thought: 'Meg kell nézni az állapotot.',
        actions: [{ name: 'get_agent_status', params: { agent_name: 'DeveloperAgent' }, toolCallId: 'call-1' }],
      })
      .mockResolvedValueOnce({
        thought: 'Már van elég információ.',
        done: true,
        finalMessage: 'Az ügynök státusza lekérdezve.',
      });

    const act = vi.fn().mockResolvedValue({
      success: true,
      summary: 'DeveloperAgent: idle',
    });

    const result = await new ReActExecutor(3).execute({ reason, act });

    expect(result.terminatedReason).toBe('done');
    expect(result.finalMessage).toBe('Az ügynök státusza lekérdezve.');
    expect(result.scratchpad).toHaveLength(1);
    expect(result.scratchpad[0]).toMatchObject({
      thought: 'Meg kell nézni az állapotot.',
      action: 'get_agent_status',
      observation: 'DeveloperAgent: idle',
      success: true,
    });
  });

  it('returns reasoning_error when the reason phase throws', async () => {
    const result = await new ReActExecutor(2).execute({
      reason: async () => {
        throw new Error('401 unauthorized');
      },
      act: async () => ({ success: true, summary: 'unused' }),
    });

    expect(result.success).toBe(false);
    expect(result.terminatedReason).toBe('reasoning_error');
    expect(result.scratchpad[0]?.errorType).toBe('AUTH_FAILED');
  });

  it('treats done without final text as success when the latest action succeeded', async () => {
    const reason = vi
      .fn()
      .mockResolvedValueOnce({
        thought: 'Delegáljuk a feladatot.',
        actions: [{ name: 'delegate_task', params: { agent_name: 'DeveloperAgent' }, toolCallId: 'call-2' }],
      })
      .mockResolvedValueOnce({
        thought: 'A szükséges side effect megtörtént.',
        done: true,
      });

    const act = vi.fn().mockResolvedValue({
      success: true,
      summary: 'A feladat kiosztva.',
    });

    const result = await new ReActExecutor(3).execute({ reason, act });

    expect(result.success).toBe(true);
    expect(result.terminatedReason).toBe('done');
    expect(result.finalMessage).toBeUndefined();
    expect(result.scratchpad[0]).toMatchObject({
      action: 'delegate_task',
      success: true,
    });
  });

  it('classifies thrown act errors instead of crashing the loop', async () => {
    const result = await new ReActExecutor(1).execute({
      reason: async () => ({
        thought: 'Hívjuk meg a toolt.',
        actions: [{ name: 'dangerous_tool', params: { id: 1 } }],
      }),
      act: async () => {
        throw new Error('429 too many requests');
      },
    });

    expect(result.success).toBe(false);
    expect(result.terminatedReason).toBe('max_cycles');
    expect(result.scratchpad[0]).toMatchObject({
      action: 'dangerous_tool',
      success: false,
      errorType: 'RATE_LIMITED',
    });
  });
});
