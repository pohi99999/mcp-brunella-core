// @vitest-environment jsdom

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HROnboardingWidget } from '../../../src/dashboard/components/dashboard/HROnboardingWidget.js';
import * as api from '../../../src/dashboard/lib/hrOnboardingApi.js';
import { toast } from 'sonner';

vi.mock('../../../src/dashboard/components/ui/card.js', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  CardContent: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  CardDescription: ({ children }: { children?: React.ReactNode }) => React.createElement('p', null, children),
  CardHeader: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  CardTitle: ({ children }: { children?: React.ReactNode }) => React.createElement('h2', null, children),
}));

vi.mock('../../../src/dashboard/components/ui/button.js', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) =>
    React.createElement('button', props, children),
}));

vi.mock('../../../src/dashboard/components/ui/badge.js', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
}));

vi.mock('../../../src/dashboard/components/ui/scroll-area.js', () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../../src/dashboard/components/ui/input.js', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement('input', props),
}));

vi.mock('../../../src/dashboard/components/ui/textarea.js', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => React.createElement('textarea', props),
}));

vi.mock('../../../src/dashboard/lib/hrOnboardingApi.js', () => ({
  getHROnboardingSamples: vi.fn(),
  getHROnboardingJobs: vi.fn(),
  runHROnboardingDryRun: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getHROnboardingSamples: ReturnType<typeof vi.fn>;
  getHROnboardingJobs: ReturnType<typeof vi.fn>;
  runHROnboardingDryRun: ReturnType<typeof vi.fn>;
};

describe('HROnboardingWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load samples and render the latest onboarding report', async () => {
    mockedApi.getHROnboardingSamples.mockResolvedValue([
      {
        key: 'webhook-new-hire',
        label: 'Webhook new hire',
        description: 'Teljes onboarding webhook payload HRIS forrásból.',
        payload: {},
      },
    ]);
    mockedApi.getHROnboardingJobs.mockResolvedValue([
      {
        id: 'job-1',
        type: 'hr_onboarding',
        status: 'completed',
        query: 'Kovács Anna · Account Manager',
        results_json: JSON.stringify({
          report: {
            status: 'ready',
            timestamp: '2026-04-05T00:00:00.000Z',
            summary: { total: 1, ready: 1, blocked: 0 },
            missing: [],
            issues: [],
            checklist: [
              {
                id: 'trigger-mapping',
                label: 'Onboarding trigger mapping',
                required: true,
                state: 'ready',
                details: 'Trigger mapped.',
              },
            ],
            integrations: [
              {
                channel: 'email',
                available: true,
                details: 'SMTP konfiguráció elérhető.',
              },
            ],
            nextSteps: ['Ready to launch onboarding for Kovács Anna.'],
          },
        }),
        metadata: null,
        created_at: '2026-04-05T00:00:00.000Z',
        updated_at: '2026-04-05T00:00:00.000Z',
      },
    ]);

    await act(async () => {
      render(React.createElement(HROnboardingWidget));
    });

    expect(await screen.findByText('HR Onboarding & Provisioning')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Webhook new hire' })).toBeTruthy();
    expect(await screen.findByText('READY')).toBeTruthy();
  });
});
