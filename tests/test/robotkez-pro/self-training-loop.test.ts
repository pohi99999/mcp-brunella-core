import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelfTrainingLoop } from '../../src/orchestrator/self_training_loop.js';
import fs from 'fs/promises';

describe('SelfTrainingLoop', () => {
  let stl: SelfTrainingLoop;

  beforeEach(() => {
    stl = new SelfTrainingLoop();
    vi.clearAllMocks();
    // Prevent actual file system writing during tests
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined as any);
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined as any);
  });

  it('should escalate through strategies until success', async () => {
    // Mock an action that fails 2 times then succeeds
    let attempts = 0;
    const actionFn = vi.fn().mockImplementation(async (strategy: string) => {
      attempts++;
      return attempts === 3; // Succeeds on the 3rd try ('Native Computer Use (Coordinate Click)')
    });

    const result = await stl.executeWithRetry('task-123', 'Test task', actionFn);

    expect(result).toBe(true);
    expect(actionFn).toHaveBeenCalledTimes(3);
    // Should have saved the successful strategy
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should return false if all strategies fail', async () => {
    const actionFn = vi.fn().mockResolvedValue(false);

    const result = await stl.executeWithRetry('task-456', 'Impossible task', actionFn);

    expect(result).toBe(false);
    expect(actionFn).toHaveBeenCalledTimes(4); // Tries all 4 strategies
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should use known strategy from memory if available', async () => {
    // Inject a known strategy
    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(JSON.stringify([
      { taskId: 'task-789', successfulStrategy: 'Kinetic (Scroll and Retry)', timestamp: '2026-01-01' }
    ]));

    const actionFn = vi.fn().mockImplementation(async (strategy: string) => {
      // Succeeds if it's the known strategy
      return strategy === 'Kinetic (Scroll and Retry)';
    });

    const result = await stl.executeWithRetry('task-789', 'Remembered task', actionFn);

    expect(result).toBe(true);
    expect(actionFn).toHaveBeenCalledTimes(1);
    expect(actionFn).toHaveBeenCalledWith('Kinetic (Scroll and Retry)');
  });
});
