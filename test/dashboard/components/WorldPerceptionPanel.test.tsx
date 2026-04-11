import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorldPerceptionPanel } from '@/components/dashboard/WorldPerceptionPanel';
import * as worldApi from '@/lib/worldPerceptionApi';

vi.mock('@/lib/worldPerceptionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/worldPerceptionApi')>();
  return {
    ...actual,
    getWorldPerceptionOverview: vi.fn(),
    getWorldPerceptionSignals: vi.fn(),
    createWorldPerceptionSignal: vi.fn(),
    runWorldPerceptionCycle: vi.fn(),
    promoteWorldPerceptionSignal: vi.fn(),
    ignoreWorldPerceptionSignal: vi.fn(),
  };
});

const mockedApi = worldApi as unknown as {
  getWorldPerceptionOverview: ReturnType<typeof vi.fn>;
  getWorldPerceptionSignals: ReturnType<typeof vi.fn>;
  createWorldPerceptionSignal: ReturnType<typeof vi.fn>;
  runWorldPerceptionCycle: ReturnType<typeof vi.fn>;
  promoteWorldPerceptionSignal: ReturnType<typeof vi.fn>;
  ignoreWorldPerceptionSignal: ReturnType<typeof vi.fn>;
};

describe('WorldPerceptionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getWorldPerceptionOverview.mockResolvedValue({
      generatedAt: '2026-04-11T10:00:00.000Z',
      summary: { totalSignals: 9, detected: 4, promoted: 3, ignored: 2, avgScore: 0.76 },
      domainCoverage: [{ domain: 'technology', count: 4 }],
      pendingSignals: [],
      freshestSignals: [],
      recentPromotions: [
        {
          id: 'wps-promoted',
          title: 'Promoted signal',
          intelligenceSignalId: 'int-42',
          promotedAt: '2026-04-11T09:00:00.000Z',
        },
      ],
    });
    mockedApi.getWorldPerceptionSignals.mockResolvedValue([
      {
        id: 'wps-1',
        title: 'Fresh perception signal',
        summary: 'Fresh signal summary',
        domain: 'technology',
        score: 0.88,
        freshnessScore: 0.92,
        impactScore: 0.81,
        status: 'detected',
        observedAt: '2026-04-11T10:00:00.000Z',
      },
    ]);
    mockedApi.createWorldPerceptionSignal.mockResolvedValue({ id: 'wps-2' });
    mockedApi.runWorldPerceptionCycle.mockResolvedValue({ triggeredAt: '2026-04-11T10:00:00.000Z' });
    mockedApi.promoteWorldPerceptionSignal.mockResolvedValue({ worldSignal: { id: 'wps-1' }, intelligenceSignal: { id: 'int-42' } });
    mockedApi.ignoreWorldPerceptionSignal.mockResolvedValue({ id: 'wps-1' });
  });

  it('loads overview stats and signal queue', async () => {
    render(<WorldPerceptionPanel />);

    expect(await screen.findByText('World Perception')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getWorldPerceptionOverview).toHaveBeenCalledTimes(1);
      expect(mockedApi.getWorldPerceptionSignals).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('world-stat-total')).toHaveTextContent('9');
    expect(screen.getByTestId('world-stat-detected')).toHaveTextContent('4');
    expect(screen.getByTestId('world-signal-wps-1')).toBeInTheDocument();
  });

  it('creates a manual observation and refreshes the panel', async () => {
    render(<WorldPerceptionPanel />);
    await screen.findByText('World Perception');

    fireEvent.change(screen.getByTestId('world-source-input'), { target: { value: 'manual-input' } });
    fireEvent.change(screen.getByTestId('world-title-input'), { target: { value: 'Fresh observation' } });
    fireEvent.change(screen.getByTestId('world-summary-input'), { target: { value: 'Observation summary' } });
    fireEvent.change(screen.getByPlaceholderText('Provenance'), { target: { value: 'operator note' } });
    fireEvent.click(screen.getByTestId('world-create-button'));

    await waitFor(() => {
      expect(mockedApi.createWorldPerceptionSignal).toHaveBeenCalledWith(expect.objectContaining({
        source: 'manual-input',
        title: 'Fresh observation',
      }));
    });
    expect(mockedApi.getWorldPerceptionOverview).toHaveBeenCalledTimes(2);
  });

  it('promotes a detected signal', async () => {
    render(<WorldPerceptionPanel />);
    await screen.findByText('World Perception');

    fireEvent.click(await screen.findByRole('button', { name: 'Promote' }));

    await waitFor(() => {
      expect(mockedApi.promoteWorldPerceptionSignal).toHaveBeenCalledWith('wps-1');
    });
  });
});
