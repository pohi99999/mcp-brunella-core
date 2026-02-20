import { renderHook, act, waitFor } from '@testing-library/react';
import { useSystemSignal } from './useSystemSignal';
import { useSystemSignalStore } from '../store/systemSignalStore';
import { io as mockedIo, Socket as MockSocket } from 'socket.io-client';
import * as apiService from '../lib/apiService';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    io: { on: vi.fn(), off: vi.fn() }, // Mock for manager events
  };
  return {
    io: vi.fn(() => mockSocket),
  };
});

// Mock apiService
vi.mock('../lib/apiService', () => ({
  getTasks: vi.fn(() => Promise.resolve({ tasks: [], total: 0, limit: 0, offset: 0 })),
  getTaskStats: vi.fn(() => Promise.resolve({ total: 0, successCount: 0, errorCount: 0, pendingCount: 0, runningCount: 0, cancelledCount: 0, successRate: 0, avgDurationMs: 0, failedByAgent: [] })),
  checkHealth: vi.fn(() => Promise.resolve({ status: 'HEALTHY', timestamp: '', services: {} })),
  getDeveloperMetrics: vi.fn(() => Promise.resolve({ builds: {}, tests: {}, tasks: {}, ai: {}, history: [] })),
}));

const mockSocket = mockedIo() as MockSocket;

describe('useSystemSignal', () => {
  const initialStoreState = useSystemSignalStore.getState();

  beforeEach(() => {
    // Reset Zustand store to initial state before each test
    useSystemSignalStore.setState(initialStoreState, true);
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSystemSignal());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.logs).toEqual([]);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.healthStatus).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should connect and disconnect WebSocket', async () => {
    renderHook(() => useSystemSignal());

    // Simulate socket connect
    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'connect')[1]();
    });
    await waitFor(() => expect(useSystemSignalStore.getState().isConnected).toBe(true));
    expect(useSystemSignalStore.getState().logs[0].message).toContain('Socket csatlakozva');

    // Simulate socket disconnect
    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'disconnect')[1]('client disconnect');
    });
    await waitFor(() => expect(useSystemSignalStore.getState().isConnected).toBe(false));
    expect(useSystemSignalStore.getState().logs[0].message).toContain('Socket bontva');
  });

  it('should update store on system:log event', async () => {
    renderHook(() => useSystemSignal());

    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'system:log')[1]({
        message: 'Test Log', type: 'info', source: 'Test'
      });
    });

    await waitFor(() => {
      const logs = useSystemSignalStore.getState().logs;
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test Log');
    });
  });

  it('should update store on agent:chatter event', async () => {
    renderHook(() => useSystemSignal());

    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'agent:chatter')[1]({
        sender: 'AgentX', message: 'Hello', timestamp: 123
      });
    });

    await waitFor(() => {
      const chatter = useSystemSignalStore.getState().chatter;
      expect(chatter).toHaveLength(1);
      expect(chatter[0].sender).toBe('AgentX');
    });
  });

  it('should update store on agent:update event', async () => {
    renderHook(() => useSystemSignal());

    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'agent:update')[1]({
        agentName: 'AgentY', status: 'working', taskDescription: 'Doing something'
      });
    });

    await waitFor(() => {
      const agents = useSystemSignalStore.getState().agents;
      expect(agents.get('AgentY')?.status).toBe('working');
      expect(agents.get('AgentY')?.taskDescription).toBe('Doing something');
    });
  });

  it('should handle robotkez:plan and robotkez:step events', async () => {
    renderHook(() => useSystemSignal());

    const mockPlan: RobotkezPlan = {
      taskId: '123',
      plan: {
        plan: [
          { action: 'navigate', description: 'Go to URL' },
          { action: 'click', description: 'Click button' },
        ],
        estimatedDuration: 100,
      },
    };

    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'robotkez:plan')[1](mockPlan);
    });

    await waitFor(() => {
      const state = useSystemSignalStore.getState();
      expect(state.robotkezPlan).toEqual(mockPlan);
      expect(state.robotkezSteps).toHaveLength(2);
      expect(state.robotkezSteps[0].status).toBe('pending');
    });

    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'robotkez:step')[1]({
        index: 0, status: 'completed', screenshot: 'data:image/png;base64...'
      });
    });

    await waitFor(() => {
      const state = useSystemSignalStore.getState();
      expect(state.robotkezSteps[0].status).toBe('completed');
      expect(state.robotkezSteps[0].screenshot).toBeDefined();
    });
  });

  it('should clear robotkez state on robotkez:aborted', async () => {
    renderHook(() => useSystemSignal());

    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'robotkez:aborted')[1]();
    });

    await waitFor(() => {
      const state = useSystemSignalStore.getState();
      expect(state.robotkezPlan).toBeNull();
      expect(state.robotkezSteps).toEqual([]);
    });
  });

  it('should fetch data via REST polling when not connected', async () => {
    // Ensure socket is mocked as disconnected initially
    (mockSocket as any).connected = false;

    const { result } = renderHook(() => useSystemSignal());

    // Advance timers for initial fetch
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(apiService.getTasks).toHaveBeenCalledTimes(1);
      expect(apiService.getTaskStats).toHaveBeenCalledTimes(1);
      expect(apiService.checkHealth).toHaveBeenCalledTimes(1);
      expect(apiService.getDeveloperMetrics).toHaveBeenCalledTimes(1);
    });

    // Simulate subsequent polling
    act(() => { vi.advanceTimersByTime(5000); });

    await waitFor(() => {
      expect(apiService.getTasks).toHaveBeenCalledTimes(2);
      expect(apiService.getTaskStats).toHaveBeenCalledTimes(2);
    });
  });

  it('should fetch data via REST polling when options.enablePolling is true', async () => {
    // Simulate socket connected to ensure it's the options that trigger polling
    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'connect')[1]();
    });
    await waitFor(() => expect(useSystemSignalStore.getState().isConnected).toBe(true));

    const { result } = renderHook(() => useSystemSignal({ enablePolling: true, pollingInterval: 1000 }));

    // Advance timers for initial fetch
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(apiService.getTasks).toHaveBeenCalledTimes(1);
      expect(apiService.getTaskStats).toHaveBeenCalledTimes(1);
    });

    // Simulate subsequent polling
    act(() => { vi.advanceTimersByTime(1000); });

    await waitFor(() => {
      expect(apiService.getTasks).toHaveBeenCalledTimes(2);
      expect(apiService.getTaskStats).toHaveBeenCalledTimes(2);
    });
  });

  it('should set error state if WebSocket connection fails', async () => {
    renderHook(() => useSystemSignal());

    act(() => {
      mockSocket.on.mock.calls.find((call) => call[0] === 'connect_error')[1](new Error('Connection refused'));
    });

    await waitFor(() => {
      expect(useSystemSignalStore.getState().error).toBe('Connection refused');
      expect(useSystemSignalStore.getState().logs[0].message).toContain('Socket kapcsolódási hiba');
    });
  });

  it('should set error state if REST API call fails', async () => {
    // Mock an API service to reject
    (apiService.getTasks as vi.Mock).mockRejectedValueOnce(new Error('Failed to fetch tasks'));

    renderHook(() => useSystemSignal());

    // Advance timers for initial fetch
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(useSystemSignalStore.getState().error).toBe('Failed to fetch tasks');
      expect(useSystemSignalStore.getState().logs[0].message).toContain('REST adatlekérdezési hiba');
    });
  });
});
