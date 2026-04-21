import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const { remoteClientMock, remoteClientCtorMock } = vi.hoisted(() => {
  const remoteClientMock = {
    authenticate: vi.fn(),
    listTargets: vi.fn(),
    listSessions: vi.fn(),
    createSession: vi.fn(),
    sendCommand: vi.fn(),
  };

  return {
    remoteClientMock,
    remoteClientCtorMock: vi.fn(() => remoteClientMock),
  };
});

vi.mock("../../../utils/BrunellaRemoteClient", () => ({
  BrunellaRemoteClient: remoteClientCtorMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { RemoteConsolePanel } from "./RemoteConsolePanel";

type ToastMock = {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

const mockedToast = toast as unknown as ToastMock;

describe("RemoteConsolePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remoteClientMock.authenticate.mockResolvedValue({
      token: "token-1",
      expiresAt: Date.now() + 60_000,
    });
    remoteClientMock.listTargets.mockResolvedValue([
      {
        id: "mcp:test-server",
        agentName: "test-server",
        capability: "mcp.invoke",
        description: "Test server",
        available: true,
      },
    ]);
    remoteClientMock.listSessions.mockResolvedValue([
      {
        id: "session-1",
        userId: "dashboard-user",
        targetId: "mcp:test-server",
        createdAt: 1_000,
        expiresAt: 2_000,
        active: true,
        metadata: { source: "dashboard" },
        commands: [],
      },
    ]);
    remoteClientMock.createSession.mockResolvedValue({
      id: "session-2",
      userId: "dashboard-user",
      targetId: "mcp:test-server",
      createdAt: 3_000,
      expiresAt: 4_000,
      active: true,
      metadata: { source: "dashboard" },
      commands: [],
    });
    remoteClientMock.sendCommand.mockResolvedValue({
      id: "command-1",
      sessionId: "session-1",
      targetId: "mcp:test-server",
      toolName: "list_tools",
      input: { limit: 5 },
      status: "pending",
      createdAt: 5_000,
      updatedAt: 5_000,
    });
  });

  it("loads remote data, creates sessions, and dispatches commands with parsed input", async () => {
    await act(async () => {
      render(<RemoteConsolePanel />);
    });

    await waitFor(() => {
      expect(remoteClientMock.authenticate).toHaveBeenCalledWith("dashboard-user");
      expect(remoteClientMock.listTargets).toHaveBeenCalledWith("dashboard-user");
      expect(remoteClientMock.listSessions).toHaveBeenCalledWith("dashboard-user");
    });

    expect(screen.getByRole("option", { name: "test-server · mcp.invoke" })).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => element?.tagName === "P" && element.textContent?.includes("session-1") === true),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tool név"), {
      target: { value: "list_tools" },
    });
    fireEvent.change(screen.getByLabelText("Input (JSON vagy egyszerű szöveg)"), {
      target: { value: '{ "limit": 5 }' },
    });

    fireEvent.click(screen.getByRole("button", { name: "Új session" }));

    await waitFor(() => {
      expect(remoteClientMock.createSession).toHaveBeenCalledWith(
        "mcp:test-server",
        "dashboard-user",
        expect.objectContaining({ source: "dashboard" }),
      );
      expect(
        screen.getByText((_content, element) => element?.tagName === "P" && element.textContent?.includes("session-2") === true),
      ).toBeInTheDocument();
    });

    const sessionCard = screen
      .getByText((_content, element) => element?.tagName === "P" && element.textContent?.includes("session-1") === true)
      .closest("article");
    expect(sessionCard).not.toBeNull();

    fireEvent.click(within(sessionCard as HTMLElement).getByRole("button", { name: "Parancs küldése" }));

    await waitFor(() => {
      expect(remoteClientMock.sendCommand).toHaveBeenCalledWith(
        "session-1",
        "mcp:test-server",
        "list_tools",
        { limit: 5 },
        "dashboard-user",
      );
      expect(mockedToast.success).toHaveBeenCalled();
    });
  });
});
