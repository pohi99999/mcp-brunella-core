import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ------------------------------------------------------------------
// Socket mock (before component import)
// ------------------------------------------------------------------
const { socketMock } = vi.hoisted(() => {
  const socketMock = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return { socketMock };
});

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({ socket: socketMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { EphemeralAgentsPanel } from "./EphemeralAgentsPanel";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function mockFetchResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as Response;
}

function makeAgent(overrides: Partial<{
  id: string;
  state: "pending" | "running" | "terminated" | "expired" | "failed";
  purpose: string;
  parentAgentName: string;
}> = {}) {
  return {
    id: "agent-abc12345-0000",
    spec: {
      parentAgentName: overrides.parentAgentName ?? "OrchestratorAgent",
      purpose: overrides.purpose ?? "Analyse auth logs",
      allowedTools: ["read_file", "grep"],
    },
    state: overrides.state ?? ("running" as const),
    spawnedAt: new Date().toISOString(),
    tokenUsed: 100,
    costUsed: 0.001,
    stepsUsed: 3,
    lease: {
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      renewalsUsed: 0,
      maxRenewals: 3,
      budgetStatus: "healthy" as const,
    },
    auditTrail: [],
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("EphemeralAgentsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should_show_BETOLTES_badge_while_loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<EphemeralAgentsPanel />);
    expect(screen.getByText("BETÖLTÉS")).toBeInTheDocument();
  });

  it("should_show_ELO_badge_after_successful_load", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(mockFetchResponse({ agents: [] })),
    ));
    await act(async () => { render(<EphemeralAgentsPanel />); });
    await waitFor(() => expect(screen.getByText("ÉLŐ")).toBeInTheDocument());
  });

  it("should_show_empty_state_message_when_no_agents", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(mockFetchResponse({ agents: [] })),
    ));
    await act(async () => { render(<EphemeralAgentsPanel />); });
    await waitFor(() =>
      expect(screen.getByText("Nincs ephemeral ágens adat.")).toBeInTheDocument(),
    );
  });

  it("should_render_agent_card_with_state_badge_purpose_and_parent", async () => {
    const agent = makeAgent({
      id: "agent-deadbeef-1234",
      state: "running",
      purpose: "Scan security logs",
      parentAgentName: "SecurityAgent",
    });
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(mockFetchResponse({ agents: [agent] })),
    ));
    await act(async () => { render(<EphemeralAgentsPanel />); });
    await waitFor(() =>
      expect(screen.getByText("Scan security logs")).toBeInTheDocument(),
    );
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByText("SecurityAgent")).toBeInTheDocument();
  });

  it("should_show_stat_tiles_with_correct_counts", async () => {
    const agents = [
      makeAgent({ id: "a1", state: "running" }),
      makeAgent({ id: "a2", state: "running" }),
      makeAgent({ id: "a3", state: "pending" }),
      makeAgent({ id: "a4", state: "terminated" }),
      makeAgent({ id: "a5", state: "failed" }),
    ];
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(mockFetchResponse({ agents })),
    ));
    await act(async () => { render(<EphemeralAgentsPanel />); });
    await waitFor(() => expect(screen.getByText("ÉLŐ")).toBeInTheDocument());
    // Stat labels
    expect(screen.getByText("Fut")).toBeInTheDocument();
    expect(screen.getByText("Vár")).toBeInTheDocument();
    expect(screen.getByText("Lezárt")).toBeInTheDocument();
    expect(screen.getByText("Hiba")).toBeInTheDocument();
    // Stat values (2 running, 1 pending, 1 terminated, 1 failed)
    const allTwos = screen.getAllByText("2");
    expect(allTwos.length).toBeGreaterThan(0);
  });

  it("should_show_HIBA_badge_and_error_message_when_fetch_fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(mockFetchResponse(null, false, 503)),
    ));
    await act(async () => { render(<EphemeralAgentsPanel />); });
    await waitFor(() => expect(screen.getByText("HIBA")).toBeInTheDocument());
    expect(screen.getByText("HTTP 503")).toBeInTheDocument();
  });

  it("should_show_HIBA_badge_and_error_message_when_fetch_throws", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.reject(new Error("Connection refused")),
    ));
    await act(async () => { render(<EphemeralAgentsPanel />); });
    await waitFor(() => expect(screen.getByText("HIBA")).toBeInTheDocument());
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("should_call_loadAgents_again_when_refresh_button_clicked", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(mockFetchResponse({ agents: [] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { render(<EphemeralAgentsPanel />); });
    await waitFor(() => expect(screen.getByText("ÉLŐ")).toBeInTheDocument());
    const callsBefore = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: /Frissítés/i }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("should_call_loadAgents_when_socket_emits_phoenix_ephemeral_spawned", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(mockFetchResponse({ agents: [] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { render(<EphemeralAgentsPanel />); });
    await waitFor(() => expect(screen.getByText("ÉLŐ")).toBeInTheDocument());
    // Find the handler registered for phoenix:ephemeral_spawned
    const onCalls = socketMock.on.mock.calls;
    const spawnEntry = onCalls.find(([event]) => event === "phoenix:ephemeral_spawned");
    expect(spawnEntry).toBeDefined();
    const spawnHandler = spawnEntry[1];
    const callsBefore = fetchMock.mock.calls.length;
    await act(async () => { spawnHandler(); });
    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("should_register_10s_polling_interval", () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<EphemeralAgentsPanel />);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 10_000);
    spy.mockRestore();
  });
});
