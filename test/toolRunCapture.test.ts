import { beforeEach, describe, expect, it, vi } from 'vitest';

const toolHarness = vi.hoisted(() => ({
  recordToolRun: vi.fn(),
  fireHook: vi.fn(async () => ({ status: 'fired' })),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/utils/globalDb.js', () => ({
  recordToolRun: toolHarness.recordToolRun,
}));

vi.mock('../src/core/hookRegistry.js', () => ({
  fireHook: toolHarness.fireHook,
  fireHookSafely: toolHarness.fireHook,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: toolHarness.logInfo,
  logWarn: toolHarness.logWarn,
  logError: toolHarness.logError,
}));

import { wrapToolHandler } from '../src/core/toolRunCapture.js';

describe('wrapToolHandler hook integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits tool:before and tool:after for successful tool runs', async () => {
    const wrapped = wrapToolHandler('demo_tool', async (value: number) => ({ ok: true, value }));

    const result = await wrapped(7);

    expect(result).toEqual({ ok: true, value: 7 });
    expect(toolHarness.fireHook).toHaveBeenNthCalledWith(
      1,
      'tool:before',
      expect.objectContaining({ toolName: 'demo_tool', args: 7 }),
      expect.anything(),
    );
    expect(toolHarness.fireHook).toHaveBeenNthCalledWith(
      2,
      'tool:after',
      expect.objectContaining({ toolName: 'demo_tool', success: true }),
      expect.anything(),
    );
  });

  it('emits tool:error when the wrapped handler throws', async () => {
    const wrapped = wrapToolHandler('broken_tool', async () => {
      throw new Error('boom');
    });

    await expect(wrapped()).rejects.toThrow('boom');
    expect(toolHarness.fireHook).toHaveBeenNthCalledWith(
      1,
      'tool:before',
      expect.objectContaining({ toolName: 'broken_tool' }),
      expect.anything(),
    );
    expect(toolHarness.fireHook).toHaveBeenNthCalledWith(
      2,
      'tool:error',
      expect.objectContaining({ toolName: 'broken_tool', error: 'boom' }),
      expect.anything(),
    );
  });
});
