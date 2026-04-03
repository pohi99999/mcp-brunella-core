import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { readFileSyncMock, connectStdioMock, disconnectMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(),
  connectStdioMock: vi.fn(),
  disconnectMock: vi.fn(),
}));

vi.mock("fs", () => ({
  readFileSync: readFileSyncMock,
}));

vi.mock("../src/utils/mcpClientManager.js", () => ({
  mcpClientManager: {
    connectStdio: connectStdioMock,
    disconnect: disconnectMock,
  },
}));

vi.mock("../src/utils/logger.js", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import { McpProcessManager } from "../src/server/McpProcessManager.js";

const ORIGINAL_ENV = { ...process.env };

function setConfig(config: unknown): void {
  readFileSyncMock.mockReturnValue(JSON.stringify(config));
}

function getStatus(manager: McpProcessManager, name: string) {
  const status = manager.getServersStatus().find((entry) => entry.name === name);
  expect(status).toBeDefined();
  return status!;
}

describe("McpProcessManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
    delete process.env.CI;
    delete process.env.MCP_AUTO_START;
    delete process.env.GITHUB_PAT;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

    connectStdioMock.mockResolvedValue({ client: {}, pid: 4242 });
    disconnectMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (typeof value === "string") {
        process.env[key] = value;
      }
    }
  });

  it("auto-starts self and configured stdio servers", async () => {
    setConfig([
      {
        name: "brunella-core",
        transport: "self",
        autoStart: true,
        required: true,
      },
      {
        name: "filesystem",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "${WORKSPACE_ROOT}"],
        autoStart: true,
      },
      {
        name: "manual",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-fetch"],
        autoStart: false,
      },
    ]);

    const manager = new McpProcessManager();
    await manager.loadConfig();
    await manager.startAutoStartServers();

    const startedNames = connectStdioMock.mock.calls.map(
      (call) => (call[0] as { name: string }).name,
    );

    expect(startedNames).toEqual(["filesystem"]);
    expect(getStatus(manager, "brunella-core").status).toBe("running");
    expect(getStatus(manager, "brunella-core").pid).toBe(process.pid);
    expect(getStatus(manager, "filesystem").status).toBe("running");
    expect(getStatus(manager, "filesystem").pid).toBe(4242);
    expect(getStatus(manager, "manual").status).toBe("stopped");
  });

  it("marks the server as error when required environment is missing", async () => {
    setConfig([
      {
        name: "github",
        transport: "stdio",
        command: "docker",
        args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server:0.31.0"],
        envFromHost: {
          GITHUB_PERSONAL_ACCESS_TOKEN: [
            "GITHUB_PERSONAL_ACCESS_TOKEN",
            "GITHUB_PAT",
            "GITHUB_TOKEN",
          ],
        },
        requiredEnv: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
        autoStart: true,
      },
    ]);

    const manager = new McpProcessManager();
    await manager.loadConfig();
    await manager.startAutoStartServers();

    expect(connectStdioMock).not.toHaveBeenCalled();
    expect(getStatus(manager, "github").status).toBe("error");
    expect(getStatus(manager, "github").error).toMatch(
      /Missing required environment/i,
    );
  });

  it("skips servers that are not supported on the current platform", async () => {
    const unsupportedPlatform = process.platform === "win32" ? "linux" : "win32";

    setConfig([
      {
        name: "windows-only",
        transport: "stdio",
        command: "python",
        args: ["windows_bridge/wab_server.py"],
        autoStart: true,
        platforms: [unsupportedPlatform],
      },
    ]);

    const manager = new McpProcessManager();
    await manager.loadConfig();
    await manager.startAutoStartServers();

    expect(connectStdioMock).not.toHaveBeenCalled();
    expect(getStatus(manager, "windows-only").status).toBe("skipped");
  });

  it("prevents duplicate concurrent start attempts for the same server", async () => {
    setConfig([
      {
        name: "filesystem",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "${WORKSPACE_ROOT}"],
        autoStart: true,
      },
    ]);

    let releaseConnection: (() => void) | null = null;
    connectStdioMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseConnection = () => {
            resolve({ client: {}, pid: 4242 });
          };
        }),
    );

    const manager = new McpProcessManager();
    await manager.loadConfig();

    const firstStart = manager.startServer("filesystem");
    const secondStart = manager.startServer("filesystem");

    expect(connectStdioMock).toHaveBeenCalledTimes(1);
    expect(getStatus(manager, "filesystem").status).toBe("starting");

    releaseConnection?.();
    await Promise.all([firstStart, secondStart]);

    expect(getStatus(manager, "filesystem").status).toBe("running");
  });

  it("disconnects running stdio servers on stopAll", async () => {
    setConfig([
      {
        name: "filesystem",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "${WORKSPACE_ROOT}"],
        autoStart: true,
      },
    ]);

    const manager = new McpProcessManager();
    await manager.loadConfig();
    await manager.startServer("filesystem");
    await manager.stopAll();

    expect(disconnectMock).toHaveBeenCalledWith("filesystem");
    expect(getStatus(manager, "filesystem").status).toBe("stopped");
  });
});
