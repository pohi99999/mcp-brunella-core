import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrunellaRemoteClient } from "@packages/utils/BrunellaRemoteClient";

describe("BrunellaRemoteClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authenticates once and follows the remote route contract", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            token: "token-1",
            expiresAt: Date.now() + 60_000,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            targets: [
              {
                id: "mcp:test-server",
                agentName: "test-server",
                capability: "mcp.invoke",
                available: true,
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            sessions: [
              {
                id: "session-1",
                userId: "dashboard-user",
                targetId: "mcp:test-server",
                createdAt: 1_000,
                expiresAt: 2_000,
                active: true,
                commands: [],
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            sessionId: "session-2",
            expiresAt: 3_000,
            targetId: "mcp:test-server",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            session: {
              id: "session-2",
              userId: "dashboard-user",
              targetId: "mcp:test-server",
              createdAt: 2_500,
              expiresAt: 3_000,
              active: true,
              commands: [],
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        text: async () =>
          JSON.stringify({
            commandId: "command-1",
            status: "pending",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            command: {
              id: "command-1",
              sessionId: "session-2",
              targetId: "mcp:test-server",
              toolName: "list_tools",
              input: { limit: 5 },
              status: "completed",
              result: { ok: true },
              createdAt: 3_500,
              updatedAt: 3_600,
            },
          }),
      });

    const client = new BrunellaRemoteClient("/api/v1");

    const targets = await client.listTargets("dashboard-user");
    const sessions = await client.listSessions("dashboard-user");
    const session = await client.createSession("mcp:test-server", "dashboard-user", {
      source: "dashboard",
    });
    const command = await client.sendCommand(
      session.id,
      session.targetId,
      "list_tools",
      { limit: 5 },
      "dashboard-user",
    );

    expect(targets).toHaveLength(1);
    expect(sessions).toHaveLength(1);
    expect(session.id).toBe("session-2");
    expect(command.id).toBe("command-1");
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/remote/auth/token");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/remote/targets");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/remote/sessions?userId=dashboard-user");
    expect(fetchMock.mock.calls[3][0]).toBe("/api/v1/remote/sessions");
    expect(fetchMock.mock.calls[4][0]).toBe("/api/v1/remote/sessions/session-2");
    expect(fetchMock.mock.calls[5][0]).toBe("/api/v1/remote/commands");
    expect(fetchMock.mock.calls[6][0]).toBe("/api/v1/remote/commands/command-1");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: {
        Authorization: "Bearer token-1",
      },
    });
  });
});
