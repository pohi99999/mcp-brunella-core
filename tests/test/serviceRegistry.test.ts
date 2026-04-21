import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockRagEngine, logInfoMock } = vi.hoisted(() => ({
  mockDb: {
    close: vi.fn(),
  },
  mockRagEngine: {
    dispose: vi.fn().mockResolvedValue(undefined),
  },
  logInfoMock: vi.fn(),
}));

vi.mock('../src/utils/databaseManager.js', () => ({
  defaultDatabaseManager: mockDb,
}));

vi.mock('../src/utils/rag.js', () => ({
  defaultRagEngine: mockRagEngine,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: logInfoMock,
}));

import { ServiceRegistry, getServiceRegistry } from '../src/utils/serviceRegistry.js';

describe('ServiceRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ServiceRegistry._resetForTesting();
  });

  it('returns the same singleton instance for repeated calls', () => {
    const first = ServiceRegistry.getInstance();
    const second = ServiceRegistry.getInstance();

    expect(first).toBe(second);
    expect(logInfoMock).toHaveBeenCalledTimes(1);
  });

  it('returns the singleton via getServiceRegistry convenience accessor', () => {
    const fromClass = ServiceRegistry.getInstance();
    const fromHelper = getServiceRegistry();

    expect(fromHelper).toBe(fromClass);
  });

  it('exposes default registered services', () => {
    const registry = ServiceRegistry.getInstance();

    expect(registry.get('db')).toBe(mockDb);
    expect(registry.get('ragEngine')).toBe(mockRagEngine);
    expect(registry.getAll().db).toBe(mockDb);
    expect(registry.getAll().ragEngine).toBe(mockRagEngine);
  });

  it('allows overriding registered services', () => {
    const registry = ServiceRegistry.getInstance();
    const overrideDb = { close: vi.fn() };

    registry.register('db', overrideDb);

    expect(registry.get('db')).toBe(overrideDb);
    expect(logInfoMock).toHaveBeenCalledWith('ServiceRegistry', 'Service registered: db');
  });

  it('disposes registered services and resets singleton state', async () => {
    const registry = ServiceRegistry.getInstance();

    await registry.dispose();

    expect(mockRagEngine.dispose).toHaveBeenCalledTimes(1);
    expect(mockDb.close).toHaveBeenCalledTimes(1);
    const next = ServiceRegistry.getInstance();
    expect(next).not.toBe(registry);
  });

  it('continues disposal even if service disposers throw', async () => {
    const registry = ServiceRegistry.getInstance();
    mockRagEngine.dispose.mockRejectedValueOnce(new Error('rag failed'));
    mockDb.close.mockImplementationOnce(() => {
      throw new Error('db failed');
    });

    await expect(registry.dispose()).resolves.toBeUndefined();
    expect(logInfoMock).toHaveBeenCalledWith('ServiceRegistry', 'ragEngine dispose warning: rag failed');
    expect(logInfoMock).toHaveBeenCalledWith('ServiceRegistry', 'db dispose warning: db failed');
    const next = ServiceRegistry.getInstance();
    expect(next).not.toBe(registry);
  });
});
