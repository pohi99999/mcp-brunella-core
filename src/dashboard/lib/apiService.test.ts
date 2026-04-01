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
  getTasks,
  getTaskStats,
  getDeveloperMetrics,
  getAgents,
} from "./apiService";

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
