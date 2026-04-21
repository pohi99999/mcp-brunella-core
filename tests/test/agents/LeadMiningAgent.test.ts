import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadMiningAgent } from '../../src/agents/LeadMiningAgent.js';
import { agentManager } from '../../src/agents/AgentManager.js';
import { socketService } from '../../src/server/SocketService.js';
import { globalPythonShell } from '../../src/utils/pythonShell.js';
import { saveBusinessJob, saveBusinessLead, updateBusinessJobStatus } from '../../src/utils/db.js';
import { validateEmail } from '../../src/services/emailValidator.js';

vi.mock('../../src/utils/db.js', () => ({
  saveBusinessJob: vi.fn(),
  saveBusinessLead: vi.fn(),
  updateBusinessJobStatus: vi.fn(),
}));

vi.mock('../../src/utils/pythonShell.js', () => ({
  globalPythonShell: {
    run: vi.fn(),
  },
}));

vi.mock('../../src/services/emailValidator.js', () => ({
  validateEmail: vi.fn(),
}));

vi.mock('../../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: vi.fn(),
  },
}));

vi.mock('../../src/server/SocketService.js', () => ({
  socketService: {
    emit: vi.fn(),
  },
}));

describe('LeadMiningAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses the provided jobId and updates status for local scraping', async () => {
    vi.mocked(validateEmail).mockResolvedValue('valid');
    vi.mocked(globalPythonShell.run)
      .mockResolvedValueOnce(JSON.stringify([
        {
          name: 'Fogorvos 360',
          website: 'https://fogorvos360.hu',
          industry: 'Dentistry',
          email: 'hello@fogorvos360.hu',
          contact_person: 'Anna',
          icebreaker: 'Szeretnék egy rövid közös egyeztetést.',
        },
      ]))
      .mockResolvedValueOnce('1');

    const agent = new LeadMiningAgent();
    const result = await agent.executeTask({
      task: 'fogorvos Budapest',
      jobId: 'job-123',
      metadata: { limit: 1 },
    } as never);

    expect(result.success).toBe(true);
    expect(saveBusinessJob).not.toHaveBeenCalled();
    expect(vi.mocked(globalPythonShell.run)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(globalPythonShell.run).mock.calls[0]?.[0]).toContain('limit=1');
    expect(updateBusinessJobStatus).toHaveBeenNthCalledWith(1, 'job-123', 'running');
    const completedPayload = JSON.parse(vi.mocked(updateBusinessJobStatus).mock.calls[1]?.[2] as string) as Record<string, unknown>;
    expect(completedPayload).toMatchObject({
      jobId: 'job-123',
      limit: 1,
      syncCount: 1,
    });
    expect(saveBusinessLead).toHaveBeenCalledWith(expect.objectContaining({
      job_id: 'job-123',
      company_name: 'Fogorvos 360',
      contact_email: 'hello@fogorvos360.hu',
      email_status: 'valid',
    }));
    expect(socketService.emit).toHaveBeenCalledWith('business_job:updated', expect.objectContaining({
      jobId: 'job-123',
      status: 'running',
    }));
    expect(socketService.emit).toHaveBeenCalledWith('business_job:updated', expect.objectContaining({
      jobId: 'job-123',
      status: 'completed',
    }));
  });

  it('delegates brand scraping to Apify with the provided limit and jobId', async () => {
    vi.mocked(agentManager.delegate).mockResolvedValue({
      status: 'success',
      data: [
        {
          name: 'Brand Kft',
          website: 'https://brand.example',
          email: 'info@brand.example',
          industry: 'Retail',
          source: 'linkedin',
        },
      ],
    } as never);
    vi.mocked(validateEmail).mockResolvedValue('valid');
    vi.mocked(globalPythonShell.run).mockResolvedValue('[]');

    const agent = new LeadMiningAgent();
    const result = await agent.executeTask({
      task: 'Brand outreach for cosmetics',
      jobId: 'job-brand-1',
      metadata: { leadType: 'Brand', limit: 3 },
    } as never);

    expect(result.success).toBe(true);
    expect(agentManager.delegate).toHaveBeenCalledWith(
      'ApifyScraping',
      'LinkedIn lead scraping for Brand outreach for cosmetics',
      expect.objectContaining({
        capability: 'linkedin',
        query: 'Brand outreach for cosmetics',
        leadType: 'Brand',
        limit: 3,
      }),
    );
    expect(updateBusinessJobStatus).toHaveBeenNthCalledWith(1, 'job-brand-1', 'running');
    const brandCompletedPayload = JSON.parse(vi.mocked(updateBusinessJobStatus).mock.calls[1]?.[2] as string) as Record<string, unknown>;
    expect(brandCompletedPayload).toMatchObject({
      jobId: 'job-brand-1',
      leadType: 'Brand',
      limit: 3,
    });
    expect(saveBusinessLead).toHaveBeenCalledWith(expect.objectContaining({
      job_id: 'job-brand-1',
      company_name: 'Brand Kft',
    }));
  });
});
