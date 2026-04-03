import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMaintainerPanel } from './ProjectMaintainerPanel';
import * as apiService from '@/lib/apiService';

vi.mock('@/lib/apiService', () => ({
  getLatestProjectMaintainerReport: vi.fn(),
  runProjectMaintainerReport: vi.fn(),
}));

describe('ProjectMaintainerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders latest report details from shared api service', async () => {
    vi.mocked(apiService.getLatestProjectMaintainerReport).mockResolvedValue({
      id: 'pmr-1',
      generatedAt: '2026-04-02T22:00:00.000Z',
      findingsCount: 1,
      suggestionsCount: 1,
      triggeredBy: 'scheduler',
      report: {
        id: 'pmr-1',
        generatedAt: '2026-04-02T22:00:00.000Z',
        triggeredBy: 'scheduler',
        findings: [{ category: 'root-noise', severity: 'medium', message: 'Artefakt', path: 'debug_view.txt' }],
        suggestions: [{ action: 'review', target: 'debug_view.txt', reason: 'Vizsgáld meg.' }],
        trackSummary: { total: 1, missingSpec: [], missingPlan: [], healthy: 1 },
        dryRun: true,
      },
    });

    render(<ProjectMaintainerPanel />);

    await waitFor(() => {
      expect(apiService.getLatestProjectMaintainerReport).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Project Maintainer')).toBeInTheDocument();
    expect(screen.getAllByText(/debug_view\.txt/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Dry-run:/)).toBeInTheDocument();
    expect(screen.getByText(/Conductor track állapot/)).toBeInTheDocument();
  });

  it('triggers on-demand run and refreshes latest report', async () => {
    vi.mocked(apiService.getLatestProjectMaintainerReport)
      .mockResolvedValueOnce({
        id: 'pmr-1',
        generatedAt: '2026-04-02T22:00:00.000Z',
        findingsCount: 0,
        suggestionsCount: 0,
        triggeredBy: 'scheduler',
        report: {
          id: 'pmr-1',
          generatedAt: '2026-04-02T22:00:00.000Z',
          triggeredBy: 'scheduler',
          findings: [],
          suggestions: [],
          trackSummary: { total: 1, missingSpec: [], missingPlan: [], healthy: 1 },
          dryRun: true,
        },
      })
      .mockResolvedValueOnce({
        id: 'pmr-2',
        generatedAt: '2026-04-02T22:05:00.000Z',
        findingsCount: 1,
        suggestionsCount: 1,
        triggeredBy: 'api',
        report: {
          id: 'pmr-2',
          generatedAt: '2026-04-02T22:05:00.000Z',
          triggeredBy: 'api',
          findings: [{ category: 'track-anomaly', severity: 'low', message: 'Hiányzó plan', path: 'conductor/tracks/x/plan.md' }],
          suggestions: [{ action: 'create', target: 'conductor/tracks/x/plan.md', reason: 'Pótold a tervet.' }],
          trackSummary: { total: 1, missingSpec: [], missingPlan: ['x'], healthy: 0 },
          dryRun: true,
        },
      });
    vi.mocked(apiService.runProjectMaintainerReport).mockResolvedValue({
      success: true,
      message: 'Riport sikeresen elkészült',
      report: {
        id: 'pmr-2',
        generatedAt: '2026-04-02T22:05:00.000Z',
        triggeredBy: 'api',
        findings: [{ category: 'track-anomaly', severity: 'low', message: 'Hiányzó plan', path: 'conductor/tracks/x/plan.md' }],
        suggestions: [{ action: 'create', target: 'conductor/tracks/x/plan.md', reason: 'Pótold a tervet.' }],
        trackSummary: { total: 1, missingSpec: [], missingPlan: ['x'], healthy: 0 },
        dryRun: true,
      },
    });

    render(<ProjectMaintainerPanel />);

    await waitFor(() => {
      expect(apiService.getLatestProjectMaintainerReport).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /scan futtatása/i }));

    await waitFor(() => {
      expect(apiService.runProjectMaintainerReport).toHaveBeenCalledTimes(1);
      expect(apiService.getLatestProjectMaintainerReport).toHaveBeenCalledTimes(2);
    });

    expect(screen.getAllByText(/Hiányzó plan/).length).toBeGreaterThan(0);
  });

  it('shows empty state when the backend has no report yet', async () => {
    vi.mocked(apiService.getLatestProjectMaintainerReport).mockRejectedValue(
      new Error('Project Maintainer latest: HTTP 404'),
    );

    render(<ProjectMaintainerPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Még nincs riport/)).toBeInTheDocument();
    });
  });
});
