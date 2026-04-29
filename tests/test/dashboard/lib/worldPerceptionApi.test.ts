import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createWorldPerceptionSignal,
  getWorldPerceptionOverview,
  promoteWorldPerceptionSignal,
} from '@/lib/worldPerceptionApi.js';

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

describe('worldPerceptionApi', () => {
  it('returns overview data from the API', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: true,
      data: {
        generatedAt: '2026-04-11T10:00:00.000Z',
        summary: { totalSignals: 6, detected: 3, promoted: 2, ignored: 1, avgScore: 0.71 },
        domainCoverage: [],
        pendingSignals: [],
        freshestSignals: [],
        recentPromotions: [],
      },
    }));

    const overview = await getWorldPerceptionOverview();

    expect(overview.summary.totalSignals).toBe(6);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/world-perception/overview'),
      expect.any(Object),
    );
  });

  it('posts a manual world perception signal', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: true,
      data: {
        id: 'wps-7',
        title: 'Fresh market signal',
        status: 'detected',
      },
    }));

    await createWorldPerceptionSignal({
      source: 'market-watch',
      title: 'Fresh market signal',
      summary: 'Something changed.',
      domain: 'business',
      provenance: 'market-watch',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/world-perception/observe'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('throws the API error when promotion fails', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: false,
      error: 'signal already promoted',
    }, 400));

    await expect(promoteWorldPerceptionSignal('wps-7')).rejects.toThrow('signal already promoted');
  });
});
