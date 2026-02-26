import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NeuralLinkChat } from './NeuralLinkChat';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/apiService', () => ({
  getOllamaModels: vi.fn().mockResolvedValue([]),
  getGithubModels: vi.fn().mockResolvedValue([]),
  getGeminiModels: vi.fn().mockResolvedValue([]),
  getCloudflareStatus: vi.fn().mockResolvedValue({ status: { enabled: true, healthy: true } }),
  getActiveTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/chat/sessionStore', () => ({
  loadChatSession: vi.fn().mockReturnValue({ messages: [] }),
  saveChatSession: vi.fn(),
}));

vi.mock('@/components/dashboard/LiveExecutionMonitor', () => ({
  LiveExecutionMonitor: () => <div data-testid="live-monitor">Live Monitor</div>,
}));

// Mock ResizeObserver for ScrollArea
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('NeuralLinkChat', () => {
  it('renders the browser toggle button', () => {
    render(<NeuralLinkChat />);
    // Initial state: Browser hidden
    // We look for the button by its aria-label (accessible behavior)
    // Note: The aria-label is "Böngésző" when hidden.
    const toggleButton = screen.getByLabelText('Böngésző');
    expect(toggleButton).toBeInTheDocument();
  });

  it('shows refresh button when browser is toggled on', async () => {
    render(<NeuralLinkChat />);
    const toggleButton = screen.getByLabelText('Böngésző');

    // Click to show browser
    fireEvent.click(toggleButton);

    // Now "Refresh Browser" button should be visible (aria-label "Képernyő frissítése")
    // And toggle button label changes to "Bezár"
    await waitFor(() => {
        expect(screen.getByLabelText('Bezár')).toBeInTheDocument();
        expect(screen.getByLabelText('Képernyő frissítése')).toBeInTheDocument();
    });
  });
});
