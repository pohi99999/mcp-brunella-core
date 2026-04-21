import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReflectionOverview,
  runReflectionNightlyCycle,
} from '@/lib/apiService';

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

describe('Reflection API', () => {
  it('should_return_reflection_overview_and_use_v1_path', async () => {
    const overview = {
      stats: {
        totalReflections: 12,
        avgQualityScore: 0.84,
        totalLessons: 27,
        selfModelHealth: 'learning',
        metaReasonerStats: { decisions: 44, insights: 7, sessions: 5 },
      },
      selfModel: {
        identity: 'Brunella Orchestrator',
        coherence: 0.91,
        health: 'learning',
        blindSpots: [
          { area: 'dashboard-wiring', severity: 'medium', description: 'Missing client sync' },
        ],
        memoryScopes: {
          global: { purpose: 'Global purpose', sources: ['GraphRagEngine'] },
          local: { purpose: 'Local purpose', sources: ['StructuredMemory'] },
        },
        lastReflectionAt: 1718000000000,
      },
      painPoints: [
        {
          agent: 'DashboardSync',
          failureCount: 3,
          failureRate: 0.5,
          severity: 'medium',
          recommendation: 'Repair the missing binding',
        },
      ],
      insights: [
        {
          id: 'mi-1',
          category: 'recommendation',
          description: 'Wire the reflection overview end-to-end.',
          suggestedAction: 'Add dashboard contract support',
        },
      ],
      context: 'Reflection context',
    };

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, overview }));

    const result = await getReflectionOverview();

    expect(result.selfModel.memoryScopes.global.sources).toEqual(['GraphRagEngine']);
    expect(result.painPoints[0].agent).toBe('DashboardSync');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reflection/overview'),
      expect.any(Object),
    );
  });

  it('should_throw_when_reflection_overview_api_returns_non_ok_status', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Denied' }, 502));

    await expect(getReflectionOverview()).rejects.toThrow('Reflection overview: HTTP 502');
  });

  it('should_throw_when_reflection_overview_payload_is_missing', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true }));

    await expect(getReflectionOverview()).rejects.toThrow('Reflection overview: empty response');
  });

  it('should_return_nightly_cycle_result_and_use_v1_path', async () => {
    const resultPayload = {
      insights: [],
      painPoints: [],
      selfModelHealth: 'coherent' as const,
      coherence: 0.9,
      stats: {
        totalReflections: 13,
        avgQualityScore: 0.85,
        totalLessons: 29,
        selfModelHealth: 'coherent',
        metaReasonerStats: { decisions: 46, insights: 8, sessions: 6 },
      },
      ranAt: '2026-04-19T08:00:00.000Z',
    };

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, result: resultPayload }));

    const result = await runReflectionNightlyCycle();

    expect(result.ranAt).toBe('2026-04-19T08:00:00.000Z');
    expect(result.stats.totalReflections).toBe(13);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reflection/nightly-cycle'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should_throw_when_nightly_cycle_api_returns_non_ok_status', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Busy' }, 500));

    await expect(runReflectionNightlyCycle()).rejects.toThrow('Reflection nightly cycle: HTTP 500');
  });
});
