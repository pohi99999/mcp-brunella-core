import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GrantManager } from '@/components/GrantManager';
import * as apiService from '@/lib/apiService';
import type { GrantWatcherAgentResponse } from '../../src/lib/grantFlow.js';
import { toast } from 'sonner';

vi.mock('@/lib/apiService', () => ({
  executeAgent: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const executeAgentMock = vi.mocked(apiService.executeAgent);

function createGrantResponse(draft = false): GrantWatcherAgentResponse {
  const grant = {
    title: 'NKFIH - Környezettechnológiai és mederrehabilitációs K+F 2026',
    source: 'magyar_kozlony',
    sourceUrl: 'https://palyazat.gov.hu/kornyezettechnologia-2026',
    deadline: '2026-06-30',
    fundingAmount: 85_000_000,
    currency: 'HUF',
    description: 'Iszapkezelési, mederdiagnosztikai és vízminőség-javító K+F projektek támogatása kisvállalkozásoknak.',
    publishedAt: '2026-03-01',
  };

  const payload = {
    grants: [
      {
        title: grant.title,
        deadline: grant.deadline,
        fundingAmount: grant.fundingAmount,
        isEligible: true,
      },
    ],
    upcomingDeadlines: [
      {
        title: grant.title,
        deadline: grant.deadline,
        daysRemaining: 68,
      },
    ],
    eligibleGrants: [
      {
        grant,
        matchScore: 85,
        matchReasons: [
          'TEÁOR kód egyezés: 7210',
          'Létszám megfelelő: 1 <= 50',
          'Régió egyezés: Pest',
          'Ágazat releváns',
        ],
      },
    ],
    stats: {
      totalFound: 6,
      eligible: 1,
      avgMatchScore: 85,
    },
    summaryDocUrl: 'https://docs.example.com/grant-summary',
    ...(draft
      ? {
          applicationDraft: {
            title: 'Application for NKFIH - Környezettechnológiai és mederrehabilitációs K+F 2026',
            companyName: 'Iszapfaló Kft.',
            sections: [
              { title: 'Executive Summary', content: 'Water and sludge recovery pilot' },
              { title: 'Project Description', content: 'Mederrehabilitációs K+F pilot' },
            ],
          },
        }
      : {}),
  };

  return {
    status: 'success',
    message: draft ? 'Draft ready' : 'Scan ready',
    data: payload,
  };
}

describe('GrantManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the grant shortlist and generates a draft for the selected grant', async () => {
    executeAgentMock
      .mockResolvedValueOnce(createGrantResponse(false))
      .mockResolvedValueOnce(createGrantResponse(true));

    render(<GrantManager />);

    await screen.findByRole('button', {
      name: /NKFIH - Környezettechnológiai és mederrehabilitációs K\+F 2026/,
    });
    expect(screen.getAllByText('85%').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Összefoglaló dokumentum' })).toHaveAttribute(
      'href',
      'https://docs.example.com/grant-summary',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Draft generálása' }));

    await waitFor(() => {
      expect(executeAgentMock).toHaveBeenCalledTimes(2);
    });

    expect(executeAgentMock.mock.calls[0]?.[0]).toBe('GrantWatcher');
    expect(executeAgentMock.mock.calls[1]?.[0]).toBe('GrantWatcher');

    const firstTask = JSON.parse(String(executeAgentMock.mock.calls[0]?.[1])) as Record<string, unknown>;
    expect(firstTask.companyName).toBe('Iszapfaló Kft.');
    expect(firstTask.teaorCode).toBe('7210');
    expect(firstTask.location).toBe('Pest');

    const secondTask = JSON.parse(String(executeAgentMock.mock.calls[1]?.[1])) as Record<string, unknown>;
    expect(secondTask.grantId).toBe('NKFIH - Környezettechnológiai és mederrehabilitációs K+F 2026');

    expect(await screen.findByText('Application for NKFIH - Környezettechnológiai és mederrehabilitációs K+F 2026')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('Mederrehabilitációs K+F pilot')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Pályázati shortlist frissítve.');
    expect(toast.success).toHaveBeenCalledWith('Pályázati draft elkészült.');
  });
});
