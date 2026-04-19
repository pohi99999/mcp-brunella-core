import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleQueueBatch, enqueueTask } from './queueHandler.js';

describe('Queue Handler', () => {
  const mockEnv: any = {
    AI: {
      run: vi.fn(),
    },
    D1_METADATA: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
    },
    RESULT_QUEUE: {
      sendBatch: vi.fn().mockResolvedValue(undefined),
    },
    BAS_ANALYTICS: {
      writeDataPoint: vi.fn(),
    },
    DEFAULT_CODE_MODEL: '@cf/meta/llama-3',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enqueue a task', async () => {
    const mockQueue = { send: vi.fn() };
    const task: any = { taskId: '123', instruction: 'test' };
    
    await enqueueTask(mockQueue as any, task);
    expect(mockQueue.send).toHaveBeenCalledWith(task, { contentType: 'json' });
  });

  it('should process a batch of messages', async () => {
    const task = { taskId: 'task-1', instruction: 'do work', type: 'general', priority: 'normal' };
    const mockMessage = {
      body: task,
      ack: vi.fn(),
      retry: vi.fn(),
    };

    const mockBatch: any = {
      messages: [mockMessage],
    };

    mockEnv.AI.run.mockResolvedValue({ response: 'Task completed' });

    await handleQueueBatch(mockBatch, mockEnv);

    expect(mockEnv.AI.run).toHaveBeenCalled();
    expect(mockMessage.ack).toHaveBeenCalled();
    expect(mockEnv.RESULT_QUEUE.sendBatch).toHaveBeenCalled();
  });

  it('should handle AI processing failure and retry', async () => {
    const task = { taskId: 'task-fail', instruction: 'fail', type: 'general', priority: 'normal' };
    const mockMessage = {
      body: task,
      ack: vi.fn(),
      retry: vi.fn(),
    };

    const mockBatch: any = {
      messages: [mockMessage],
    };

    // Both primary and fallback fail
    mockEnv.AI.run.mockRejectedValue(new Error('AI Down'));

    await handleQueueBatch(mockBatch, mockEnv);

    // Should NOT ack if it throws inside processTask but we caught it in handleQueueBatch?
    // Looking at queueHandler.ts, if processTask fails, it returns a failed ResultMessage.
    // The handleQueueBatch catch block is only for errors OUTSIDE processTask (like analytics/D1 crash).
    
    expect(mockMessage.ack).toHaveBeenCalled(); // Because processTask returns a ResultMessage with status: 'failed'
    expect(mockEnv.RESULT_QUEUE.sendBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ body: expect.objectContaining({ status: 'failed' }) })
      ])
    );
  });
});
