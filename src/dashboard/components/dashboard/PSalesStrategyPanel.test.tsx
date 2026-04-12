import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PSalesStrategyPanel } from './PSalesStrategyPanel';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function mockFetchResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe('PSalesStrategyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the onboarding approval queue on mount', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/webhook/onboarding-intake/pending') {
        return Promise.resolve(mockFetchResponse({
          status: 'ok',
          count: 1,
          jobs: [
            {
              id: 'job-1',
              query: 'Acme Kft | kkv_general',
              status: 'pending_approval',
              metadata: JSON.stringify({
                client_name: 'Acme Kft',
                contact_email: 'ops@acme.test',
                form_type: 'kkv_general',
                pain_point: 'Könyvelés',
              }),
            },
          ],
        }));
      }

      return Promise.resolve(mockFetchResponse({ ok: true }));
    }));

    render(<PSalesStrategyPanel />);

    await screen.findByText('Onboarding approval queue');
    await screen.findByText('Acme Kft');
    expect(screen.getByText('ops@acme.test')).toBeInTheDocument();
    expect(screen.getByText('Form: kkv_general')).toBeInTheDocument();
    expect(screen.getByText('Probléma: Könyvelés')).toBeInTheDocument();
  });

  it('approves an intake from the dashboard queue and refreshes the list', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse({
        status: 'ok',
        count: 1,
        jobs: [
          {
            id: 'job-42',
            query: 'Northwind Logistics | kkv_general',
            status: 'pending_approval',
            metadata: JSON.stringify({
              client_name: 'Northwind Logistics',
              contact_email: 'hello@northwind.test',
              form_type: 'kkv_general',
              pain_point: 'Készlet / logisztika',
            }),
          },
        ],
      }))
      .mockResolvedValueOnce(mockFetchResponse({
        status: 'ok',
        job_id: 'job-42',
        queued_task_id: 42,
      }))
      .mockResolvedValueOnce(mockFetchResponse({
        status: 'ok',
        count: 0,
        jobs: [],
      }));

    vi.stubGlobal('fetch', fetchMock);

    render(<PSalesStrategyPanel />);

    await screen.findByText('Northwind Logistics');
    await userEvent.click(screen.getByRole('button', { name: 'Jóváhagyás' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/webhook/onboarding-intake/job-42/approve',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Onboarding intake jóváhagyva és sorba állítva.');
    });

    await waitFor(() => {
      expect(screen.getByText('Nincs jóváhagyásra váró onboarding intake.')).toBeInTheDocument();
    });
  });
});
