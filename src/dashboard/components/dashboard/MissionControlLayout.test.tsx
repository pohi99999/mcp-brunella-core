import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MissionControlLayout } from './MissionControlLayout';
import { LayoutProvider } from '@/lib/layout/LayoutContext';

// Mock dependencies
vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({
    logs: [],
    agents: {},
    phoenixEvents: [],
  }),
}));

vi.mock('@/context/ExperimentContext', () => ({
  useExperiments: () => ({
    layoutDensity: 'A',
  }),
}));

vi.mock('@/lib/apiService', () => ({
  getRegistry: vi.fn(() => Promise.resolve({ agents: [] })),
  executeAgent: vi.fn(() => Promise.resolve()),
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/dashboard/CommandMenu', () => ({
  CommandMenu: ({ setActiveTab, activeTab }: any) => (
    <div data-testid="command-menu">Command Menu (Active: {activeTab})</div>
  ),
}));

vi.mock('@/components/SystemBootSequence', () => ({
  SystemBootSequence: ({ onComplete }: { onComplete: () => void }) => {
    useEffect(() => {
      // Simulate boot completion after a short delay
      const timer = setTimeout(() => onComplete(), 100);
      return () => clearTimeout(timer);
    }, [onComplete]);
    return <div data-testid="boot-sequence">Booting...</div>;
  },
}));

vi.mock('@/lib/navigation', () => ({
  navigationRegistry: {
    getItem: vi.fn((tab) => {
      if (tab === 'dashboard') return { component: <div data-testid="widget-grid-mock">Widget Grid Mock</div> };
      return { component: <div data-testid={`${tab}-mock`}>Tab Content: {tab}</div> };
    }),
  },
}));

vi.mock('@/components/dashboard/DynamicSidebar', () => ({
  DynamicSidebar: ({ activeTab, onTabChange }: any) => (
    <div data-testid="dynamic-sidebar">Sidebar (Active: {activeTab})</div>
  ),
}));

// Mock WidgetGrid since its internal implementation changed. We want to test MissionControlLayout's integration.
vi.mock('@/components/dashboard/WidgetGrid', () => ({
  WidgetGrid: () => <div data-testid="widget-grid">Widget Grid</div>,
}));

describe('MissionControlLayout', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('renders successfully and boot sequence completes', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    // Initially, boot sequence should be visible
    expect(screen.getByTestId('boot-sequence')).toBeInTheDocument();

    // After boot, it should be removed and main content visible
    await waitFor(() => {
      expect(screen.queryByTestId('boot-sequence')).not.toBeInTheDocument();
    }, { timeout: 200 }); // Give enough time for the simulated boot sequence

    expect(screen.getByText('Brunella Cortex')).toBeInTheDocument();
    expect(screen.getByTestId('command-menu')).toBeInTheDocument();
    expect(screen.getByTestId('dynamic-sidebar')).toBeInTheDocument();
  });

  it('displays the default layout name in the switcher', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    await waitFor(() => expect(screen.queryByTestId('boot-sequence')).not.toBeInTheDocument());

    const layoutSwitcher = screen.getByRole('button', { name: /LAYOUT:/i });
    expect(layoutSwitcher).toBeInTheDocument();
    expect(layoutSwitcher).toHaveTextContent('LAYOUT: DEFAULT_DASHBOARD');
  });

  it('changes layout when a new mode is selected from the dropdown', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    await waitFor(() => expect(screen.queryByTestId('boot-sequence')).not.toBeInTheDocument());

    const layoutSwitcher = screen.getByRole('button', { name: /LAYOUT:/i });
    await userEvent.click(layoutSwitcher);

    const devModeOption = screen.getByText('Developer Mode');
    await userEvent.click(devModeOption);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /LAYOUT:/i })).toHaveTextContent('LAYOUT: DEVELOPER_MODE');
    });
  });

  it('renders WidgetGrid when activeTab is dashboard', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    await waitFor(() => expect(screen.queryByTestId('boot-sequence')).not.toBeInTheDocument());

    expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-mock')).not.toBeInTheDocument();

    // Simulate switching to another tab
    act(() => {
      const commandMenu = screen.getByTestId('command-menu');
      // In a real scenario, CommandMenu would call setActiveTab. Mocking directly for test control.
      // For this test, we don't have direct access to setActiveTab from MissionControlLayout. Mocking the CommandMenu behavior.
      // A more robust test might involve rendering CommandMenu fully or using a test helper to trigger context changes.
    });
    // Re-render with a different active tab if direct state manipulation was possible for activeTab in this test component.
    // For now, checking initial condition.
  });

  it('applies CSS Grid styles dynamically to the main content area', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    await waitFor(() => expect(screen.queryByTestId('boot-sequence')).not.toBeInTheDocument());

    const mainContentDiv = screen.getByRole('grid', { hidden: true }); // The main grid container
    expect(mainContentDiv).toBeInTheDocument();

    // Check for default layout grid styles
    expect(mainContentDiv).toHaveStyle('grid-template-areas: \'header header header\' \'sidebar main-top main-top\' \'sidebar main-left main-right\' \'sidebar footer footer\'');
    expect(mainContentDiv).toHaveStyle('grid-template-columns: auto 1fr 1fr');
    expect(mainContentDiv).toHaveStyle('grid-template-rows: auto 1fr 1fr auto');

    // Change layout to dev-mode and check styles
    const layoutSwitcher = screen.getByRole('button', { name: /LAYOUT:/i });
    await userEvent.click(layoutSwitcher);
    const devModeOption = screen.getByText('Developer Mode');
    await userEvent.click(devModeOption);

    await waitFor(() => {
      // Re-query the element to get updated styles after state change
      const updatedMainContentDiv = screen.getByRole('grid', { hidden: true });
      expect(updatedMainContentDiv).toHaveStyle('grid-template-areas: \'header header header\' \'sidebar dev-main dev-main\' \'sidebar dev-bottom dev-right\' \'sidebar footer footer\'');
      expect(updatedMainContentDiv).toHaveStyle('grid-template-columns: auto 2fr 1fr');
      expect(updatedMainContentDiv).toHaveStyle('grid-template-rows: auto 2fr 1fr auto');
    });
  });
});
