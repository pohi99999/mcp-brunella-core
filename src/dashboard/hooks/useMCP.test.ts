import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMCP } from './useMCP';
import { useMcpStore } from '@/lib/mcpStore';

type SocketHandler = (payload?: any) => void;

const handlerMap: Record<string, SocketHandler[]> = {};

const mockSocket = {
  on: vi.fn((event: string, handler: SocketHandler) => {
    handlerMap[event] ??= [];
    handlerMap[event].push(handler);
  }),
  off: vi.fn((event: string, handler: SocketHandler) => {
    handlerMap[event] = (handlerMap[event] ?? []).filter((entry) => entry !== handler);
  }),
  emit: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('useMCP', () => {
  const initialState = useMcpStore.getState();

  beforeEach(() => {
    useMcpStore.setState(initialState, true);
    vi.clearAllMocks();
    Object.keys(handlerMap).forEach((key) => {
      delete handlerMap[key];
    });
  });

  it('normalizes current socket payloads for logs, tools, and robotkez plan events', () => {
    renderHook(() => useMCP());

    act(() => {
      handlerMap['system:log']?.[0]?.({
        message: 'Core log entry',
        type: 'success',
        timestamp: 1234,
        source: 'server',
      });
    });

    expect(useMcpStore.getState().logs[0]).toMatchObject({
      message: 'Core log entry',
      level: 'info',
      source: 'server',
    });

    act(() => {
      handlerMap['tools_update']?.[0]?.([
        {
          name: 'filesystem.read',
          description: 'Read a file',
          parameters: [{ name: 'path', type: 'string', required: true }],
        },
      ]);
    });

    expect(useMcpStore.getState().agentTools).toMatchObject([
      {
        name: 'filesystem.read',
        parameters: [{ name: 'path', type: 'string', required: true }],
      },
    ]);

    act(() => {
      handlerMap['robotkez:plan']?.[0]?.({
        taskId: 'rk-1',
        plan: {
          plan: [{ index: 0, description: 'Open dashboard', status: 'pending' }],
          estimatedDuration: 1000,
        },
      });
    });

    expect(useMcpStore.getState().currentPlan).toMatchObject({
      id: 'rk-1',
      task: 'Robotkéz végrehajtási terv',
      steps: [{ id: 'robotkez-step-0', description: 'Open dashboard', status: 'pending' }],
    });

    act(() => {
      handlerMap['robotkez:step']?.[0]?.({
        index: 0,
        description: 'Open dashboard',
        status: 'working',
      });
    });

    expect(useMcpStore.getState().currentPlan?.steps[0]).toMatchObject({
      id: 'robotkez-step-0',
      status: 'running',
    });
  });

  it('emits dashboard messages and tool invocations through the socket', () => {
    const { result } = renderHook(() => useMCP());

    act(() => {
      result.current.sendMessage('hello', ['tool-a'], 'gpt-5', 'openai');
      result.current.runTool('filesystem.read', { path: 'README.md' });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('user_message', {
      text: 'hello',
      tools: ['tool-a'],
      model: 'gpt-5',
      provider: 'openai',
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('run_tool', {
      name: 'filesystem.read',
      args: { path: 'README.md' },
      id: expect.stringMatching(/^req-/),
    });
  });
});
