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
      roles: [
        {
          id: 'brunella',
          title: 'Brunella — Rendszeridentitás',
          description: 'A központi persona.',
          status: 'ready',
        },
        {
          id: 'project_maintainer',
          title: 'Project Maintainer — Karbantartó',
          description: 'Dry-run operator szerepkör.',
          status: 'partial',
        },
      ],
      providerHealth: [],
      capabilities: [],
      architecture: [],
      roadmap: [],
      nextActions: [],
    } as apiService.AssistantBlueprint);
  });

  it('renders Brunella role cards when roles are present', async () => {
    render(<AssistantBlueprintPanel />);

    await waitFor(() => {
      expect(screen.getByText('Rendszeridentitás szerepkörök')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Brunella — Rendszeridentitás').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Project Maintainer — Karbantartó').length).toBeGreaterThan(0);
  });
});
