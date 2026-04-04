import { render, screen, act } from '@testing-library/react';
import { LayoutProvider, useLayout } from './LayoutContext';
import { LayoutModeId } from './types';

// Mock console.warn for testing warnings
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('LayoutContext', () => {
  afterEach(() => {
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should throw an error if useLayout is used outside LayoutProvider', () => {
    const TestComponent = () => {
      useLayout();
      return null;
    };

    // Suppress console.error output for expected error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      'useLayout must be used within a LayoutProvider'
    );

    consoleErrorSpy.mockRestore();
  });

  it('should provide the default layout mode', () => {
    let currentLayoutId: LayoutModeId | undefined;
    const TestComponent = () => {
      const { currentLayout } = useLayout();
      currentLayoutId = currentLayout.id;
      return <div>{currentLayout.name}</div>;
    };

    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    expect(currentLayoutId).toBe('default-dashboard');
    expect(screen.getByText('Mission Control')).toBeInTheDocument();
  });

  it('should update the layout mode when setLayoutMode is called with a valid id', () => {
    let currentLayoutId: LayoutModeId | undefined;
    const TestComponent = () => {
      const { currentLayout, setLayoutMode } = useLayout();
      currentLayoutId = currentLayout.id;
      return (
        <div>
          <span data-testid="layout-name">{currentLayout.name}</span>
          <button onClick={() => setLayoutMode('dev-mode')}>Set Dev Mode</button>
        </div>
      );
    };

    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    expect(screen.getByTestId('layout-name').textContent).toBe('Mission Control');

    act(() => {
      screen.getByText('Set Dev Mode').click();
    });

    expect(currentLayoutId).toBe('dev-mode');
    expect(screen.getByTestId('layout-name').textContent).toBe('Developer Mode');
  });

  it('should warn and not update for an invalid layout mode', () => {
    let currentLayoutId: LayoutModeId | undefined;
    const TestComponent = () => {
      const { currentLayout, setLayoutMode } = useLayout();
      currentLayoutId = currentLayout.id;
      return (
        <div>
          <span data-testid="layout-name">{currentLayout.name}</span>
          <button onClick={() => setLayoutMode('invalid-mode' as LayoutModeId)}>Set Invalid Mode</button>
        </div>
      );
    };

    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    expect(screen.getByTestId('layout-name').textContent).toBe('Mission Control');

    act(() => {
      screen.getByText('Set Invalid Mode').click();
    });

    // Expect no change in layout ID
    expect(currentLayoutId).toBe('default-dashboard');
    expect(screen.getByTestId('layout-name').textContent).toBe('Mission Control');
    expect(consoleWarnSpy).toHaveBeenCalledWith('Attempted to set unknown layout mode: invalid-mode');
  });

  it('should expose all defined layouts', () => {
    let allLayouts: any;
    const TestComponent = () => {
      const { layouts } = useLayout();
      allLayouts = layouts;
      return null;
    };

    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    expect(allLayouts.modes.length).toBeGreaterThan(0);
    expect(allLayouts.defaultMode).toBeDefined();
  });

  it('default dashboard layout should define grid areas for every assigned widget', () => {
    let currentLayout: ReturnType<typeof useLayout>['currentLayout'] | undefined;

    const TestComponent = () => {
      currentLayout = useLayout().currentLayout;
      return null;
    };

    render(
      <LayoutProvider>
        <TestComponent />
      </LayoutProvider>
    );

    const gridAreas = currentLayout?.gridTemplateAreas.join(' ') ?? '';
    for (const area of Object.values(currentLayout?.widgetAssignments ?? {})) {
      expect(gridAreas).toContain(area);
    }
    expect(currentLayout?.gridTemplateColumns).toContain('minmax(0');
  });
});
