import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadMiningWidget } from './LeadMiningWidget';
import { useBusinessStore } from '../../lib/businessStore';

vi.mock('../../context/SocketContext', () => ({
  useSocket: () => ({ socket: null }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const createJsonResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe('LeadMiningWidget', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    vi.clearAllMocks();
    useBusinessStore.setState({
      jobs: [],
      isLoading: false,
      error: null,
    });
  });

  it('renders live lead mining jobs from businessStore data', async () => {
    const jobsResponse = {
      success: true,
      jobs: [
        {
          id: 'job-1',
          type: 'lead_mining',
          query: 'fogorvos Budapest',
          status: 'completed',
          created_at: '2026-04-15T08:00:00.000Z',
          updated_at: '2026-04-15T08:05:00.000Z',
          results_json: JSON.stringify({
            jobId: 'job-1',
            query: 'fogorvos Budapest',
            leadType: 'KKV',
            limit: 10,
            syncCount: 1,
            leads: [
              {
                company_name: 'Fogorvos 360',
                website: 'https://fogorvos360.hu',
                contact_email: 'hello@fogorvos360.hu',
                email_status: 'valid',
                icebreaker_text: 'Szeretnénk egy rövid bemutatkozást küldeni.',
              },
            ],
          }),
        },
      ],
    };

    fetchMock.mockResolvedValueOnce(createJsonResponse(jobsResponse) as never);

    render(<LeadMiningWidget />);

    await waitFor(() => {
      expect(screen.getByText('Fogorvos 360')).toBeInTheDocument();
    });

    expect(screen.getByText('B2B Lead Mining')).toBeInTheDocument();
    expect(screen.getByText('1 lead')).toBeInTheDocument();
    expect(screen.getByText('hello@fogorvos360.hu')).toBeInTheDocument();
  });

  it('starts a new lead mining job with the provided query and limit metadata', async () => {
    const user = userEvent.setup();
    const jobsResponse = {
      success: true,
      jobs: [],
    };

    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === 'POST') {
        return createJsonResponse({ success: true, jobId: 'job-2' }) as never;
      }

      return createJsonResponse(jobsResponse) as never;
    });

    render(<LeadMiningWidget />);

    await user.clear(screen.getByPlaceholderText('pl. fogorvos Budapest'));
    await user.type(screen.getByPlaceholderText('pl. fogorvos Budapest'), 'kozmetikus Szeged');
    await user.clear(screen.getByPlaceholderText('10'));
    await user.type(screen.getByPlaceholderText('10'), '12');
    await user.click(screen.getByRole('button', { name: /lead mining indítása/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/business-jobs',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('kozmetikus Szeged'),
        }),
      );
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const parsedBody = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(parsedBody).toMatchObject({
      type: 'lead_mining',
      query: 'kozmetikus Szeged',
      metadata: {
        limit: 12,
      },
    });
  });
});
