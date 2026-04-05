import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const promptMock = vi.hoisted(() => vi.fn());
const fetchWithTimeoutMock = vi.hoisted(() => vi.fn());
const logInfoMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());

vi.mock('inquirer', () => ({
  default: {
    prompt: promptMock,
  },
}));

vi.mock('../src/dashboard/lib/apiService.js', () => ({
  fetchWithTimeout: fetchWithTimeoutMock,
  safeJson: async (response: Response) => JSON.parse(await response.text()) as unknown,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: logInfoMock,
  logError: logErrorMock,
}));

describe('hrOnboardingCommand', () => {
  beforeEach(() => {
    promptMock.mockReset();
    fetchWithTimeoutMock.mockReset();
    logInfoMock.mockReset();
    logErrorMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should print sample payloads when the samples action is selected', async () => {
    fetchWithTimeoutMock.mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        samples: [
          {
            key: 'webhook-new-hire',
            label: 'Webhook new hire',
            description: 'Teljes onboarding webhook payload HRIS forrásból.',
            payload: {},
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    promptMock.mockResolvedValueOnce({ action: 'samples' });

    const { hrOnboardingCommand } = await import('../src/cli/commands/hr-onboarding-hu.js');
    await hrOnboardingCommand();

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).not.toHaveBeenCalled();
  });
});

