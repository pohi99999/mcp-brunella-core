import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveSelfModificationProposal,
  getSelfModificationOverview,
  runSelfModification,
} from '../../../src/dashboard/lib/selfModificationApi';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : String(status),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('selfModificationApi', () => {
  it('returns overview data from the API', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: true,
      data: {
        summary: { totalRuns: 6, agentCount: 2, overallSuccessRate: 0.84, avgDurationMs: 1800 },
        weakAgents: [],
        proposals: [],
      },
    }));

    const overview = await getSelfModificationOverview();

    expect(overview.summary.totalRuns).toBe(6);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/self-modification/overview'),
      expect.any(Object),
    );
  });

  it('posts a manual self-modification request', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: true,
      data: {
        id: 'proposal-7',
        agentName: 'MarketingDirector',
        status: 'pending_review',
      },
    }));

    await runSelfModification('MarketingDirector', true);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/self-modification/improve/MarketingDirector'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ force: true }),
      }),
    );
  });

  it('throws the API error when approval fails', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: false,
      error: 'proposal already applied',
    }, 400));

    await expect(approveSelfModificationProposal('proposal-7')).rejects.toThrow('proposal already applied');
  });
});
