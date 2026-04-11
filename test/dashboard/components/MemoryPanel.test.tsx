import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryPanel } from '@/components/dashboard/MemoryPanel';
import * as api from '@/lib/apiService';

vi.mock('@/lib/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apiService')>();
  return {
    ...actual,
    getStructuredMemoryStats: vi.fn(),
    purgeStructuredMemory: vi.fn(),
    exportStructuredMemory: vi.fn(),
    syncGoldenMirror: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  getStructuredMemoryStats: ReturnType<typeof vi.fn>;
  purgeStructuredMemory: ReturnType<typeof vi.fn>;
  exportStructuredMemory: ReturnType<typeof vi.fn>;
  syncGoldenMirror: ReturnType<typeof vi.fn>;
};

const statsResponse = {
  summary: {
    totalEntries: 8,
    avgConfidence: 0.87,
    totalReuses: 13,
  },
  agents: [
    {
      agentName: 'Developer',
      totalEntries: 8,
      avgConfidence: 0.87,
      totalReuses: 13,
      lastUpdatedAt: '2026-04-11T15:00:00.000Z',
      cache: { hits: 10, misses: 2, hitRate: 0.833 },
    },
  ],
  recentReuses: [
    {
      id: 101,
      agentName: 'Developer',
      rawTask: 'Review the memory architecture rollout',
      reuseCount: 3,
      confidence: 0.91,
      lastReusedAt: '2026-04-11T15:10:00.000Z',
    },
  ],
};

describe('MemoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getStructuredMemoryStats.mockResolvedValue(statsResponse);
    mockedApi.purgeStructuredMemory.mockResolvedValue({ success: true, removed: 4 });
    mockedApi.exportStructuredMemory.mockResolvedValue('{"entry":1}\n');
    mockedApi.syncGoldenMirror.mockResolvedValue({
      success: true,
      synced: 0,
      failed: 0,
      skipped: 3,
      mode: 'local-only',
    });
  });

  it('loads structured memory stats and recent reuse cards', async () => {
    render(<MemoryPanel />);

    expect(await screen.findByText('Agent Memória & Tanulás')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.getStructuredMemoryStats).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0.87').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Developer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Review the memory architecture rollout')).toBeInTheDocument();
  });

  it('purges structured memory and refreshes the stats', async () => {
    render(<MemoryPanel />);
    await screen.findByText('Agent Memória & Tanulás');

    fireEvent.click(screen.getByRole('button', { name: /purge/i }));

    await waitFor(() => {
      expect(mockedApi.purgeStructuredMemory).toHaveBeenCalledWith(0.5);
    });
    await waitFor(() => {
      expect(mockedApi.getStructuredMemoryStats).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText('Törölt elemek: 4')).toBeInTheDocument();
  });

  it('shows the local-only sync message when D1 is unavailable', async () => {
    render(<MemoryPanel />);
    await screen.findByText('Agent Memória & Tanulás');

    fireEvent.click(screen.getByRole('button', { name: /sync d1/i }));

    await waitFor(() => {
      expect(mockedApi.syncGoldenMirror).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/Golden mirror sync skipped: D1 nincs konfigurálva/)).toBeInTheDocument();
  });
});
