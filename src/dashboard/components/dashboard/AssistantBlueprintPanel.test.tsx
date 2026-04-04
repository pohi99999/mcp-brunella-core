import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantBlueprintPanel } from './AssistantBlueprintPanel';
import * as apiService from '@/lib/apiService';

vi.mock('@/lib/apiService', () => ({
  getAssistantBlueprint: vi.fn(),
}));

describe('AssistantBlueprintPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getAssistantBlueprint).mockResolvedValue({
      assistantName: 'Brunella Personal AI',
      targetPlatform: 'Windows',
      generatedAt: '2026-04-02T22:00:00.000Z',
      recommendedMode: {
        primaryCloudProvider: 'github',
        localFallbackProvider: 'ollama',
        desktopShell: 'Tauri',
        recommendation: 'Brunella stack',
      },
      overallReadiness: {
        score: 80,
        label: 'Erős alap',
        summary: 'summary',
      },
      providerHealth: [
        {
          provider: 'github',
          available: true,
          last_check: '2026-04-02T21:55:00.000Z',
        },
      ],
      capabilities: [
        {
          id: 'desktop-shell',
          title: 'Desktop shell',
          status: 'partial',
          score: 72,
          summary: 'A responsive desktop shell is available for Mission Control.',
          details: ['Tauri shell', 'Responsive dashboard'],
        },
      ],
      architecture: [
        {
          id: 'control-plane',
          title: 'Node control plane',
          summary: 'Express + MCP runtime',
          modules: ['Express', 'MCP'],
          purpose: 'Serve dashboard and orchestrate tools.',
        },
      ],
      roadmap: [
        {
          id: 'phase-1',
          title: 'Stabilization',
          goal: 'Close the remaining dashboard drift.',
          deliverables: ['Coverage', 'A11y'],
        },
      ],
      nextActions: ['Wire MCP contracts'],
    } as apiService.AssistantBlueprint);
  });

  it('renders the current assistant blueprint summary, capability, and next actions', async () => {
    render(<AssistantBlueprintPanel />);

    await waitFor(() => {
      expect(screen.getByText('Brunella Personal AI')).toBeInTheDocument();
    });

    expect(screen.getByText('Brunella stack')).toBeInTheDocument();
    expect(screen.getByText('Tauri')).toBeInTheDocument();
    expect(screen.getByText('Node control plane')).toBeInTheDocument();
    expect(screen.getByText('Azonnali következő lépések')).toBeInTheDocument();
    expect(screen.getByText('Wire MCP contracts')).toBeInTheDocument();
  });
});
