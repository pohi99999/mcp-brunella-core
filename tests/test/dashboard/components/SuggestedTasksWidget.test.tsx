import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Radix UI Select is not fully supported in jsdom — replace with native <select>
// ---------------------------------------------------------------------------
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { SuggestedTasksWidget } from "@/components/dashboard/SuggestedTasksWidget";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as Response;
}

function makeTask(overrides: Partial<{
  id: string; file_path: string; line_number: number;
  todo_text: string; confidence_score: number;
  status: "pending" | "in_progress" | "completed" | "archived";
  created_at: string;
}> = {}) {
  return {
    id: "task-1",
    file_path: "src/foo.ts",
    line_number: 42,
    todo_text: "TODO: fix this",
    confidence_score: 0.9,
    status: "pending" as const,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const emptyData = { data: [] };

function stubFetch(
  tasksPayload: unknown = emptyData,
  scanPayload: unknown = { data: { count: 5 } },
  tasksOk = true,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/suggested-tasks/scan")) {
        return Promise.resolve(mockResponse(scanPayload));
      }
      if (url.includes("/suggested-tasks")) {
        return Promise.resolve(mockResponse(tasksPayload, tasksOk));
      }
      throw new Error(`Unhandled fetch: ${url}`);
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SuggestedTasksWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should_show_skeleton_when_loading_data_initially", () => {
    // Fetch never resolves → stays in loading state
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<SuggestedTasksWidget />);
    // Skeleton (or loading card) is rendered before data arrives
    expect(screen.getByText("Suggested Tasks (TODOs)")).toBeInTheDocument();
  });

  it("should_display_stats_when_tasks_fetched_successfully", async () => {
    stubFetch({
      data: [
        makeTask({ status: "pending", confidence_score: 0.9 }),
        makeTask({ id: "t2", status: "in_progress", confidence_score: 0.7 }),
        makeTask({ id: "t3", status: "completed", confidence_score: 0.3 }),
        makeTask({ id: "t4", status: "pending", confidence_score: 0.85 }),
      ],
    });
    await act(async () => { render(<SuggestedTasksWidget />); });
    // Stats: total=4 TODOs, pending=2, in_progress=1, completed=1, critical=2
    await waitFor(() =>
      expect(screen.getByText("4 TODOs/FIXMEs detected")).toBeInTheDocument(),
    );
    // Pending and Critical both show "2"; In Progress and Completed show "1"
    const twos = screen.getAllByText("2");
    expect(twos.length).toBeGreaterThanOrEqual(2); // pending=2, critical=2
    const ones = screen.getAllByText("1");
    expect(ones.length).toBeGreaterThanOrEqual(2); // in_progress=1, completed=1
  });

  it("should_show_toast_error_when_fetch_returns_non_ok", async () => {
    stubFetch(null, undefined, false);
    await act(async () => { render(<SuggestedTasksWidget />); });
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Failed to fetch tasks"),
    );
  });

  it("should_show_toast_error_when_fetch_throws", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Network error"))));
    await act(async () => { render(<SuggestedTasksWidget />); });
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Network error"),
    );
  });

  it("should_call_POST_scan_and_show_success_toast_on_scan_button_click", async () => {
    stubFetch({ data: [] }, { data: { count: 7 } });
    await act(async () => { render(<SuggestedTasksWidget />); });
    await waitFor(() => expect(screen.getByRole("button", { name: /Scan Now/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Scan Now/i }));
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Found 7 TODOs"),
    );
    const fetchMock = vi.mocked(fetch as typeof fetch);
    const scanCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/scan"),
    );
    expect(scanCall?.[1]).toMatchObject({ method: "POST" });
  });

  it("should_show_critical_warning_toast_when_scan_returns_criticalCount_gt_0", async () => {
    stubFetch({ data: [] }, { data: { count: 3, criticalCount: 2 } });
    await act(async () => { render(<SuggestedTasksWidget />); });
    await waitFor(() => expect(screen.getByRole("button", { name: /Scan Now/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Scan Now/i }));
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringMatching(/Kritikus TODO-k: 2/),
      ),
    );
  });

  it("should_show_toast_error_when_scan_fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/scan")) return Promise.reject(new Error("Scan timeout"));
        return Promise.resolve(mockResponse({ data: [] }));
      }),
    );
    await act(async () => { render(<SuggestedTasksWidget />); });
    await waitFor(() => expect(screen.getByRole("button", { name: /Scan Now/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Scan Now/i }));
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Scan timeout"),
    );
  });

  it("should_render_task_row_with_file_path_and_confidence", async () => {
    stubFetch({
      data: [
        makeTask({ file_path: "src/server/routes/auth.ts", line_number: 42, confidence_score: 0.95, todo_text: "TODO: add rate limit" }),
      ],
    });
    await act(async () => { render(<SuggestedTasksWidget />); });
    // Component renders "{file_path}:{line_number}" in a single text node
    await waitFor(() =>
      expect(screen.getByText("src/server/routes/auth.ts:42")).toBeInTheDocument(),
    );
    // toFixed(0) → "95%"
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("should_show_no_tasks_message_when_filter_matches_nothing", async () => {
    stubFetch({
      data: [makeTask({ status: "pending", confidence_score: 0.5 })],
    });
    await act(async () => { render(<SuggestedTasksWidget />); });
    await waitFor(() =>
      expect(screen.getByText("1 TODOs/FIXMEs detected")).toBeInTheDocument(),
    );
    // Filter to completed — no completed tasks exist → empty list
    const statusSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(statusSelect, { target: { value: "completed" } });
    await waitFor(() =>
      expect(screen.getByText("No tasks match filters")).toBeInTheDocument(),
    );
  });

  it("should_show_clear_button_when_any_filter_is_active", async () => {
    stubFetch({ data: [makeTask()] });
    await act(async () => { render(<SuggestedTasksWidget />); });
    await waitFor(() =>
      expect(screen.getByText("1 TODOs/FIXMEs detected")).toBeInTheDocument(),
    );
    // No Clear button before filter is applied
    expect(screen.queryByRole("button", { name: /Clear/i })).not.toBeInTheDocument();
    // Apply confidence filter
    const confidenceSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(confidenceSelect, { target: { value: "80+" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Clear/i })).toBeInTheDocument(),
    );
  });

  it("should_remove_clear_button_after_clicking_clear_filters", async () => {
    stubFetch({ data: [makeTask()] });
    await act(async () => { render(<SuggestedTasksWidget />); });
    await waitFor(() =>
      expect(screen.getByText("1 TODOs/FIXMEs detected")).toBeInTheDocument(),
    );
    // Activate filter → Clear appears
    const confidenceSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(confidenceSelect, { target: { value: "80+" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Clear/i })).toBeInTheDocument(),
    );
    // Click Clear → button disappears and filter resets
    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Clear/i })).not.toBeInTheDocument(),
    );
  });

  it("should_register_30s_polling_interval", () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<SuggestedTasksWidget />);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 30000);
    spy.mockRestore();
  });
});
