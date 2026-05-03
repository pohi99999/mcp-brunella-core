import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentStatusMonitor } from "@/components/dashboard/AgentStatusMonitor";
import type { AgentRuntimeInfo } from "@/types/dashboard";

const { useSystemSignalMock } = vi.hoisted(() => ({
  useSystemSignalMock: vi.fn(),
}));

vi.mock("@/hooks/useSystemSignal", () => ({
  useSystemSignal: () => useSystemSignalMock(),
}));

const makeAgent = (overrides: Partial<AgentRuntimeInfo & { taskDescription?: string }> = {}) => ({
  name: "TestAgent",
  description: "Test agent",
  status: "idle" as const,
  successCount: 0,
  errorCount: 0,
  ...overrides,
});

const makeAgentsMap = (
  entries: Array<AgentRuntimeInfo & { taskDescription?: string }>
): Map<string, AgentRuntimeInfo> => {
  const map = new Map<string, AgentRuntimeInfo>();
  entries.forEach((a) => map.set(a.name, a as AgentRuntimeInfo));
  return map;
};

beforeEach(() => {
  vi.clearAllMocks();
  useSystemSignalMock.mockReturnValue({ agents: new Map() });
});

describe("AgentStatusMonitor", () => {
  it("shows scanning message when agents map is empty", () => {
    render(<AgentStatusMonitor />);
    expect(screen.getByText("Scanning_for_signals...")).toBeInTheDocument();
  });

  it("renders agent name (CSS uppercase)", () => {
    useSystemSignalMock.mockReturnValue({
      agents: makeAgentsMap([makeAgent({ name: "DeveloperAgent" })]),
    });
    render(<AgentStatusMonitor />);
    // CSS `uppercase` class transforms visually; DOM text is the original casing
    expect(screen.getByText("DeveloperAgent")).toBeInTheDocument();
  });

  it("shows working status for working agent", () => {
    useSystemSignalMock.mockReturnValue({
      agents: makeAgentsMap([makeAgent({ name: "Alpha", status: "working" })]),
    });
    render(<AgentStatusMonitor />);
    // Component renders {agent.status} directly (CSS uppercase transforms visually, DOM is lowercase)
    expect(screen.getByText("working")).toBeInTheDocument();
  });

  it("shows error status for error agent", () => {
    useSystemSignalMock.mockReturnValue({
      agents: makeAgentsMap([makeAgent({ name: "Beta", status: "error" })]),
    });
    render(<AgentStatusMonitor />);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("shows idle status for idle agent", () => {
    useSystemSignalMock.mockReturnValue({
      agents: makeAgentsMap([makeAgent({ name: "Gamma", status: "idle" })]),
    });
    render(<AgentStatusMonitor />);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("shows taskDescription when present", () => {
    useSystemSignalMock.mockReturnValue({
      agents: makeAgentsMap([
        makeAgent({ name: "Delta", status: "working", taskDescription: "Processing invoice batch" } as any),
      ]),
    });
    render(<AgentStatusMonitor />);
    expect(screen.getByText("Processing invoice batch")).toBeInTheDocument();
  });

  it("does not show task box when taskDescription is absent", () => {
    useSystemSignalMock.mockReturnValue({
      agents: makeAgentsMap([makeAgent({ name: "Epsilon", status: "idle" })]),
    });
    render(<AgentStatusMonitor />);
    // No task description box rendered — only the agent name/badge row
    expect(screen.queryByText(/Processing/)).not.toBeInTheDocument();
  });

  it("shows correct active count chip and registered count in footer", () => {
    useSystemSignalMock.mockReturnValue({
      agents: makeAgentsMap([
        makeAgent({ name: "A", status: "working" }),
        makeAgent({ name: "B", status: "idle" }),
        makeAgent({ name: "C", status: "working" }),
      ]),
    });
    render(<AgentStatusMonitor />);
    // Header chip: ACTIVE label + working count (2)
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    // Footer: total registered agents count
    expect(screen.getByText("3 REGISTERED")).toBeInTheDocument();
  });

  it("handles null agents gracefully (shows empty state)", () => {
    useSystemSignalMock.mockReturnValue({ agents: null });
    render(<AgentStatusMonitor />);
    expect(screen.getByText("Scanning_for_signals...")).toBeInTheDocument();
  });
});
