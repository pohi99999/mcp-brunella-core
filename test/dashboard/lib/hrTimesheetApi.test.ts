import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getHRTimesheetStatusSnapshot } from '../../../src/dashboard/lib/hrTimesheetApi';

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

describe('getHRTimesheetStatusSnapshot', () => {
  it('returns the snapshot payload from the API', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({
      success: true,
      timestamp: '2026-04-08T12:00:00.000Z',
      snapshot: {
        checkedAt: '2026-04-08T12:00:00.000Z',
        headline: 'Healthy',
        recommendation: 'Keep going',
        counts: {
          entries: 2,
          employees: 2,
          monthlyExports: 1,
          dailyAlertRuns: 1,
        },
        latestMonthlyExport: null,
        latestDailyAlert: null,
        alertTotalsByType: { birthday: 1, anniversary: 1 },
      },
    }));

    const result = await getHRTimesheetStatusSnapshot();

    expect(result.success).toBe(true);
    expect(result.snapshot.counts.entries).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/hr/timesheet/status'),
      expect.any(Object),
    );
  });
});
