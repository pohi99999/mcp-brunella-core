import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentManager } from "../src/agents/AgentManager.js";
import { SocketServiceClass } from "../src/server/SocketService.js";
import type { AgentConfig, RegistryConfig } from "../src/agents/registryStandard.js";
import type { IAgent } from "../src/agents/types.js";
import { loadQueuedTasksForHydration, updateTaskStatus } from "../src/utils/tasksDb.js";

vi.mock("../src/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

vi.mock("../src/utils/tasksDb.js", () => ({
  saveTask: vi.fn().mockResolvedValue(1),
  updateTaskStatus: vi.fn().mockResolvedValue(undefined),
  loadQueuedTasksForHydration: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/core/retryStrategy.js", () => ({
  withRetry: vi.fn(),
  calculateDelay: vi.fn(),
  DEFAULT_RETRY_CONFIG: {},
}));

vi.mock("../src/core/checkpoint.js", () => ({
  saveCheckpoint: vi.fn(),
  loadCheckpoint: vi.fn(),
}));

vi.mock("../src/core/gitRecovery.js", () => ({
  gitAutoCheckpoint: vi.fn(),
  logRecoveryEvent: vi.fn(),
}));

vi.mock("../src/core/goldenDatasetBridge.js", () => ({
  autoSaveGoldenSample: vi.fn(),
}));

vi.mock("../src/core/dagEngine.js", () => ({
  executeDAG: vi.fn(),
}));

vi.mock("../src/core/phoenixEventBus.js", () => ({
  phoenixEventBus: {},
}));

vi.mock("../src/core/failoverRegistry.js", () => ({
  failoverRegistry: {},
}));

vi.mock("../src/utils/agentTracer.js", () => ({
  traceAgentExecution: vi.fn(),
}));

vi.mock("../src/core/agentCoordinator.js", () => ({
  default: class MockAgentCoordinator {},
}));

vi.mock("../src/utils/metrics.js", () => ({
  recordAgentExecution: vi.fn(),
}));

vi.mock("../src/tools/toolPermissions.js", () => ({
  checkToolPermission: vi.fn(() => ({ allowed: true })),
}));

vi.mock("../src/core/auditLog.js", () => ({
  record: vi.fn(),
}));

vi.mock("../src/utils/fixQueue.js", () => ({
  getPendingFixes: vi.fn(() => []),
  updateFixStatus: vi.fn(),
}));

vi.mock("../src/utils/responseFormatter.js", () => ({
  formatResponse: vi.fn(),
}));

vi.mock("../src/agents/swarm/SwarmManager.js", () => ({
  SwarmManager: class MockSwarmManager {
    static getTriadConfig() {
      return { name: "triad", agentIds: ["a", "b", "c"] };
    }
    createColony() {
      return undefined;
    }
  },
}));

vi.mock("../src/agents/agentLoader.js", () => ({
  resolveAgentExport: vi.fn(),
}));

vi.mock("../src/agents/agentRouting.js", () => ({
  selectAgentForInstruction: vi.fn(),
}));

vi.mock("../src/agents/registryValidation.js", () => ({
  validateAndNormalizeRegistry: vi.fn((value: RegistryConfig) => ({
    registry: value,
    report: {
      valid: true,
      errors: [],
      warnings: [],
      checkedAt: new Date().toISOString(),
      summary: {
        totalAgents: value.agents.length,
        activeAgents: value.agents.length,
        invalidAgents: 0,
        defaultAgent: value.defaultAgent,
      },
    },
  })),
}));

vi.mock("../src/skills/index.js", () => ({
  getSkill: vi.fn(),
  SKILL_REGISTRY: {},
}));

vi.mock("../src/config/paiosConfig.js", () => ({
  getOrchestrationConcurrencyConfig: vi.fn(() => ({ profile: "test" })),
  getOrchestrationConcurrencyLimit: vi.fn(() => 1),
}));

function createRegistry(autoStart = true): RegistryConfig {
  return {
    version: "1.0.0",
    defaultAgent: "AutoAgent",
    routingRules: [],
    agents: [
      {
        name: "AutoAgent",
        class: "AutoAgent",
        module: "./agents/AutoAgent.js",
        description: "Test auto-start agent",
        capabilities: [],
        priority: 1,
        autoStart,
        metadataStandard: {
          category: "test",
          status: "active",
          tags: [],
          tools: [],
          triggers: [],
          capabilities: [],
          priority: 1,
          autoStart,
          executionMode: "local",
          costTier: "low",
          runtimeCompatibility: "node",
        },
      } satisfies AgentConfig,
    ],
  };
}

describe("AgentManager initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes auto-start agents only once", async () => {
    const manager = new AgentManager(new SocketServiceClass());
    const initialize = vi.fn().mockResolvedValue(undefined);

    const internal = manager as unknown as {
      registry: RegistryConfig;
      loadRegistryAsync: () => Promise<RegistryConfig>;
      loadAgent: (config: AgentConfig) => Promise<void>;
      agents: Map<string, IAgent>;
      processFixQueue: () => Promise<void>;
      edgeConfig: { enabled: boolean };
    };

    const registry = createRegistry(true);
    internal.registry = registry;
    internal.edgeConfig.enabled = false;
    internal.loadRegistryAsync = vi.fn().mockResolvedValue(registry);
    internal.processFixQueue = vi.fn().mockResolvedValue(undefined);
    internal.loadAgent = vi.fn(async (config: AgentConfig) => {
      internal.agents.set(config.name, {
        name: config.name,
        role: "test",
        description: "test",
        capabilities: [],
        initialize,
        execute: vi.fn().mockResolvedValue({ success: true, message: "ok", data: null }),
      });
    });

    await manager.initialize();

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it("does not fail initialization when startup self-healing throws", async () => {
    const manager = new AgentManager(new SocketServiceClass());

    const internal = manager as unknown as {
      registry: RegistryConfig;
      loadRegistryAsync: () => Promise<RegistryConfig>;
      loadAgent: (config: AgentConfig) => Promise<void>;
      processFixQueue: () => Promise<void>;
      edgeConfig: { enabled: boolean };
      agents: Map<string, IAgent>;
    };

    const registry = createRegistry(false);
    internal.registry = registry;
    internal.edgeConfig.enabled = false;
    internal.loadRegistryAsync = vi.fn().mockResolvedValue(registry);
    internal.loadAgent = vi.fn(async (config: AgentConfig) => {
      internal.agents.set(config.name, {
        name: config.name,
        role: "test",
        description: "test",
        capabilities: [],
        execute: vi.fn().mockResolvedValue({ success: true, message: "ok", data: null }),
      });
    });
    internal.processFixQueue = vi
      .fn()
      .mockRejectedValue(new Error("self-healing unavailable"));

    await expect(manager.initialize()).resolves.toBeUndefined();
  });

  it("rehydrates queued tasks from tasks.db during initialization", async () => {
    const manager = new AgentManager(new SocketServiceClass());

    vi.mocked(loadQueuedTasksForHydration).mockResolvedValueOnce([
      {
        id: 41,
        agent: "AutoAgent",
        task: "Persisted pending task",
        status: "pending",
        context: '{"ticket":123}',
        created_at: "2026-04-01T18:00:00.000Z",
      },
      {
        id: 42,
        agent: "AutoAgent",
        task: "Persisted running task",
        status: "running",
        context: null,
        created_at: "2026-04-01T18:05:00.000Z",
      },
    ]);

    const internal = manager as unknown as {
      registry: RegistryConfig;
      loadRegistryAsync: () => Promise<RegistryConfig>;
      loadAgent: (config: AgentConfig) => Promise<void>;
      agents: Map<string, IAgent>;
      processFixQueue: () => Promise<void>;
      edgeConfig: { enabled: boolean };
    };

    const registry = createRegistry(true);
    internal.registry = registry;
    internal.edgeConfig.enabled = false;
    internal.loadRegistryAsync = vi.fn().mockResolvedValue(registry);
    internal.processFixQueue = vi.fn().mockResolvedValue(undefined);
    internal.loadAgent = vi.fn(async (config: AgentConfig) => {
      internal.agents.set(config.name, {
        name: config.name,
        role: "test",
        description: "test",
        capabilities: [],
        initialize: vi.fn().mockResolvedValue(undefined),
        execute: vi.fn().mockResolvedValue({ success: true, message: "ok", data: null }),
      });
    });

    await manager.initialize();

    expect(manager.getAllTasks()).toEqual([
      expect.objectContaining({
        id: 41,
        description: "Persisted pending task",
        agentName: "AutoAgent",
        status: "pending",
        context: { ticket: 123 },
      }),
      expect.objectContaining({
        id: 42,
        description: "Persisted running task",
        agentName: "AutoAgent",
        status: "pending",
      }),
    ]);
    expect(updateTaskStatus).toHaveBeenCalledWith(42, "pending");
  });
});
