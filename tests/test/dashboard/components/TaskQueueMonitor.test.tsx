import React from "react";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskQueueMonitor } from "@/components/dashboard/TaskQueueMonitor";
import { toast } from "sonner";
import type { TaskItem } from "@/types/dashboard";
import type { TaskStats } from "@/lib/apiService";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import * as api from "@/lib/apiService";
vi.mock("@/lib/apiService", () => ({
  getTasks: vi.fn(),
  getTaskStats: vi.fn(),
  executePendingTask: vi.fn(),
  cancelTask: vi.fn(),
  retryTask: vi.fn(),
}));

const mockedApi = api as unknown as {
  getTasks: ReturnType<typeof vi.fn>;
  getTaskStats: ReturnType<typeof vi.fn>;
  executePendingTask: ReturnType<typeof vi.fn>;
  cancelTask: ReturnType<typeof vi.fn>;
  retryTask: ReturnType<typeof vi.fn>;
};
type ToastMock = {
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
};
const mockedToast = toast as unknown as ToastMock;

const makeTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 1,
  agent: "DeveloperAgent",
  task: "Generate report",
  status: "pending",
  created_at: "2024-01-01T12:00:00.000Z",
  ...overrides,
});

const makeStats = (overrides: Partial<TaskStats> = {}): TaskStats => ({
  total: 10,
  successCount: 5,
  errorCount: 2,
  pendingCount: 2,
  runningCount: 1,
  cancelledCount: 0,
  successRate: 50,
  avgDurationMs: 1234,
  failedByAgent: [],
  ...overrides,
});

const emptyTasks = { tasks: [], total: 0 };
const emptyStats = makeStats({
  total: 0, successCount: 0, errorCount: 0, pendingCount: 0,
  runningCount: 0, successRate: 0, avgDurationMs: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getTasks.mockResolvedValue(emptyTasks);
  // Note: getTaskStats returns TaskStats directly but component accesses .stats on it
  // Mock as if the component unwrap works: return { stats: makeStats() } cast as unknown
  mockedApi.getTaskStats.mockResolvedValue(emptyStats as unknown);
});

describe("TaskQueueMonitor", () => {
  it("shows loading spinner on initial render", async () => {
    let resolveFn!: (v: typeof emptyTasks) => void;
    mockedApi.getTasks.mockImplementation(
      () => new Promise<typeof emptyTasks>((res) => { resolveFn = res; })
    );
    mockedApi.getTaskStats.mockImplementation(() => new Promise(() => {}));
    await act(async () => { render(<TaskQueueMonitor />); });
    expect(screen.getByText("LOADING_SEQUENCE...")).toBeInTheDocument();
    await act(async () => { resolveFn(emptyTasks); });
  });

  it("shows empty message when no tasks", async () => {
    mockedApi.getTasks.mockResolvedValue(emptyTasks);
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() =>
      expect(screen.getByText("Queue_Empty")).toBeInTheDocument()
    );
  });

  it("renders task rows with id, agent, task, status", async () => {
    mockedApi.getTasks.mockResolvedValue({
      tasks: [makeTask({ id: 42, agent: "BookkeepingAgent", task: "Sync invoices", status: "running" })],
      total: 1,
    });
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Sync invoices")).toBeInTheDocument());
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("BookkeepingAgent")).toBeInTheDocument();
    expect(screen.getByText("RUN")).toBeInTheDocument();
  });

  it("shows toast.error when fetchData fails", async () => {
    mockedApi.getTasks.mockRejectedValue(new Error("DB offline"));
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith(
        "Fetch error: DB offline"
      )
    );
  });

  it("Execute Next Pending calls executePendingTask + toast.success", async () => {
    mockedApi.getTasks.mockResolvedValue({
      tasks: [makeTask({ status: "pending" })],
      total: 1,
    });
    mockedApi.getTaskStats.mockResolvedValue({
      stats: makeStats({ pendingCount: 1 }),
    } as unknown);
    mockedApi.executePendingTask.mockResolvedValue({ success: true });
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Generate report")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /execute next/i }));
    await waitFor(() =>
      expect(mockedApi.executePendingTask).toHaveBeenCalledTimes(1)
    );
    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Task execution initialized")
    );
  });

  it("Execute Next Pending shows toast.error on failure", async () => {
    mockedApi.getTasks.mockResolvedValue({ tasks: [makeTask({ status: "pending" })], total: 1 });
    mockedApi.getTaskStats.mockResolvedValue({ stats: makeStats({ pendingCount: 1 }) } as unknown);
    mockedApi.executePendingTask.mockRejectedValue(new Error("Queue locked"));
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Generate report")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /execute next/i }));
    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Execution error: Queue locked")
    );
  });

  it("Cancel button calls cancelTask and shows toast.info", async () => {
    mockedApi.getTasks.mockResolvedValue({
      tasks: [makeTask({ id: 7, status: "pending" })],
      total: 1,
    });
    mockedApi.cancelTask.mockResolvedValue(undefined);
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Generate report")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /cancel task/i }));
    await waitFor(() => expect(mockedApi.cancelTask).toHaveBeenCalledWith(7));
    expect(mockedToast.info).toHaveBeenCalledWith("Task cancelled");
  });

  it("Cancel failure shows toast.error", async () => {
    mockedApi.getTasks.mockResolvedValue({ tasks: [makeTask({ id: 7, status: "running" })], total: 1 });
    mockedApi.cancelTask.mockRejectedValue(new Error("Not found"));
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Generate report")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /cancel task/i }));
    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Error: Not found")
    );
  });

  it("Retry button shown for error task, calls retryTask + toast.success", async () => {
    mockedApi.getTasks.mockResolvedValue({
      tasks: [makeTask({ id: 9, status: "error" })],
      total: 1,
    });
    mockedApi.retryTask.mockResolvedValue(undefined);
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Generate report")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /retry task/i }));
    await waitFor(() => expect(mockedApi.retryTask).toHaveBeenCalledWith(9));
    expect(mockedToast.success).toHaveBeenCalledWith("Task re-queued");
  });

  it("View details opens dialog with task info", async () => {
    mockedApi.getTasks.mockResolvedValue({
      tasks: [makeTask({ id: 5, task: "Monthly audit", agent: "AuditAgent", status: "done" })],
      total: 1,
    });
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Monthly audit")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /view task details/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Scope to dialog to avoid ambiguity with table row cells
    expect(within(dialog).getByText("#5")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Monthly audit").length).toBeGreaterThan(0);
  });

  it("shows pagination controls when totalPages > 1", async () => {
    mockedApi.getTasks.mockResolvedValue({
      tasks: Array.from({ length: 10 }, (_, i) => makeTask({ id: i + 1, task: `Task ${i + 1}` })),
      total: 25, // 3 pages of 10
    });
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Task 1")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Prev" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByText("PAGE 1/3")).toBeInTheDocument();
  });

  it("Prev button disabled on page 1, Next enabled", async () => {
    mockedApi.getTasks.mockResolvedValue({
      tasks: [makeTask()],
      total: 20,
    });
    await act(async () => { render(<TaskQueueMonitor />); });
    await waitFor(() => expect(screen.getByText("Generate report")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
  });

  it("sets up a 5s polling interval", () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    render(<TaskQueueMonitor />);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 5000);
    spy.mockRestore();
  });
});
