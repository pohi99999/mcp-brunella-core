import { beforeEach, describe, expect, it, vi } from "vitest";

const managerHarness = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(),
  logWarnMock: vi.fn(),
  clientInstances: [] as MockClient[],
  stdioTransports: [] as MockStdioTransport[],
  streamableTransports: [] as MockStreamableHTTPClientTransport[],
  sseTransports: [] as MockSSEClientTransport[],
  connectQueue: [] as Array<(transport: unknown) => Promise<void>>,
}));

class MockStdioTransport {
  pid = 4321;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  close = vi.fn().mockResolvedValue(undefined);
  stderr = {
    on: vi.fn(),
    removeListener: vi.fn(),
  };

  constructor(public readonly options: Record<string, unknown>) {
    managerHarness.stdioTransports.push(this);
  }
}

class MockStreamableHTTPClientTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  close = vi.fn().mockResolvedValue(undefined);

  constructor(public readonly url: URL) {
    managerHarness.streamableTransports.push(this);
  }
}

class MockSSEClientTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  close = vi.fn().mockResolvedValue(undefined);

  constructor(public readonly url: URL) {
    managerHarness.sseTransports.push(this);
  }
}

class MockClient {
  close = vi.fn().mockResolvedValue(undefined);
  listTools = vi.fn();
  callTool = vi.fn();
  connect = vi.fn((transport: unknown) => {
    const next = managerHarness.connectQueue.shift();
    return next ? next(transport) : Promise.resolve();
  });

  constructor() {
    managerHarness.clientInstances.push(this);
  }
}

vi.mock("fs", () => ({
  readFileSync: managerHarness.readFileSyncMock,
}));

vi.mock("../src/utils/logger.js", () => ({
  logWarn: managerHarness.logWarnMock,
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: MockClient,
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: MockStdioTransport,
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: MockStreamableHTTPClientTransport,
}));

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: MockSSEClientTransport,
}));

describe("McpClientManager", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    managerHarness.readFileSyncMock.mockReturnValue(JSON.stringify({ version: "1.2.3" }));
    managerHarness.logWarnMock.mockReset();
    managerHarness.clientInstances.length = 0;
    managerHarness.stdioTransports.length = 0;
    managerHarness.streamableTransports.length = 0;
    managerHarness.sseTransports.length = 0;
    managerHarness.connectQueue.length = 0;
  });

  it("should_dedupe_http_connects_when_same_server_is_pending_and_create_single_connection", async () => {
    let releaseConnection: (() => void) | undefined;
    managerHarness.connectQueue.push(
      () =>
        new Promise<void>((resolve) => {
          releaseConnection = resolve;
        }),
    );

    const { McpClientManager } = await import("../src/utils/mcpClientManager.js");
    const manager = new McpClientManager();

    const first = manager.connectHttp({ name: "remote", url: "http://example.test/mcp" });
    const second = manager.connectHttp({ name: "remote", url: "http://example.test/mcp" });

    expect(managerHarness.clientInstances).toHaveLength(1);
    expect(managerHarness.streamableTransports).toHaveLength(1);

    releaseConnection?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.pid).toBeNull();
    expect(secondResult.pid).toBeNull();
    expect(secondResult.client).toBe(firstResult.client);
    expect(manager.getClientNames()).toEqual(["remote"]);
  });

  it("should_cleanup_client_state_when_transport_onclose_fires_and_invoke_callback", async () => {
    managerHarness.connectQueue.push(async () => undefined);

    const { McpClientManager } = await import("../src/utils/mcpClientManager.js");
    const manager = new McpClientManager();
    const onClose = vi.fn();

    const connection = await manager.connectStdio({
      name: "stdio-server",
      command: "node",
      args: ["server.js"],
      onClose,
    });

    expect(connection.pid).toBe(4321);
    expect(manager.getClient("stdio-server")).toBe(connection.client);
    expect(manager.getPid("stdio-server")).toBe(4321);

    managerHarness.stdioTransports[0]?.onclose?.();

    expect(manager.getClient("stdio-server")).toBeUndefined();
    expect(manager.getPid("stdio-server")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(managerHarness.stdioTransports[0]?.stderr.removeListener).toHaveBeenCalledWith(
      "data",
      expect.any(Function),
    );
  });

  it("should_fallback_to_sse_when_streamable_http_connect_fails_and_close_failed_transport", async () => {
    managerHarness.connectQueue.push(
      async (transport) => {
        if (transport instanceof MockStreamableHTTPClientTransport) {
          throw new Error("streamable unavailable");
        }
      },
      async (transport) => {
        expect(transport).toBeInstanceOf(MockSSEClientTransport);
      },
    );

    const { McpClientManager } = await import("../src/utils/mcpClientManager.js");
    const manager = new McpClientManager();

    const result = await manager.connectHttp({ name: "fallback-server", url: "http://example.test/mcp" });

    expect(result.pid).toBeNull();
    expect(managerHarness.streamableTransports).toHaveLength(1);
    expect(managerHarness.sseTransports).toHaveLength(1);
    expect(managerHarness.streamableTransports[0]?.close).toHaveBeenCalledTimes(1);
    expect(manager.getClient("fallback-server")).toBe(result.client);
    expect(manager.getClientNames()).toEqual(["fallback-server"]);
  });

  it("should_disconnect_clients_when_disconnect_and_disconnect_all_are_called_and_cleanup_transports", async () => {
    managerHarness.connectQueue.push(async () => undefined, async () => undefined);

    const { McpClientManager } = await import("../src/utils/mcpClientManager.js");
    const manager = new McpClientManager();

    await manager.connectStdio({ name: "one", command: "node" });
    await manager.connectHttp({ name: "two", url: "http://example.test/mcp" });

    const firstClient = managerHarness.clientInstances[0];
    const secondClient = managerHarness.clientInstances[1];
    const firstTransport = managerHarness.stdioTransports[0];
    const secondTransport = managerHarness.streamableTransports[0];

    await manager.disconnect("one");

    expect(firstClient?.close).toHaveBeenCalledTimes(1);
    expect(firstTransport?.close).toHaveBeenCalledTimes(1);
    expect(manager.getClient("one")).toBeUndefined();
    expect(manager.getClientNames()).toEqual(["two"]);

    await manager.disconnectAll();

    expect(secondClient?.close).toHaveBeenCalledTimes(1);
    expect(secondTransport?.close).toHaveBeenCalledTimes(1);
    expect(manager.getClientNames()).toEqual([]);
  });
});
