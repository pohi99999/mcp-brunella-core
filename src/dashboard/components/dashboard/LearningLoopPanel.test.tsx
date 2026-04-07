import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LearningLoopPanel from './LearningLoopPanel';

type CuratedState = 'pending' | 'approved' | 'rejected';

type CuratedSample = {
  id: string;
  prompt: string;
  completion: string;
  source: string;
  quality: number;
  approvalState: CuratedState;
  createdAt: string;
  approvedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
};

describe('LearningLoopPanel', () => {
  const fetchMock = vi.fn();
  let samples: CuratedSample[];

  const makeStats = () => ({
    totalCandidates: samples.length,
    approvedCount: samples.filter((sample) => sample.approvalState === 'approved').length,
    rejectedCount: samples.filter((sample) => sample.approvalState === 'rejected').length,
    pendingReview: samples.filter((sample) => sample.approvalState === 'pending').length,
    avgQuality: 0.84,
  });

  const makeResponse = (body: unknown) => ({
    ok: true,
    json: async () => body,
  });

  beforeEach(() => {
    samples = [
      {
        id: 'sample-1',
        prompt: 'Fix login redirect bug in dashboard',
        completion: 'Updated the auth guard and redirect flow.',
        source: 'manual',
        quality: 0.91,
        approvalState: 'pending',
        createdAt: '2026-04-02T10:00:00.000Z',
      },
      {
        id: 'sample-2',
        prompt: 'Summarize telemetry anomalies',
        completion: 'Produced a concise incident summary.',
        source: 'manual',
        quality: 0.72,
        approvalState: 'approved',
        createdAt: '2026-04-01T10:00:00.000Z',
        approvedAt: '2026-04-01T12:00:00.000Z',
        reviewedBy: 'qa',
      },
    ];

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url.pathname === '/api/v1/learning-loop/overview') {
        return makeResponse({
          success: true,
          data: {
            registry: {
              activeModel: null,
              shadowModels: [],
              candidateModels: [],
              retiredModels: [],
              latestTrainingRuns: [],
              latestEvalResults: [],
            },
            latestTrainingRuns: [],
            activeReflexModel: null,
            curatedStats: makeStats(),
          },
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/learning-loop/curated/samples') {
        const state = url.searchParams.get('state') as CuratedState | null;
        const filtered = state ? samples.filter((sample) => sample.approvalState === state) : samples;
        return makeResponse({
          success: true,
          count: filtered.length,
          data: filtered,
        });
      }

      if (method === 'POST' && url.pathname.startsWith('/api/v1/learning-loop/curated/review/')) {
        const sampleId = url.pathname.split('/').pop() as string;
        const body = JSON.parse(String(init?.body ?? '{}')) as { decision?: CuratedState; reviewer?: string };
        const sample = samples.find((item) => item.id === sampleId);

        if (!sample || !body.decision) {
          return makeResponse({ success: false, error: 'sample not found' });
        }

        sample.approvalState = body.decision;
        sample.reviewedBy = body.reviewer ?? 'dashboard';
        sample.reviewNotes = 'Learning Loop dashboard review';
        sample.approvedAt = body.decision === 'approved' ? '2026-04-02T11:00:00.000Z' : undefined;

        return makeResponse({ success: true, data: sample });
      }

      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders curated review controls and refreshes after approval', async () => {
    render(<LearningLoopPanel />);

    expect(await screen.findByText('Curated sample review')).toBeInTheDocument();
    expect(screen.getByTestId('curated-filter-pending')).toBeInTheDocument();
    expect(screen.getByTestId('curated-filter-approved')).toBeInTheDocument();
    expect(screen.getByText('1 shown')).toBeInTheDocument();
    expect(screen.getByTestId('curated-sample-sample-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('curated-approve-sample-1'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/learning-loop/curated/review/sample-1',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'approved', reviewer: 'dashboard' }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId('curated-sample-sample-1')).not.toBeInTheDocument();
      expect(screen.getByText('0 shown')).toBeInTheDocument();
    });
  });
});
