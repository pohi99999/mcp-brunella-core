import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketingDirectorAgent } from '../src/agents/MarketingDirectorAgent.js';
import { generateResponse } from '../src/core/llm_client.js';
import { updateBusinessJobStatus, saveStudioProject } from '../src/utils/db.js';
import { socketService } from '../src/server/SocketService.js';
import { agentManager } from '../src/agents/AgentManager.js';
import fs from 'fs/promises';

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/core/llm_client.js', () => ({
  generateResponse: vi.fn(),
}));

vi.mock('../src/utils/db.js', () => ({
  updateBusinessJobStatus: vi.fn().mockResolvedValue(undefined),
  saveStudioProject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/server/SocketService.js', () => ({
  socketService: {
    emit: vi.fn(),
  },
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    queueTask: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'project-123'),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockGenerateResponse = vi.mocked(generateResponse);
const mockUpdateBusinessJobStatus = vi.mocked(updateBusinessJobStatus);
const mockSaveStudioProject = vi.mocked(saveStudioProject);
const mockEmit = vi.mocked(socketService.emit);
const mockQueueTask = vi.mocked(agentManager.queueTask);
const mockMkdir = vi.mocked(fs.mkdir);

describe('MarketingDirectorAgent', () => {
  let agent: MarketingDirectorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new MarketingDirectorAgent();
    mockGenerateResponse.mockResolvedValue('mock response');
  });

  it('does not throw when taskContext and jobId are missing', async () => {
    const result = await agent.executeTask({ task: 'Promote a bakery' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Marketing Kampány és Weboldal fejlesztés elindítva!');
    expect(mockUpdateBusinessJobStatus).not.toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith('business_job:updated', expect.objectContaining({ status: 'running' }));
    expect(mockQueueTask).toHaveBeenCalledTimes(1);
    expect(mockSaveStudioProject).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalledTimes(1);
  });

  it('preserves job updates when jobId is present', async () => {
    const result = await agent.executeTask({
      task: 'Promote a bakery',
      context: { jobId: 'job-42' },
    });

    expect(result.success).toBe(true);
    expect(mockUpdateBusinessJobStatus).toHaveBeenCalledWith('job-42', 'completed', expect.any(String));
    expect(mockEmit).toHaveBeenCalledWith('business_job:updated', { jobId: 'job-42', status: 'completed' });
    expect(mockQueueTask).toHaveBeenCalledTimes(1);
  });
});
