import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SwarmPanel from './SwarmPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

function mockFetchResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe('SwarmPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders colony metrics from the swarm status payload shape', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse({
        total: 1,
        colonies: [
          {
            colonyId: 'triad-default',
            name: 'Triad',
            status: 'active',
            agentCount: 3,
            leaderId: 'researcher',
            metrics: {
              tasksCompleted: 7,
              tasksFailed: 1,
              avgDurationMs: 1234,
            },
          },
        ],
      }))
      .mockResolvedValueOnce(mockFetchResponse({
        totalCheckpoints: 12,
        colonies: 2,
        latestAt: '2026-04-12T03:00:00Z',
      }));

    vi.stubGlobal('fetch', fetchMock);

    render(<SwarmPanel />);

    expect(await screen.findByText('Triad')).toBeInTheDocument();
    expect(screen.getByText(/3 agent/)).toBeInTheDocument();
    expect(screen.getByText('7✓ / 1✗')).toBeInTheDocument();
    expect(screen.getByText(/Leader: researcher/)).toBeInTheDocument();
    expect(screen.getByText('Avg: 1234ms')).toBeInTheDocument();
    expect(screen.getByText('2026-04-12T03:00:00Z')).toBeInTheDocument();
  });

  it('refreshes swarm data when the refresh button is pressed', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse({
        total: 0,
        colonies: [],
      }))
      .mockResolvedValueOnce(mockFetchResponse({
        totalCheckpoints: 0,
        colonies: 0,
        latestAt: null,
      }))
      .mockResolvedValueOnce(mockFetchResponse({
        total: 1,
        colonies: [
          {
            colonyId: 'triad-default',
            name: 'Triad',
            status: 'active',
            agentCount: 2,
            leaderId: 'developer',
            metrics: {
              tasksCompleted: 4,
              tasksFailed: 0,
              avgDurationMs: 900,
            },
          },
        ],
      }))
      .mockResolvedValueOnce(mockFetchResponse({
        totalCheckpoints: 3,
        colonies: 1,
        latestAt: '2026-04-12T03:05:00Z',
      }));

    vi.stubGlobal('fetch', fetchMock);

    render(<SwarmPanel />);

    expect(await screen.findByText('Nincs aktív kolónia')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Frissítés'));

    expect(await screen.findByText('Triad')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });
});
