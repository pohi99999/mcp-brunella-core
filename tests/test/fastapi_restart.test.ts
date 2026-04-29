import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastApiService } from '@packages/core-logic/fastApiService.js';
import * as child_process from 'child_process';
import * as net from 'net';
import * as pythonUtils from '@packages/utils/pythonUtils.js';
import * as processUtils from '@packages/utils/processUtils.js';
import * as serverManager from '@packages/utils/serverManager.js';
import EventEmitter from 'events';

// Mocks
vi.mock('child_process');
vi.mock('net');
vi.mock('@packages/utils/pythonUtils.js');
vi.mock('@packages/utils/processUtils.js');
vi.mock('@packages/utils/serverManager.js');

describe('FastApiService', () => {
  let fastApiService: FastApiService;
  let mockSpawn: any;
  let mockChildProcess: any;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Setup mock child process
    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = vi.fn();
    mockChildProcess.killed = false;

    mockSpawn = vi.fn().mockReturnValue(mockChildProcess);
    (child_process.spawn as any) = mockSpawn;

    // Mock python path
    (pythonUtils.resolvePythonPath as any).mockResolvedValue('/usr/bin/python3');

    // Mock server running check (default to not running)
    (serverManager.checkServerRunning as any).mockResolvedValue(false);

    // Mock kill process
    (processUtils.killProcessOnPort as any).mockResolvedValue(undefined);

    // Re-import to get a fresh instance if possible, or just instantiate directly
    // Since we export a singleton, we might need to access the class if exported,
    // or just rely on the singleton state reset (which we can't easily do if private).
    // So we'll use the imported singleton but note that state persists across tests if not careful.
    // Ideally we should export the class for testing.
    // Let's assume we can import the class or just use the singleton and reset it via a method if added.
    // But since I can't easily modify the service to export class now without another write,
    // I will use the singleton.
    // Wait, I exported the class `FastApiService` in my implementation!
    const module = await import('@packages/core-logic/fastApiService.js');
    fastApiService = new module.FastApiService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start the service if not running', async () => {
    await fastApiService.start();

    expect(pythonUtils.resolvePythonPath).toHaveBeenCalled();
    expect(child_process.spawn).toHaveBeenCalledWith(
      '/usr/bin/python3',
      ['-m', 'myai.server'],
      expect.objectContaining({
        env: expect.objectContaining({ PYTHONUNBUFFERED: '1' })
      })
    );
  });

  it('should not start if already running and healthy', async () => {
    // Mock server running on port 8000
    (serverManager.checkServerRunning as any).mockResolvedValue(true);

    // Mock health check success
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as any);

    await fastApiService.start();

    expect(child_process.spawn).not.toHaveBeenCalled();
  });

  it('should kill and restart if running but unhealthy', async () => {
    // Mock server running on port 8000
    (serverManager.checkServerRunning as any).mockResolvedValue(true);

    // Mock health check failure
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    await fastApiService.start();

    expect(processUtils.killProcessOnPort).toHaveBeenCalledWith(8000);
    expect(child_process.spawn).toHaveBeenCalled();
  });

  it('should stop the service', async () => {
    await fastApiService.start();
    expect(mockChildProcess).toBeDefined();

    await fastApiService.stop();
    expect(mockChildProcess.kill).toHaveBeenCalled();
    expect(processUtils.killProcessOnPort).toHaveBeenCalledWith(8000);
  });

  it('should restart the service', async () => {
    const startSpy = vi.spyOn(fastApiService, 'start');
    const stopSpy = vi.spyOn(fastApiService, 'stop');

    await fastApiService.restart();

    expect(stopSpy).toHaveBeenCalled();
    expect(startSpy).toHaveBeenCalled();
  });
});
