import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminSelfCheckWidget } from './AdminSelfCheckWidget';
import { useSystemSignalStore } from '@/store/systemSignalStore';
import * as apiService from '@/lib/apiService';
import { toast } from 'sonner';

// Mock Zustand store
const mockLogs = [
  { id: 'log-1', message: 'Backend kapcsolat ellenőrzése...', type: 'info', timestamp: Date.now(), source: 'SelfCheck' },
  { id: 'log-2', message: 'Backend állapot: HEALTHY', type: 'success', timestamp: Date.now(), source: 'SelfCheck' },
];

vi.mock('@/store/systemSignalStore', () => ({
  useSystemSignalStore: vi.fn((selector) => selector({
    logs: mockLogs,
    isConnected: true, // Simulate connected socket for checks
    addLog: vi.fn(),
  })),
}));

// Mock apiService functions
vi.mock('@/lib/apiService', () => ({
  checkHealth: vi.fn(() => Promise.resolve({ status: 'HEALTHY', timestamp: '', services: {} })),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

describe('AdminSelfCheckWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store for each test
    useSystemSignalStore.setState({ logs: [...mockLogs], isConnected: true, addLog: vi.fn() });
    process.env.VITE_ADMIN_PASSWORD = 'testpass'; // Set a consistent mock password
  });

  it('renders password input when not authenticated', () => {
    render(<AdminSelfCheckWidget />);
    expect(screen.getByLabelText('Admin Jelszó')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Belépés' })).toBeInTheDocument();
    expect(screen.queryByText('Admin / Öndiagnosztika')).toBeInTheDocument();
  });

  it('authenticates successfully with correct password', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByLabelText('Admin Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Hitelesítés sikeres.');
      expect(screen.queryByLabelText('Admin Jelszó')).not.toBeInTheDocument();
      expect(screen.getByText('Backend Check')).toBeInTheDocument();
    });
  });

  it('shows error toast with incorrect password', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByLabelText('Admin Jelszó'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Érvénytelen jelszó.');
      expect(screen.getByLabelText('Admin Jelszó')).toBeInTheDocument(); // Still present
    });
  });

  it('runs Backend Check and displays result', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByLabelText('Admin Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));

    await waitFor(() => expect(screen.getByText('Backend Check')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Backend Check' }));

    await waitFor(() => {
      expect(apiService.checkHealth).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Backend Health:')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument(); // Expecting true for health.status === "HEALTHY"
    });
  });

  it('runs UI Render Check and displays result', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByLabelText('Admin Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));

    await waitFor(() => expect(screen.getByText('UI Render Check')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'UI Render Check' }));

    await waitFor(() => {
      expect(screen.getByText('Component Render:')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
    });
  });

  it('runs Socket Check and displays result', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByLabelText('Admin Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));

    await waitFor(() => expect(screen.getByText('Socket Check')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Socket Check' }));

    await waitFor(() => {
      expect(screen.getByText('Socket Responsive:')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
    });
  });

  it('runs Full Diagnostics and displays all results', async () => {
    // Mock API services to return specific values for this test
    (apiService.checkHealth as vi.Mock).mockResolvedValueOnce({ status: 'DEGRADED', timestamp: '', services: {} });

    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByLabelText('Admin Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));

    await waitFor(() => expect(screen.getByText('Teljes Diagnosztika')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Teljes Diagnosztika' }));

    await waitFor(() => {
      expect(apiService.checkHealth).toHaveBeenCalledTimes(1);
      expect(toast.info).toHaveBeenCalledWith('Teljes diagnosztika futtatva.');
      expect(screen.getByText('Backend Health:')).toBeInTheDocument();
      expect(screen.getByText('false')).toBeInTheDocument(); // DEGRADED should result in false
      expect(screen.getByText('Component Render:')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
      expect(screen.getByText('Socket Responsive:')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
    });
  });

  it('displays Self-Check logs', async () => {
    render(<AdminSelfCheckWidget />);
    await userEvent.type(screen.getByLabelText('Admin Jelszó'), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));
    await waitFor(() => expect(screen.getByText('Self-Check Napló')).toBeInTheDocument());

    expect(screen.getByText('Backend kapcsolat ellenőrzése...')).toBeInTheDocument();
    expect(screen.getByText('Backend állapot: HEALTHY')).toBeInTheDocument();
  });
});
