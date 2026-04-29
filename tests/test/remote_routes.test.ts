import express from "express";
import fs from "fs/promises";
import os from "os";
import path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { callToolMock, getDiscoveredTargetsMock } = vi.hoisted(() => ({
  callToolMock: vi.fn(),
  getDiscoveredTargetsMock: vi.fn(),
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("@packages/core-logic/mcpDiscovery.js", () => ({
  discoverMcpServers: vi.fn(),
  getDiscoveredTargets: getDiscoveredTargetsMock,
}));

vi.mock("@packages/utils/mcpClientManager.js", () => ({
  mcpClientManager: {
    callTool: callToolMock,
  },
}));

describe("Remote routes", () => {
  let tempDir: string;
  let closeStore: (() => void) | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "remote-routes-"));
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    process.env.BRUNELLA_WORKSPACE_ROOT = tempDir;

    vi.resetModules();
    ({ closeStore } = await import("@packages/core-logic/remoteSessionStore.js"));

    getDiscoveredTargetsMock.mockReturnValue([
      {
        id: "mcp:test-server",
        agentName: "test-server",
        capability: "mcp.invoke",
        description: "Test server",
        available: true,
      },
    ]);
    callToolMock.mockReset();
    callToolMock.mockResolvedValue({ ok: true });
  });

  afterEach(async () => {
    closeStore?.();
    delete process.env.BRUNELLA_WORKSPACE_ROOT;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  async function createApp() {
    const { createRemoteRoutes } = await import("@apps/mcp-core/server/routes/remote.js");
    const app = express();
    app.use(express.json());
    app.use("/api/v1/remote", createRemoteRoutes());
    return app;
  }

  async function issueToken(app: express.Express): Promise<string> {
    const response = await request(app)
      .post("/api/v1/remote/auth/token")
      .send({ userId: "dashboard-user" });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTypeOf("string");
    return response.body.token as string;
  }

  it("requires a bearer token for guarded endpoints", async () => {
    const app = await createApp();

    const response = await request(app).get("/api/v1/remote/targets");

    expect(response.status).toBe(401);
  });

  it("creates sessions and dispatches commands through the MCP client", async () => {
    const app = await createApp();
    const token = await issueToken(app);
    const authHeader = { Authorization: `Bearer ${token}` };

    const targetsResponse = await request(app)
      .get("/api/v1/remote/targets")
      .set(authHeader);

    expect(targetsResponse.status).toBe(200);
    expect(targetsResponse.body.targets).toHaveLength(1);

    const sessionResponse = await request(app)
      .post("/api/v1/remote/sessions")
      .set(authHeader)
      .send({
        targetId: "mcp:test-server",
        userId: "dashboard-user",
        metadata: { source: "test" },
      });

    expect(sessionResponse.status).toBe(201);
    expect(sessionResponse.body.sessionId).toBeTypeOf("string");

    const sessionId = sessionResponse.body.sessionId as string;
    const commandResolution = new Promise<void>((resolve) => {
      callToolMock.mockImplementationOnce(async () => {
        resolve();
        return { ok: true, message: "done" };
      });
    });

    const commandResponse = await request(app)
      .post("/api/v1/remote/commands")
      .set(authHeader)
      .send({
        sessionId,
        targetId: "mcp:test-server",
        toolName: "list_tools",
        input: { limit: 5 },
      });

    expect(commandResponse.status).toBe(202);
    expect(commandResponse.body.commandId).toBeTypeOf("string");
    expect(callToolMock).toHaveBeenCalledWith("test-server", "list_tools", { limit: 5 });

    await commandResolution;
    await new Promise((resolve) => setTimeout(resolve, 10));

    const commandId = commandResponse.body.commandId as string;
    const commandStatusResponse = await request(app)
      .get(`/api/v1/remote/commands/${commandId}`)
      .set(authHeader);

    expect(commandStatusResponse.status).toBe(200);
    expect(commandStatusResponse.body.command).toMatchObject({
      id: commandId,
      status: "completed",
      result: { ok: true, message: "done" },
    });

    const sessionFetch = await request(app)
      .get(`/api/v1/remote/sessions/${sessionId}`)
      .set(authHeader);

    expect(sessionFetch.status).toBe(200);
    expect(sessionFetch.body.session).toMatchObject({
      id: sessionId,
      active: true,
      userId: "dashboard-user",
    });
    expect(sessionFetch.body.session.commands).toHaveLength(1);
  });
});
