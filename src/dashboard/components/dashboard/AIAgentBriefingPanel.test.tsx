/**
 * AIAgentBriefingPanel.test.tsx
 *
 * Unit tests for the Napi AI Agent Összefoglaló dashboard panel.
 * Verifies data loading, empty state, successful run, and error handling.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAgentBriefingPanel } from './AIAgentBriefingPanel';
import * as apiService from '@/lib/apiService';

vi.mock('@/lib/apiService', () => ({
  getLatestBriefingReport: vi.fn(),
  runBriefingReport: vi.fn(),
}));

const MOCK_ITEM: apiService.BriefingItem = {
  title: 'LangChain 0.3 kiadás – ágens memória fejlesztések',
  url: 'https://blog.langchain.dev/release-0.3',
  source: 'LangChain Blog',
  excerpt: 'Az új verzió bemutatja az ágens memória modul javításait és az újratervezett tool-calling API-t.',
  relevance: 'Közvetlen kapcsolat a Brunella Memoria és Cortex rétegekkel.',
  brunellaLayers: ['memoria', 'cortex'],
  adoptionStatus: 'prototype',
  adoptionNote: 'Érdemes prototípusra emelni, mert az agent guidance és tool-calling réteghez kapcsolódik.',
  publishedAt: '2026-04-07T10:00:00.000Z',
};

const MOCK_REPORT: apiService.BriefingLatestReportResponse = {
  id: 'br-1',
  generatedAt: '2026-04-08T11:00:00.000Z',
  reportDate: '2026-04-08',
  itemsCount: 1,
  brunellaLayersCount: 2,
  triggeredBy: 'scheduler',
  report: {
    id: 'br-1',
    generatedAt: '2026-04-08T11:00:00.000Z',
    reportDate: '2026-04-08',
    triggeredBy: 'scheduler',
    items: [MOCK_ITEM],
    brunellaLayersCount: 2,
    dryRun: false,
  },
};

describe('AIAgentBriefingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel header correctly', async () => {
    vi.mocked(apiService.getLatestBriefingReport).mockResolvedValue(null);
    render(<AIAgentBriefingPanel />);
    expect(screen.getByText('Napi AI Agent Összefoglaló')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    vi.mocked(apiService.getLatestBriefingReport).mockResolvedValue(null);
    render(<AIAgentBriefingPanel />);
    expect(screen.getByText('Betöltés...')).toBeInTheDocument();
  });

  it('shows empty state when no report exists', async () => {
    vi.mocked(apiService.getLatestBriefingReport).mockResolvedValue(null);
    render(<AIAgentBriefingPanel />);

    await waitFor(() => {
      expect(apiService.getLatestBriefingReport).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/Még nincs elérhető napi összefoglaló/)).toBeInTheDocument();
    expect(screen.getByText(/Kattints a "Futtatás most" gombra/)).toBeInTheDocument();
  });

  it('renders the latest report with metadata and items', async () => {
    vi.mocked(apiService.getLatestBriefingReport).mockResolvedValue(MOCK_REPORT);
    render(<AIAgentBriefingPanel />);

    await waitFor(() => {
      expect(apiService.getLatestBriefingReport).toHaveBeenCalledTimes(1);
    });

    // Metadata
    expect(screen.getByText('2026-04-08')).toBeInTheDocument();
    expect(screen.getByText(/1 forrás/)).toBeInTheDocument();
    expect(screen.getByText(/2 réteg érintett/)).toBeInTheDocument();
    expect(screen.getByText('scheduler')).toBeInTheDocument();

    // Article item
    expect(screen.getByText('LangChain 0.3 kiadás – ágens memória fejlesztések')).toBeInTheDocument();
    expect(screen.getByText('LangChain Blog')).toBeInTheDocument();
    expect(screen.getByText(/Brunella Memoria és Cortex/)).toBeInTheDocument();

    // Layer badges
    expect(screen.getByText('prototype')).toBeInTheDocument();
    expect(screen.getByText('memoria')).toBeInTheDocument();
    expect(screen.getByText('cortex')).toBeInTheDocument();
    expect(screen.getByText(/Érdemes prototípusra emelni/)).toBeInTheDocument();
  });

  it('shows a run button and triggers briefing on click', async () => {
    vi.mocked(apiService.getLatestBriefingReport)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(MOCK_REPORT);
    vi.mocked(apiService.runBriefingReport).mockResolvedValue({
      success: true,
      id: 'br-1',
      reportDate: '2026-04-08',
    });

    render(<AIAgentBriefingPanel />);

    await waitFor(() => {
      expect(apiService.getLatestBriefingReport).toHaveBeenCalledTimes(1);
    });

    const runButton = screen.getByText('Futtatás most');
    fireEvent.click(runButton);

    // Button should show loading state
    await waitFor(() => {
      expect(apiService.runBriefingReport).toHaveBeenCalledWith(false);
    });

    // After completion, success message should appear and report reloaded
    await waitFor(() => {
      expect(screen.getByText(/Összefoglaló elkészült/)).toBeInTheDocument();
    });

    // Report should be refreshed
    expect(apiService.getLatestBriefingReport).toHaveBeenCalledTimes(2);
  });

  it('displays error message when run fails', async () => {
    vi.mocked(apiService.getLatestBriefingReport).mockResolvedValue(null);
    vi.mocked(apiService.runBriefingReport).mockResolvedValue({
      success: false,
      error: 'LLM nem elérhető',
    });

    render(<AIAgentBriefingPanel />);

    await waitFor(() => {
      expect(apiService.getLatestBriefingReport).toHaveBeenCalledTimes(1);
    });

    const runButton = screen.getByText('Futtatás most');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText(/Futtatási hiba.*LLM nem elérhető/)).toBeInTheDocument();
    });
  });

  it('refreshes the report on refresh button click', async () => {
    vi.mocked(apiService.getLatestBriefingReport).mockResolvedValue(MOCK_REPORT);
    render(<AIAgentBriefingPanel />);

    await waitFor(() => {
      expect(apiService.getLatestBriefingReport).toHaveBeenCalledTimes(1);
    });

    const refreshBtn = screen.getByTitle('Frissítés');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(apiService.getLatestBriefingReport).toHaveBeenCalledTimes(2);
    });
  });

  it('renders link with ExternalLink icon when item has a URL', async () => {
    vi.mocked(apiService.getLatestBriefingReport).mockResolvedValue(MOCK_REPORT);
    render(<AIAgentBriefingPanel />);

    await waitFor(() => {
      expect(apiService.getLatestBriefingReport).toHaveBeenCalledTimes(1);
    });

    const link = screen.getByTitle('Megnyitás');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://blog.langchain.dev/release-0.3');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
