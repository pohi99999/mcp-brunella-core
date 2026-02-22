import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcessControlWidget } from './ProcessControlWidget';
import { useSystemSignalStore } from '@/store/systemSignalStore';
import * as apiService from '@/lib/apiService';
import { toast } from 'sonner';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

// Mock Zustand store
const mockTasks = [
  { id: 1, description: 'Task 1', agent: 'AgentA', status: 'running', created_at: new Date().toISOString(), startedAt: new Date().toISOString() },
  { id: 2, description: 'Task 2', agent: 'AgentB', status: 'pending', created_at: new Date().toISOString() },
  { id: 3, description: 'Task 3', agent: 'AgentC', status: 'paused', created_at: new Date().toISOString() },
];

vi.mock('@/store/systemSignalStore', () => {
  let state = { tasks: [] };
  const useSystemSignalStore = vi.fn((selector) => selector(state));
  (useSystemSignalStore as any).setState = (newState: any) => {
    state = { ...state, ...newState };
  };
  return { useSystemSignalStore };
});

// Mock useSystemSignal to provide refetchData
vi.mock('@/hooks/useSystemSignal', () => ({
  useSystemSignal: vi.fn(() => ({ refetchData: vi.fn() })),
}));

// Mock apiService functions
vi.mock('@/lib/apiService', () => ({
  cancelTask: vi.fn(() => Promise.resolve()),
  retryTask: vi.fn(() => Promise.resolve()),
  pauseTask: vi.fn(() => Promise.resolve()),
  resumeTask: vi.fn(() => Promise.resolve()),
  updateTaskOrder: vi.fn(() => Promise.resolve()),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

// Helper to simulate DndContext behavior since we can't easily use the real one in JSDOM or with complicated mocks
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const original = await importOriginal() as any;
  const React = await import('react');

  // Simplified mock implementation
  const DndContext = ({ children, onDragEnd }: any) => {
    // Buttons to simulate drag events
    return React.createElement('div', { 'data-testid': 'dnd-context-mock' },
        React.createElement('button', { onClick: () => {
             // Simulate Drag 1 to 2
             onDragEnd({
                active: { id: 1 },
                over: { id: 2 },
                activatorEvent: {},
                collisions: [],
                delta: { x: 0, y: 0 },
                pointer: { x:0, y:0 }
             });
        }}, 'Simulate Drag 1 to 2'),
        children
    );
  };

  return {
    ...original,
    DndContext: DndContext,
    useSensor: vi.fn(),
    useSensors: vi.fn(() => [null, null]),
  };
});

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    useSortable: vi.fn((props) => ({
      attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 }, transition: ''
    })),
  };
});

describe('ProcessControlWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock tasks for each test to ensure a clean state
    useSystemSignalStore.setState({ tasks: [...mockTasks] });
  });

  it('renders successfully with active tasks', () => {
    render(<ProcessControlWidget />);
    expect(screen.getByText('Folyamatvezérlés')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Task 3')).toBeInTheDocument();
  });

  it('renders successfully with no active tasks', () => {
    useSystemSignalStore.setState({ tasks: [] });
    render(<ProcessControlWidget />);
    expect(screen.getByText('Nincsenek aktív vagy függőben lévő feladatok.')).toBeInTheDocument();
  });

  it('calls pauseTask and shows toast on pause button click', async () => {
    render(<ProcessControlWidget />);
    const buttons = screen.getAllByRole('button', { name: 'Szüneteltetés' });
    await userEvent.click(buttons[0]);

    await waitFor(() => {
      expect(apiService.pauseTask).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('Feladat 1 szüneteltetve.');
    });
  });

  it('calls resumeTask and shows toast on resume button click', async () => {
    render(<ProcessControlWidget />);
    const buttons = screen.getAllByRole('button', { name: 'Folytatás' });
    await userEvent.click(buttons[0]);

    await waitFor(() => {
      expect(apiService.resumeTask).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('Feladat 1 folytatva.');
    });
  });

  it('calls cancelTask and shows toast on kill button click', async () => {
    render(<ProcessControlWidget />);
    const buttons = screen.getAllByRole('button', { name: 'Leállítás' });
    await userEvent.click(buttons[0]);

    await waitFor(() => {
      expect(apiService.cancelTask).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('Feladat 1 leállítva.');
    });
  });

  it('calls retryTask and shows toast on retry button click', async () => {
    render(<ProcessControlWidget />);
    const buttons = screen.getAllByRole('button', { name: 'Újrapróbálkozás' });
    await userEvent.click(buttons[0]);

    await waitFor(() => {
      expect(apiService.retryTask).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('Feladat 1 újrapróbálva.');
    });
  });

  it('opens and closes TaskDetailsModal on details button click', async () => {
    render(<ProcessControlWidget />);
    const buttons = screen.getAllByRole('button', { name: 'Részletek' });

    await userEvent.click(buttons[0]);
    expect(screen.getByText('Feladat Részletei: Task 1')).toBeInTheDocument();

    // Simulate clicking the overlay to close the dialog
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Feladat Részletei: Task 1')).not.toBeInTheDocument();
  });

  it('reorders tasks on drag and calls updateTaskOrder', async () => {
    const currentTasks = [
      { id: 1, description: 'Task 1', agent: 'AgentA', status: 'running', created_at: new Date().toISOString(), startedAt: new Date().toISOString() },
      { id: 2, description: 'Task 2', agent: 'AgentB', status: 'pending', created_at: new Date().toISOString() },
    ];
    useSystemSignalStore.setState({ tasks: currentTasks });

    render(<ProcessControlWidget />);

    // Initial order
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();

    // Simulate drag from 1 to 2
    await userEvent.click(screen.getByText('Simulate Drag 1 to 2'));

    // Check if UI reflects new order
    // This will depend on how the `SortableItem` renders. For now, check `updateTaskOrder` call.
    await waitFor(() => {
      expect(apiService.updateTaskOrder).toHaveBeenCalledWith([2, 1]);
      expect(toast.success).toHaveBeenCalledWith('Feladatok sorrendje frissítve.');
    });
  });
});
