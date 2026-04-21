import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CognitiveMemoryPanel } from './CognitiveMemoryPanel';

describe('CognitiveMemoryPanel', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses the memory stats route and renders safely without curated quality data', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        golden: { totalSamples: 7, newSinceLastTraining: 2, lastTrainingAt: null },
        index: { lastIndexTime: 0, lastStats: null, schedulerActive: false },
      }),
    });

    render(<CognitiveMemoryPanel />);

    await waitFor(() => {
      expect(screen.getByText('Golden Samples')).toBeInTheDocument();
      expect(screen.getByText('Avg Quality: —')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/memory/stats');
  });

  it('submits manual golden samples using the backend contract', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          golden: { totalSamples: 1, newSinceLastTraining: 0, lastTrainingAt: null },
          curated: { avgQuality: 0.9 },
          index: { lastIndexTime: 0, lastStats: null, schedulerActive: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          golden: { totalSamples: 2, newSinceLastTraining: 1, lastTrainingAt: null },
          curated: { avgQuality: 0.95 },
          index: { lastIndexTime: 0, lastStats: null, schedulerActive: false },
        }),
      });

    render(<CognitiveMemoryPanel />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('Task description...'), {
      target: { value: 'Verify memory contract' },
    });
    fireEvent.change(screen.getByPlaceholderText('Response content...'), {
      target: { value: 'Golden sample payload' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Sample' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const [, requestInit] = fetchMock.mock.calls[1];
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/memory/golden');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(JSON.parse(String(requestInit.body))).toEqual({
      source: 'dashboard_manual',
      prompt: 'Verify memory contract',
      completion: 'Golden sample payload',
      quality: 0.5,
    });
  });
});
