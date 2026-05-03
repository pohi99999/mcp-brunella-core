import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("renders the current health monitor summary and healthy service rows", async () => {
    render(<SystemHealthCard />);

    await waitFor(() => {
      expect(apiService.checkHealth).toHaveBeenCalled();
    });

    expect(screen.getByText("Health Monitor")).toBeInTheDocument();
    expect(screen.getByText(/6\s*\/\s*6/)).toBeInTheDocument();
    expect(screen.getByText("Ollama Local")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("Agent Cluster")).toBeInTheDocument();
    expect(screen.getByText("MCP Protocol")).toBeInTheDocument();
    expect(screen.getByText("Python API")).toBeInTheDocument();
    expect(screen.getByText("Edge Network")).toBeInTheDocument();
    expect(screen.getByText("Engine ready")).toBeInTheDocument();
    expect(screen.getByText("Gateway & R2 OK")).toBeInTheDocument();
    expect(screen.getAllByText("Kernel")).toHaveLength(3);
  });
});
