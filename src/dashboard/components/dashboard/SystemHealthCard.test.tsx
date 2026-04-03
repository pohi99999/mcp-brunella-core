import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SystemHealthCard } from "./SystemHealthCard";
import * as apiService from "@/lib/apiService";

vi.mock("@/lib/apiService", () => ({
  checkHealth: vi.fn(),
  startService: vi.fn(),
  stopService: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

describe("SystemHealthCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.checkHealth).mockResolvedValue({
      status: "ok",
      timestamp: "2026-04-02T14:00:00.000Z",
      runtimeDrift: {
        overallState: "warn",
        sampleCount: 18,
        windowMinutes: 17,
        lastSampleAt: "2026-04-02T14:00:00.000Z",
        recommendation: {
          overallAction: "tune",
          confidence: "medium",
          rationale: "Node tuning javasolt a magas heap kihasznaltsag miatt.",
          signals: ["node_heap_pressure"],
          node: {
            action: "tune",
            current: { heapMb: 1536, runtimeLimitMb: 2048, restartThresholdMb: 1792 },
            suggested: { heapMb: 1792, runtimeLimitMb: 2304, restartThresholdMb: 2048 },
          },
          python: {
            action: "observe",
            current: { memoryLimitMb: 1024 },
            suggested: { memoryLimitMb: 1024 },
          },
        },
        node: {
          restartCount: 2,
          driftCount: 1,
          currentHeapUtilizationPercent: 83.2,
        },
        python: {
          status: "degraded",
          restartCount: 1,
          unavailableCount: 0,
        },
      },
      runtimeThresholdRolloutJournal: {
        id: 7,
        recordedAt: "2026-04-02T14:05:00.000Z",
        approvedBy: "Ops Lead",
        approvalTicket: "CHG-2026-040",
        approvedAt: "2026-04-02T11:00:00.000Z",
        changeWindow: "2026-04-02 12:00-13:00 UTC",
        overallAction: "tune",
        confidence: "high",
        overallState: "warn",
        sampleCount: 18,
        canApply: true,
      },
      services: {
        ollama: { status: "healthy" },
        anythingllm: { status: "healthy" },
        agents: { status: "healthy" },
        mcp: { status: "healthy" },
        python: { status: "healthy" },
        cloudflare: { status: "healthy" },
      },
    } as apiService.HealthStatus);
  });

  it("renders runtime drift summary strip when runtime drift is available", async () => {
    render(<SystemHealthCard />);

    await waitFor(() => {
      expect(apiService.checkHealth).toHaveBeenCalled();
    });

    const driftSummary = screen.getByTestId("system-health-runtime-drift");
    expect(driftSummary).toBeInTheDocument();
    expect(within(driftSummary).getByText("Runtime Drift")).toBeInTheDocument();
    expect(within(driftSummary).getByText("warn")).toBeInTheDocument();
    expect(within(driftSummary).getByText("Node restart")).toBeInTheDocument();
    expect(within(driftSummary).getByText("Node drift")).toBeInTheDocument();
    expect(within(driftSummary).getByText("Py restart")).toBeInTheDocument();
    expect(within(driftSummary).getByText("Py unavailable")).toBeInTheDocument();
    expect(within(driftSummary).getByText("2")).toBeInTheDocument();
    expect(within(driftSummary).getAllByText("1")).toHaveLength(2);
    expect(within(driftSummary).getByText("0")).toBeInTheDocument();
    const recommendation = screen.getByTestId("system-health-runtime-recommendation");
    expect(recommendation).toHaveTextContent("Stable Tuning Recommendation");
    expect(recommendation).toHaveTextContent("TUNE · medium");
    expect(recommendation).toHaveTextContent("Node envelope");
    expect(recommendation).toHaveTextContent("heap 1792 MB");
    expect(recommendation).toHaveTextContent("Python envelope");
    const journal = screen.getByTestId("system-health-runtime-rollout-journal");
    expect(journal).toHaveTextContent("Latest Approved Rollout Evidence");
    expect(journal).toHaveTextContent("CHG-2026-040");
    expect(journal).toHaveTextContent("Ops Lead");
  });
});
