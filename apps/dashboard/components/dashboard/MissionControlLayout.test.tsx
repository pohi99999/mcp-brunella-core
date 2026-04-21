import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  checkHealth: vi.fn(() => Promise.resolve({ status: 'ok' })),
  getRegistry: vi.fn(() => Promise.resolve({ agents: [] })),
  executeAgent: vi.fn(() => Promise.resolve()),
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/dashboard/CommandMenu', () => ({
  CommandMenu: ({ activeTab }: any) => (
    <div data-testid="command-menu">Command Menu (Active: {activeTab})</div>
  ),
}));

vi.mock('@/lib/navigation', () => ({
  navigationRegistry: {
    getItem: vi.fn((tab) => {
      if (tab === 'dashboard') return { component: <div data-testid="widget-grid-mock">Widget Grid Mock</div> };
      return { component: <div data-testid={`${tab}-mock`}>Tab Content: {tab}</div> };
    }),
    getGroups: vi.fn(() => []),
    getAllItems: vi.fn(() => []),
  },
}));

vi.mock('@/components/dashboard/DynamicSidebar', () => ({
  DynamicSidebar: ({ activeTab, forceExpanded, onTabChange }: any) => (
    <div data-testid="dynamic-sidebar" data-force-expanded={forceExpanded ? 'true' : 'false'}>
      <span>Sidebar (Active: {activeTab})</span>
      <button type="button" onClick={() => onTabChange('tracks')}>
        Open Tracks
      </button>
    </div>
  ),
}));

vi.mock('@/components/dashboard/WidgetGrid', () => ({
  WidgetGrid: () => <div data-testid="widget-grid">Widget Grid</div>,
}));

vi.mock('@/components/dashboard/TerminalLog', () => ({
  TerminalLog: () => <div data-testid="terminal-log">Terminal Log</div>,
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

describe('MissionControlLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders successfully with header and sidebar', () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    expect(screen.getByText('Brunella')).toBeInTheDocument();
    expect(screen.getByTestId('command-menu')).toBeInTheDocument();
    expect(screen.getByTestId('dynamic-sidebar')).toBeInTheDocument();
  });

  it('renders the brand name and subtitle', () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    expect(screen.getByText('Brunella')).toBeInTheDocument();
    expect(screen.getByText('Mission Control')).toBeInTheDocument();
  });

  it('displays the default layout name (MISSION_CONTROL) in the layout switcher button', () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    // The layout switcher button shows "LAYOUT MISSION_CONTROL" (uppercased name with underscores)
    const layoutBtn = screen.getByRole('button', { name: /LAYOUT/i });
    expect(layoutBtn).toBeInTheDocument();
    expect(layoutBtn).toHaveTextContent('MISSION_CONTROL');
  });

  it('changes layout when a new mode is selected from the dropdown', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    const layoutBtn = screen.getByRole('button', { name: /LAYOUT/i });
    fireEvent.pointerDown(layoutBtn);
    fireEvent.click(layoutBtn);

    const devModeOption = await screen.findByRole('menuitem', { name: /Developer Mode/i });
    fireEvent.click(devModeOption);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /LAYOUT/i })).toHaveTextContent('DEVELOPER_MODE');
    });
  });

  it('renders WidgetGrid when activeTab is dashboard (default)', () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    expect(screen.getByTestId('widget-grid')).toBeInTheDocument();
  });

  it('shows terminal log when terminal is expanded', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    // Terminal starts collapsed, expand it
    const expandBtn = screen.getByLabelText('Expand terminal');
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByTestId('terminal-log')).toBeInTheDocument();
    });
  });

  it('has a status indicator in the header', () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    // Status label is rendered (OFFLINE initially, HEALTHY after health check resolves)
    // Initially OFFLINE before the async health check
    expect(screen.getByText(/CORE OFFLINE/)).toBeInTheDocument();
  });

  it('shows HEALTHY status after a successful health check', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    await waitFor(() => {
      expect(screen.getByText(/CORE HEALTHY/)).toBeInTheDocument();
    });
  });

  // ── Mobile drawer / Sheet a11y tests ────────────────────────────────────
  // These validate the accessibility work done on the mobile navigation Sheet:
  // aria-label on the trigger, sr-only SheetTitle, and SheetDescription.

  it('mobile menu trigger has aria-label "Open navigation menu"', () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    // The button is md:hidden via CSS; jsdom doesn't apply CSS so it's always queryable.
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-label', 'Open navigation menu');
  });

  it('mobile menu trigger also carries a matching title attribute', () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(trigger).toHaveAttribute('title', 'Open navigation menu');
  });

  it('clicking the mobile menu trigger opens the Sheet drawer with accessible title', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });

    // Radix SheetTrigger uses pointer events — fire both as the real browser would.
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    // SheetTitle "Navigation menu" is sr-only but present in the DOM when open.
    await waitFor(() => {
      expect(screen.getByText('Navigation menu')).toBeInTheDocument();
    });
  });

  it('the open Sheet has an accessible description about navigation', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });

    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByText(/Switch between dashboard sections/i)
      ).toBeInTheDocument();
    });
  });

  it('keyboard: focused trigger opens the mobile drawer; Escape closes it', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });

    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    // Native <button> fires click on keyboard activation — simulate that
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Sidebar (Active: dashboard)')).toBeInTheDocument();
    expect(within(dialog).getByTestId('dynamic-sidebar')).toHaveAttribute('data-force-expanded', 'true');

    // Radix Sheet/Dialog handles Escape via keydown bubbled through the document
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes the mobile drawer after selecting a destination', async () => {
    render(<MissionControlLayout />, { wrapper: LayoutProvider });
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });

    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /open tracks/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('tracks-mock')).toBeInTheDocument();
  });
});
