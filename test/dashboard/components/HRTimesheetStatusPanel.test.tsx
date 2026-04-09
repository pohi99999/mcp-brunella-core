import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HRTimesheetStatusPanel } from '@/components/dashboard/HRTimesheetStatusPanel';
import * as hrTimesheetApi from '@/lib/hrTimesheetApi';

vi.mock('@/lib/hrTimesheetApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hrTimesheetApi')>();
  return {
    ...actual,
    getHRTimesheetStatusSnapshot: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedApi = hrTimesheetApi as unknown as {
  getHRTimesheetStatusSnapshot: ReturnType<typeof vi.fn>;
};

describe('HRTimesheetStatusPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getHRTimesheetStatusSnapshot.mockResolvedValue({
      success: true,
      timestamp: '2026-04-08T12:00:00.000Z',
      snapshot: {
        checkedAt: '2026-04-08T12:00:00.000Z',
        headline: 'HR timesheet and culture flow is healthy.',
        recommendation: 'Keep the read-only cockpit visible and use the latest runs to spot regressions early.',
        counts: {
          entries: 2,
          employees: 2,
          monthlyExports: 1,
          dailyAlertRuns: 1,
        },
        latestMonthlyExport: {
          month: '2026-04',
          status: 'completed',
          employeeCount: 2,
          totalEntries: 2,
          totalHours: 14,
          outputPath: 'data/hr-timesheet/exports/timesheet-export-2026-04.csv',
          updatedAt: '2026-04-08T11:00:00.000Z',
        },
        latestDailyAlert: {
          date: '2026-04-07',
          status: 'completed',
          generatedCount: 2,
          suppressedCount: 0,
          updatedAt: '2026-04-08T11:30:00.000Z',
        },
        alertTotalsByType: {
          birthday: 1,
          anniversary: 1,
        },
      },
    });
  });

  it('renders the shared HR timesheet snapshot and latest runs', async () => {
    render(<HRTimesheetStatusPanel />);

    expect(await screen.findByText('HR Timesheet & Culture')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getHRTimesheetStatusSnapshot).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('hr-timesheet-stat-entries')).toHaveTextContent('2');
    expect(screen.getByTestId('hr-timesheet-stat-employees')).toHaveTextContent('2');
    expect(screen.getByTestId('hr-timesheet-stat-runs')).toHaveTextContent('2');
    expect(screen.getByTestId('hr-timesheet-stat-alerts')).toHaveTextContent('2');
    expect(screen.getByText('HR timesheet and culture flow is healthy.')).toBeInTheDocument();
    expect(screen.getByText('2026-04')).toBeInTheDocument();
    expect(screen.getAllByText('completed')).toHaveLength(2);
    expect(screen.getByText('Birthday + anniversary')).toBeInTheDocument();
  });
});
