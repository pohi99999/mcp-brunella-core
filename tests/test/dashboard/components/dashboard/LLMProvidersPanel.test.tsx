import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LLMProvidersPanel } from '@/components/dashboard/LLMProvidersPanel';
import * as apiService from '@/lib/apiService';
import { toast } from 'sonner';

vi.mock('@/lib/apiService', () => ({
  getLLMProviderStatus: vi.fn(),
  getLLMModelCatalog: vi.fn(),
  generateWithAnthropic: vi.fn(),
  generateWithGemini: vi.fn(),
  generateWithGithubModels: vi.fn(),
  generateWithOllama: vi.fn(),
}));

vi.mock('@/lib/websocketClient', () => ({
  useWebSocketEvents: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const getLLMProviderStatusMock = vi.mocked(apiService.getLLMProviderStatus);
const getLLMModelCatalogMock = vi.mocked(apiService.getLLMModelCatalog);
const generateWithAnthropicMock = vi.mocked(apiService.generateWithAnthropic);

describe('LLMProvidersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Anthropic provider card and runs a model test', async () => {
    getLLMProviderStatusMock.mockResolvedValue({
      providers: [
        {
          id: 'anthropic',
          name: 'Anthropic Claude',
          status: 'online',
          latency: 42,
        },
      ],
    });
    getLLMModelCatalogMock.mockResolvedValue({
      providers: [
        {
          id: 'anthropic',
          label: 'Anthropic Claude',
          enabled: true,
          defaultModel: 'claude-3-5-sonnet-20241022',
          models: [
            {
              id: 'claude-3-5-sonnet-20241022',
              name: 'claude-3-5-sonnet-20241022',
              provider: 'anthropic',
              source: 'default',
            },
          ],
        },
      ],
    });
    generateWithAnthropicMock.mockResolvedValue('Anthropic válasz');

    render(<LLMProvidersPanel />);

    expect(await screen.findByText('Anthropic Claude')).toBeInTheDocument();
    expect(screen.getByDisplayValue('claude-3-5-sonnet-20241022')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Teszt Futtatása' }));

    await waitFor(() => {
      expect(generateWithAnthropicMock).toHaveBeenCalledWith(
        'Mi a fővárosa Franciaországnak?',
        'claude-3-5-sonnet-20241022',
      );
    });

    expect(await screen.findByText(/Válasz: Anthropic válasz/)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Sikeres teszt (anthropic)!');
  });
});
