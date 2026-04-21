/**
 * apiService.test.ts
 * Unit tests for the dashboard API service layer.
 * Covers: fetchWithTimeout, safeJson, checkHealth, getTasks, getTaskStats,
 *         getDeveloperMetrics, getAgents
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithTimeout,
  safeJson,
  checkHealth,
  getLatestBriefingReport,
  getTasks,
  getTaskStats,
  getDeveloperMetrics,
  getAgents,
  getTrackStatusSnapshot,
  runBriefingReport,
  generateWithAnthropic,
} from "@/lib/apiService";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : String(status),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function emptyResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: () => Promise.resolve(""),
  } as unknown as Response;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// fetchWithTimeout
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchWithTimeout", () => {
  it("should_resolve_when_fetch_succeeds_and_response_returned", async () => {
    const expected = mockResponse({ ok: true });
    fetchMock.mockResolvedValueOnce(expected);

    const result = await fetchWithTimeout("/api/test");

    expect(result).toBe(expected);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("should_throw_timeout_error_when_request_exceeds_timeoutMs", async () => {
    vi.useFakeTimers();

    // Mock fetch that respects the AbortSignal
    fetchMock.mockImplementationOnce((_url: string, options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted.");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });

    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection warning
    await Promise.all([
      expect(fetchWithTimeout("/api/slow", {}, 100)).rejects.toThrow("Időtúllépés"),
      vi.advanceTimersByTimeAsync(200),
    ]);
  });

  it("should_throw_original_error_when_fetch_rejects_with_non_abort_error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network failure"));

    await expect(fetchWithTimeout("/api/fail")).rejects.toThrow("Network failure");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeJson
// ─────────────────────────────────────────────────────────────────────────────

describe("safeJson", () => {
  it("should_parse_valid_json_response_and_return_typed_object", async () => {
    const response = mockResponse({ status: "ok", count: 3 });
    const result = await safeJson<{ status: string; count: number }>(response);

    expect(result).toEqual({ status: "ok", count: 3 });
  });

  it("should_throw_when_response_body_is_empty_string", async () => {
    const response = {
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(""),
    } as unknown as Response;

    await expect(safeJson(response)).rejects.toThrow("Üres válasz");
  });

  it("should_throw_when_response_body_contains_invalid_json", async () => {
    const response = {
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve("not-json{{{{"),
    } as unknown as Response;

    await expect(safeJson(response)).rejects.toThrow("Érvénytelen válasz");
  });

  it("should_throw_http_error_message_when_response_not_ok_and_empty_body", async () => {
    const response = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: () => Promise.resolve(""),
    } as unknown as Response;

    await expect(safeJson(response)).rejects.toThrow("HTTP 503");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkHealth
// ─────────────────────────────────────────────────────────────────────────────

describe("checkHealth", () => {
  it("should_return_health_status_when_api_returns_ok", async () => {
    const healthBody = {
      status: "healthy",
      timestamp: "2025-01-01T00:00:00Z",
      services: {
        ollama: { ok: true },
        anythingllm: { ok: true },
        agents: { ok: true },
        mcp: { ok: true },
        python: { ok: false },
        cloudflare: { ok: true },
      },
    };
    fetchMock.mockResolvedValueOnce(mockResponse(healthBody));

    const result = await checkHealth();

    expect(result.status).toBe("healthy");
    expect(result.services.ollama).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/health"),
      expect.any(Object),
    );
  });

  it("should_throw_when_api_returns_500", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "Internal error" }, 500));

    await expect(checkHealth()).rejects.toThrow("Health check failed: 500");
  });

  it("should_throw_when_api_returns_404", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "Not found" }, 404));

    await expect(checkHealth()).rejects.toThrow("Health check failed: 404");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTasks
// ─────────────────────────────────────────────────────────────────────────────

describe("getTasks", () => {
  it("should_call_correct_url_with_query_params_when_all_params_provided", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ tasks: [], total: 0 }));

    await getTasks(10, 20, "running");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=20");
    expect(url).toContain("status=running");
  });

  it("should_omit_status_param_when_status_not_provided", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ tasks: [], total: 0 }));

    await getTasks(5, 0);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("status=");
  });

  it("should_return_tasks_array_when_api_responds_successfully", async () => {
    const tasks = [{ id: 1, status: "running", agent: "Developer", task: "Build" }];
    fetchMock.mockResolvedValueOnce(mockResponse({ tasks, total: 1 }));

    const result = await getTasks();

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].status).toBe("running");
  });

  it("should_throw_when_api_returns_error_status", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "Not found" }, 404));

    await expect(getTasks()).rejects.toThrow("Tasks: HTTP 404");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTaskStats
// ─────────────────────────────────────────────────────────────────────────────

describe("getTaskStats", () => {
  it("should_return_task_stats_object_from_api_stats_field", async () => {
    const stats = {
      total: 100,
      successCount: 90,
      errorCount: 5,
      pendingCount: 3,
      runningCount: 2,
      cancelledCount: 0,
      successRate: 0.9,
      avgDurationMs: 1500,
      failedByAgent: [],
    };
    fetchMock.mockResolvedValueOnce(mockResponse({ stats }));

    const result = await getTaskStats();

    expect(result.total).toBe(100);
    expect(result.successRate).toBe(0.9);
    expect(result.failedByAgent).toEqual([]);
  });

  it("should_throw_when_api_returns_non_ok_status", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}, 500));

    await expect(getTaskStats()).rejects.toThrow("Task Stats: HTTP 500");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTrackStatusSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("getTrackStatusSnapshot", () => {
  it("should_return_status_snapshot_from_api", async () => {
    const snapshot = {
      success: true as const,
      checkedAt: "2026-04-02T10:00:00.000Z",
      overallStats: { total: 2, active: 1, proposed: 1, completed: 0, archived: 0 },
      businessGroupStats: {
        total: 1,
        active: 1,
        proposed: 0,
        completed: 0,
        archived: 0,
        averageProgress: 42,
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
      },
      activeBusinessTracks: [
        {
          id: "business-critical-track",
          title: "Invoice automation",
          status: "active" as const,
          priority: "critical" as const,
          progress: 42,
          group: "business" as const,
        },
      ],
      proposedBusinessTracks: [],
      completedBusinessTracks: [],
      archivedBusinessTracks: [],
      recommendation: {
        headline: "Fókusz: Invoice automation",
        rationale: "A legfontosabb business track aktív.",
        focusTrackId: "business-critical-track",
        focusTrackTitle: "Invoice automation",
        nextSteps: ["Step 1"],
      },
    };

    fetchMock.mockResolvedValueOnce(mockResponse(snapshot));

    const result = await getTrackStatusSnapshot();

    expect(result.checkedAt).toBe("2026-04-02T10:00:00.000Z");
    expect(result.overallStats.total).toBe(2);
    expect(result.recommendation.focusTrackId).toBe("business-critical-track");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/tracks/status"),
      expect.any(Object),
    );
  });

  it("should_throw_when_api_returns_non_ok_status", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "Denied" }, 403));

    await expect(getTrackStatusSnapshot()).rejects.toThrow("Denied");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getDeveloperMetrics
// ─────────────────────────────────────────────────────────────────────────────

describe("getDeveloperMetrics", () => {
  it("should_return_metrics_from_data_metrics_field", async () => {
    const metrics = {
      builds: {
        total: 10,
        success: 9,
        fail: 1,
        lastStatus: "success" as const,
        lastDurationMs: 5000,
      },
      tests: { totalRuns: 50, lastPassRate: 0.98, lastDurationMs: 12000 },
      tasks: { total: 200, success: 190, error: 10, avgDurationMs: 800 },
      ai: { totalTokenUsage: 100_000, estimatedCost: 0.5 },
      history: [],
    };
    fetchMock.mockResolvedValueOnce(mockResponse({ metrics }));

    const result = await getDeveloperMetrics();

    expect(result.builds.total).toBe(10);
    expect(result.ai.estimatedCost).toBe(0.5);
    expect(result.history).toEqual([]);
  });

  it("should_throw_when_api_returns_non_ok_status", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}, 503));

    await expect(getDeveloperMetrics()).rejects.toThrow("Developer Metrics: HTTP 503");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAgents
// ─────────────────────────────────────────────────────────────────────────────

describe("getAgents", () => {
  it("should_return_agents_array_from_response", async () => {
    const agents = [{ name: "Developer", role: "Code", description: "Writes code" }];
    fetchMock.mockResolvedValueOnce(mockResponse({ agents }));

    const result = await getAgents();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Developer");
  });

  it("should_return_empty_array_when_agents_field_missing", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}));

    const result = await getAgents();

    expect(result).toEqual([]);
  });

  it("should_throw_when_api_returns_non_ok_status", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(401));

    await expect(getAgents()).rejects.toThrow("Agents: HTTP 401");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// briefing API
// ─────────────────────────────────────────────────────────────────────────────

describe("briefing API", () => {
  it("should_normalize_latest_briefing_report_and_use_v1_path", async () => {
    const payload = {
      id: "br-1",
      generatedAt: "2026-04-08T11:00:00.000Z",
      reportDate: "2026-04-08",
      itemsCount: 1,
      brunellaLayersCount: 1,
      triggeredBy: "scheduler",
      report: {
        id: "br-1",
        generatedAt: "2026-04-08T11:00:00.000Z",
        reportDate: "2026-04-08",
        triggeredBy: "scheduler",
        items: [
          {
            title: "LangChain 0.3 kiadás",
            url: "https://blog.langchain.dev/release-0.3",
            source: "LangChain Blog",
            excerpt: "Ágens memória fejlesztések.",
            relevance: "Memoria réteg érintett.",
            brunellaLayer: "memoria",
            publishedAt: "2026-04-07T10:00:00.000Z",
          },
        ],
        dryRun: false,
      },
    };
    fetchMock.mockResolvedValueOnce(mockResponse(payload));

    const result = await getLatestBriefingReport();

    expect(result).not.toBeNull();
    expect(result?.report.items[0].brunellaLayers).toEqual(["memoria"]);
    expect(result?.report.brunellaLayersCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/briefing/reports/latest"),
      expect.any(Object),
    );
  });

  it("should_return_run_result_with_nested_report_date_and_use_v1_path", async () => {
    const payload = {
      success: true,
      message: "Kész",
      report: {
        id: "br-1",
        reportDate: "2026-04-08",
        generatedAt: "2026-04-08T11:00:00.000Z",
        triggeredBy: "api",
        items: [],
        dryRun: false,
      },
    };
    fetchMock.mockResolvedValueOnce(mockResponse(payload));

    const result = await runBriefingReport(true);

    expect(result.success).toBe(true);
    expect(result.reportDate).toBe("2026-04-08");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/briefing/run"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ dryRun: true }),
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});

describe("generateWithAnthropic", () => {
  it("should_post_message_and_model_to_anthropic_test_endpoint", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, reply: "Anthropic válasz" }));

    const result = await generateWithAnthropic("Teszt prompt", "claude-sonnet", "Rendszerutasítás");

    expect(result).toBe("Anthropic válasz");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/anthropic/test"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Teszt prompt",
          model: "claude-sonnet",
          system: "Rendszerutasítás",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("should_throw_when_anthropic_endpoint_returns_error", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, error: "No API key" }, 500));

    await expect(generateWithAnthropic("Teszt prompt")).rejects.toThrow("No API key");
  });
});
