import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSelfCheckWidget } from './AdminSelfCheckWidget';
import { useSystemSignalStore } from '@/store/systemSignalStore';
import * as apiService from '@/lib/apiService';
import { toast } from 'sonner';

// Mock SocketContext so component doesn't need SocketProvider
vi.mock('../../context/SocketContext', () => ({
  useSocket: vi.fn(() => ({ socket: null, isConnected: false })),
}));

// Mock uiTester to avoid real DOM tests timing out
vi.mock('../../lib/uiTester', () => ({
  uiTester: {
    runAllTests: vi.fn(() => Promise.resolve([
      { name: 'Component Render', status: 'pass', durationMs: 5 },
    ])),
  },
}));

const mockLogs = [
  { id: 'log-1', message: 'Backend kapcsolat ellenőrzése...', type: 'info', timestamp: Date.now(), source: 'SelfCheck' },
  { id: 'log-2', message: 'Backend állapot: HEALTHY', type: 'success', timestamp: Date.now(), source: 'SelfCheck' },
];

vi.mock('@/store/systemSignalStore', () => ({
  useSystemSignalStore: vi.fn((selector) => selector({
    logs: mockLogs,
    isConnected: false,
    addLog: vi.fn(),
  })),
}));

vi.mock('@/lib/apiService', () => ({
  checkHealth: vi.fn(() => Promise.resolve({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      ollama: { status: 'healthy', latencyMs: 42 },
      python: { status: 'healthy', latencyMs: 10 },
      cloudflare: { status: 'healthy', latencyMs: 5 },
      anythingllm: { status: 'healthy', latencyMs: 20 },
      agents: { status: 'healthy', latencyMs: 0 },
    },
  })),
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

describe('AdminSelfCheckWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSystemSignalStore).mockImplementation((selector) =>
      selector({ logs: [...mockLogs], isConnected: false, addLog: vi.fn() })
    );
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'testpass');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the password input and auth button when not authenticated', () => {
    render(<AdminSelfCheckWidget />);
    expect(screen.getByPlaceholderText('Jelszó')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hitelesítés' })).toBeInTheDocument();
    expect(screen.getByText('System Self-Check')).toBeInTheDocument();
  });

  it('authenticates successfully with correct password', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByPlaceholderText('Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Hitelesítés' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Hitelesítés sikeres')
      );
      expect(screen.queryByPlaceholderText('Jelszó')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Diagnosztika/i })).toBeInTheDocument();
    });
  });

  it('shows error toast with incorrect password', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByPlaceholderText('Jelszó'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Hitelesítés' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Érvénytelen jelszó.');
      expect(screen.getByPlaceholderText('Jelszó')).toBeInTheDocument();
    });
  });

  it('runs diagnostics and displays service health data', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByPlaceholderText('Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Hitelesítés' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Diagnosztika/i })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', { name: /Diagnosztika Futtatása/i }));

    await waitFor(() => {
      expect(apiService.checkHealth).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Ollama (Local LLM)')).toBeInTheDocument();
      expect(screen.getByText('Python Subsystem')).toBeInTheDocument();
    });
  });

  it('shows logout button after authentication', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByPlaceholderText('Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Hitelesítés' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Kilépés' })).toBeInTheDocument()
    );
  });

  it('logs out when Kilépés is clicked', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByPlaceholderText('Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Hitelesítés' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Kilépés' })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('button', { name: 'Kilépés' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Jelszó')).toBeInTheDocument();
    });
  });

  it('shows System Self-Check title and description', () => {
    render(<AdminSelfCheckWidget />);
    expect(screen.getByText('System Self-Check')).toBeInTheDocument();
    expect(screen.getByText('Adminisztrációs és öndiagnosztikai központ')).toBeInTheDocument();
  });

  it('shows Zárt terület text in unauthenticated state', () => {
    render(<AdminSelfCheckWidget />);
    expect(screen.getByText('Zárt terület')).toBeInTheDocument();
  });

  it('shows no diagnositc data message before running diagnostics', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByPlaceholderText('Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Hitelesítés' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Diagnosztika/i })).toBeInTheDocument()
    );

    expect(screen.getByText(/Nincs friss diagnosztikai adat/i)).toBeInTheDocument();
  });
});
