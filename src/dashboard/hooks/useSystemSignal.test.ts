import { renderHook, act } from '@testing-library/react';
import { useSystemSignal } from './useSystemSignal';
import { useSystemSignalStore } from '../store/systemSignalStore';

// vi.hoisted() biztosítja, hogy a mock socket mindkét vi.mock() factory-ban elérhető legyen
const mockSocket = vi.hoisted(() => ({
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: false as boolean,
  io: { on: vi.fn(), off: vi.fn() },
}));

// SocketContext mock – useSocket() NEM dob ProviderError-t
vi.mock('../context/SocketContext', () => ({
  useSocket: vi.fn(() => ({ socket: mockSocket })),
  SocketContext: {},
}));

// socket.io-client mock (kötelező az implicit import-ok miatt)
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('useSystemSignal', () => {
  const initialStoreState = useSystemSignalStore.getState();

  beforeEach(() => {
    useSystemSignalStore.setState(initialStoreState, true);
    vi.clearAllMocks();
  });

  it('should return default state from store', () => {
    const { result } = renderHook(() => useSystemSignal());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.logs).toEqual([]);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.healthStatus).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.agents).toBeInstanceOf(Map);
    expect(result.current.chatter).toEqual([]);
    expect(result.current.robotkezPlan).toBeNull();
    expect(result.current.robotkezSteps).toEqual([]);
  });

  it('should return socket object from SocketContext', () => {
    const { result } = renderHook(() => useSystemSignal());

    expect(result.current.socket).toBe(mockSocket);
  });

  it('should reflect isConnected changes from store', () => {
    const { result } = renderHook(() => useSystemSignal());

    act(() => {
      useSystemSignalStore.getState().setConnected(true);
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      useSystemSignalStore.getState().setConnected(false);
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should reflect logs added to store', () => {
    const { result } = renderHook(() => useSystemSignal());

    act(() => {
      useSystemSignalStore.getState().addLog({ message: 'Teszt log', type: 'info', source: 'Test' });
    });

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0].message).toBe('Teszt log');
    expect(result.current.logs[0].type).toBe('info');
  });

  it('should reflect agent status updates from store', () => {
    const { result } = renderHook(() => useSystemSignal());

    act(() => {
      useSystemSignalStore.getState().updateAgentStatus('AgentX', 'working', 'Doing something');
    });

    expect(result.current.agents.get('AgentX')?.status).toBe('working');
    expect(result.current.agents.get('AgentX')?.taskDescription).toBe('Doing something');
  });

  it('should reflect multiple agent statuses via setAllAgentStatuses', () => {
    const { result } = renderHook(() => useSystemSignal());

    act(() => {
      useSystemSignalStore.getState().setAllAgentStatuses([
        { name: 'AgentA', status: 'idle', lastUpdated: Date.now() },
        { name: 'AgentB', status: 'working', taskDescription: 'task', lastUpdated: Date.now() },
      ]);
    });

    expect(result.current.agents.get('AgentA')?.status).toBe('idle');
    expect(result.current.agents.get('AgentB')?.status).toBe('working');
  });

  it('should reflect task updates from store', () => {
    const { result } = renderHook(() => useSystemSignal());

    const mockTask = {
      id: 't1',
      agentName: 'TestAgent',
      taskDescription: 'Test Task',
      status: 'running' as const,
      priority: 'normal' as const,
      createdAt: Date.now(),
      type: 'agent' as const,
    };

    act(() => {
      useSystemSignalStore.getState().setTasks([mockTask]);
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].id).toBe('t1');
  });

  it('should reflect healthStatus updates from store', () => {
    const { result } = renderHook(() => useSystemSignal());

    act(() => {
      useSystemSignalStore.getState().setHealthStatus({
        status: 'HEALTHY',
        timestamp: '2026-01-01T00:00:00Z',
        services: {},
      });
    });

    expect(result.current.healthStatus?.status).toBe('HEALTHY');
  });

  it('should reflect error state from store', () => {
    const { result } = renderHook(() => useSystemSignal());

    act(() => {
      useSystemSignalStore.getState().setError('Valami hiba történt');
    });

    expect(result.current.error).toBe('Valami hiba történt');

    act(() => {
      useSystemSignalStore.getState().setError(null);
    });

    expect(result.current.error).toBeNull();
  });

  it('should reflect isLoading state from store', () => {
    const { result } = renderHook(() => useSystemSignal());

    act(() => {
      useSystemSignalStore.getState().setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      useSystemSignalStore.getState().setLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should reflect cleared state after clearAllData', () => {
    const { result } = renderHook(() => useSystemSignal());

    // Feltöltjük az állapotot
    act(() => {
      useSystemSignalStore.getState().addLog({ message: 'Teszt', type: 'info', source: 'Test' });
      useSystemSignalStore.getState().setConnected(true);
      useSystemSignalStore.getState().setError('hiba');
    });

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.isConnected).toBe(true);

    // clearAllData visszaállítja az alapállapotot
    act(() => {
      useSystemSignalStore.getState().clearAllData();
    });

    expect(result.current.logs).toHaveLength(0);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should reflect robotkez plan and steps from store', () => {
    const { result } = renderHook(() => useSystemSignal());

    expect(result.current.robotkezPlan).toBeNull();
    expect(result.current.robotkezSteps).toEqual([]);

    const mockPlan = {
      taskId: 'rk-123',
      plan: {
        plan: [
          { action: 'navigate', description: 'Navigáció URL-re' },
          { action: 'click', description: 'Gomb kattintás' },
        ],
        estimatedDuration: 60,
      },
    };

    act(() => {
      useSystemSignalStore.getState().setRobotkezPlan(mockPlan);
    });

    expect(result.current.robotkezPlan?.taskId).toBe('rk-123');
    expect(result.current.robotkezSteps).toHaveLength(2);
    expect(result.current.robotkezSteps[0].status).toBe('pending');
  });
});
