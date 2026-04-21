import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EdgePanel } from "./EdgePanel";

interface SocketMock {
  connected: boolean;
  id: string;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  io: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    engine: { transport: { name: string } };
  };
}

const { useSystemSignalMock } = vi.hoisted(() => ({
  useSystemSignalMock: vi.fn(),
}));

vi.mock("@/hooks/useSystemSignal", () => ({
  useSystemSignal: () => useSystemSignalMock(),
}));

function createSocketMock(connected = false): SocketMock {
  return {
    connected,
    id: "socket-123",
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    io: {
      on: vi.fn(),
      off: vi.fn(),
      engine: { transport: { name: "websocket" } },
    },
  };
}

describe("EdgePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSystemSignalMock.mockReturnValue({
      socket: createSocketMock(),
      isConnected: false,
    });
  });

  // --- Static chrome ---

  it("renders Edge WebSocket title", () => {
    render(<EdgePanel />);
    expect(screen.getByText("Edge WebSocket")).toBeInTheDocument();
  });

  it("renders Cloudflare Edge description", () => {
    render(<EdgePanel />);
    expect(screen.getByText(/Cloudflare Edge/i)).toBeInTheDocument();
  });

  it("renders Connect, Disconnect, and Send Test buttons", () => {
    render(<EdgePanel />);
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Test" })).toBeInTheDocument();
  });

  it("shows Disconnected status badge on initial render", () => {
    render(<EdgePanel />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("Send Test button is disabled when not connected", () => {
    render(<EdgePanel />);
    expect(screen.getByRole("button", { name: "Send Test" })).toBeDisabled();
  });

  it("Connect button is disabled when isConnected is true", () => {
    useSystemSignalMock.mockReturnValue({
      socket: createSocketMock(true),
      isConnected: true,
    });
    render(<EdgePanel />);
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("Disconnect button is disabled when not connected and status is not connecting", () => {
    render(<EdgePanel />);
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();
  });

  // --- Connection info grid ---

  it("renders WebSocket URL label in connection info", () => {
    render(<EdgePanel />);
    expect(screen.getByText("WebSocket URL:")).toBeInTheDocument();
  });

  it("renders Socket ID label in connection info", () => {
    render(<EdgePanel />);
    expect(screen.getByText("Socket ID:")).toBeInTheDocument();
  });

  it("renders Transport label in connection info", () => {
    render(<EdgePanel />);
    expect(screen.getByText("Transport:")).toBeInTheDocument();
  });

  it("renders Messages Received label in connection info", () => {
    render(<EdgePanel />);
    expect(screen.getByText("Messages Received:")).toBeInTheDocument();
  });

  // --- Connect action ---

  it("calls socket.connect() when Connect button is clicked", async () => {
    const socketMock = createSocketMock();
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: false });
    render(<EdgePanel />);
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(socketMock.connect).toHaveBeenCalledTimes(1);
  });

  it("shows error when Connect clicked with no socket", async () => {
    useSystemSignalMock.mockReturnValue({ socket: null, isConnected: false });
    render(<EdgePanel />);
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(screen.getByText("Socket provider not available")).toBeInTheDocument();
  });

  // --- Disconnect action ---

  it("calls socket.disconnect() when Disconnect button is clicked while connected", async () => {
    const socketMock = createSocketMock(true);
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: true });
    render(<EdgePanel />);
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(socketMock.disconnect).toHaveBeenCalledTimes(1);
  });

  // --- Socket events ---

  it("shows Connected status when socket fires connect event", () => {
    const socketMock = createSocketMock();
    const handlers: Record<string, (arg?: unknown) => void> = {};
    socketMock.on.mockImplementation((event: string, handler: (arg?: unknown) => void) => {
      handlers[event] = handler;
    });
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: false });

    render(<EdgePanel />);
    act(() => { handlers["connect"]?.(); });

    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows Disconnected status when socket fires disconnect event", () => {
    const socketMock = createSocketMock(true);
    const handlers: Record<string, (arg?: unknown) => void> = {};
    socketMock.on.mockImplementation((event: string, handler: (arg?: unknown) => void) => {
      handlers[event] = handler;
    });
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: true });

    render(<EdgePanel />);
    act(() => { handlers["disconnect"]?.("io client disconnect"); });

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows Error status and error message when socket fires connect_error", () => {
    const socketMock = createSocketMock();
    const handlers: Record<string, (arg?: unknown) => void> = {};
    socketMock.on.mockImplementation((event: string, handler: (arg?: unknown) => void) => {
      handlers[event] = handler;
    });
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: false });

    render(<EdgePanel />);
    act(() => { handlers["connect_error"]?.(new Error("Connection refused")); });

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows disconnect error message for unexpected disconnect reason", () => {
    const socketMock = createSocketMock(true);
    const handlers: Record<string, (arg?: unknown) => void> = {};
    socketMock.on.mockImplementation((event: string, handler: (arg?: unknown) => void) => {
      handlers[event] = handler;
    });
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: true });

    render(<EdgePanel />);
    act(() => { handlers["disconnect"]?.("transport close"); });

    expect(screen.getByText(/Connection closed: transport close/i)).toBeInTheDocument();
  });

  // --- Message history ---

  it("shows Recent Messages section after an edge message arrives", () => {
    const socketMock = createSocketMock(true);
    const handlers: Record<string, (arg?: unknown) => void> = {};
    socketMock.on.mockImplementation((event: string, handler: (arg?: unknown) => void) => {
      handlers[event] = handler;
    });
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: true });

    render(<EdgePanel />);
    act(() => { handlers["edge:task:submitted"]?.({ taskId: "t1" }); });

    expect(screen.getByText("Recent Messages")).toBeInTheDocument();
  });

  it("message count increments when multiple edge events arrive", () => {
    const socketMock = createSocketMock(true);
    const handlers: Record<string, (arg?: unknown) => void> = {};
    socketMock.on.mockImplementation((event: string, handler: (arg?: unknown) => void) => {
      handlers[event] = handler;
    });
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: true });

    render(<EdgePanel />);
    act(() => {
      handlers["edge:task:submitted"]?.({ taskId: "t1" });
      handlers["edge:task:progress"]?.({ progress: 50 });
    });

    // Messages Received shows 2
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  // --- Send Test ---

  it("emits edge:chat:message when Send Test clicked with connected socket", async () => {
    const socketMock = createSocketMock(true);
    const handlers: Record<string, (arg?: unknown) => void> = {};
    socketMock.on.mockImplementation((event: string, handler: (arg?: unknown) => void) => {
      handlers[event] = handler;
    });
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: true });

    render(<EdgePanel />);
    // Trigger connect event to enable the button via status
    act(() => { handlers["connect"]?.(); });

    await userEvent.click(screen.getByRole("button", { name: "Send Test" }));

    expect(socketMock.emit).toHaveBeenCalledWith(
      "edge:chat:message",
      expect.objectContaining({ instruction: "ping" }),
    );
  });

  // --- Cleanup ---

  it("unregisters socket event handlers on unmount", () => {
    const socketMock = createSocketMock();
    useSystemSignalMock.mockReturnValue({ socket: socketMock, isConnected: false });

    const { unmount } = render(<EdgePanel />);
    unmount();

    expect(socketMock.off).toHaveBeenCalled();
  });
});
