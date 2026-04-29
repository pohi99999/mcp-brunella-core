// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReflectionPanel } from '@/components/dashboard/ReflectionPanel.js';
import * as apiService from '@/lib/apiService.js';

vi.mock('@/lib/apiService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apiService.js')>();
  return {
    ...actual,
    getReflectionOverview: vi.fn(),
    runReflectionNightlyCycle: vi.fn(),
  };
});

const mockedApi = apiService as unknown as {
  getReflectionOverview: ReturnType<typeof vi.fn>;
  runReflectionNightlyCycle: ReturnType<typeof vi.fn>;
};

describe('ReflectionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getReflectionOverview.mockResolvedValue({
      stats: {
        totalReflections: 8,
        avgQualityScore: 0.72,
        totalLessons: 14,
        selfModelHealth: 'learning',
        metaReasonerStats: { decisions: 18, insights: 4, sessions: 2 },
      },
      selfModel: {
        identity: 'Brunella Orchestrator',
        coherence: 0.84,
        health: 'learning',
        blindSpots: [],
        memoryScopes: {
          global: { purpose: 'Global memory purpose', sources: ['GraphRagEngine'] },
          local: { purpose: 'Local memory purpose', sources: ['StructuredMemory'] },
        },
        lastReflectionAt: 1718000000000,
      },
      painPoints: [
        {
          agent: 'DashboardSync',
          failureCount: 2,
          failureRate: 0.4,
          severity: 'medium',
          recommendation: 'Tighten the contract',
        },
      ],
      insights: [
        {
          id: 'mi-1',
          category: 'recommendation',
          description: 'Connect reflection overview to the UI.',
          suggestedAction: 'Expose the dashboard endpoint',
        },
      ],
      context: 'Reflection context text',
    });
    mockedApi.runReflectionNightlyCycle.mockResolvedValue({
      insights: [],
      painPoints: [],
      selfModelHealth: 'coherent',
      coherence: 0.86,
      stats: {
        totalReflections: 9,
        avgQualityScore: 0.74,
        totalLessons: 16,
        selfModelHealth: 'coherent',
        metaReasonerStats: { decisions: 20, insights: 5, sessions: 3 },
      },
      ranAt: '2026-04-19T08:15:00.000Z',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders overview data and memory scopes', async () => {
    render(createElement(ReflectionPanel));

    expect(await screen.findByText('Reflection')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getReflectionOverview).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Global memory purpose')).toBeInTheDocument();
    expect(screen.getByText('Local memory purpose')).toBeInTheDocument();
    expect(screen.getByText('Reflection context text')).toBeInTheDocument();
  });

  it('triggers nightly cycle from the action button', async () => {
    render(createElement(ReflectionPanel));
    await screen.findByText('Reflection');

    fireEvent.click(screen.getByRole('button', { name: 'Nightly cycle' }));

    await waitFor(() => {
      expect(mockedApi.runReflectionNightlyCycle).toHaveBeenCalledTimes(1);
    });
  });
});
