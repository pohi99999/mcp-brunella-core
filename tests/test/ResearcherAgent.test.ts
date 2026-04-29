/**
 * ResearcherAgent — focused contract tests for the /rag/query integration.
 *
 * These tests verify the TypeScript ↔ Python RAG contract without starting a
 * real Python server. `fetch` is mocked globally so every assertion exercises
 * the actual agent code paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResearcherAgent } from "@packages/agents/ResearcherAgent.js";

// ── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

// We mock the global fetch so no real network call is made.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a Response-like object that mimics a successful fetch result. */
function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    statusText: "OK",
    json: async () => body,
  } as unknown as Response;
}

/** Builds a Response-like object that mimics an HTTP error. */
function makeErrorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    statusText,
    status,
    json: async () => ({ detail: statusText }),
  } as unknown as Response;
}

// ── Contract: RAGResultItem shape ─────────────────────────────────────────────

const SAMPLE_RAG_RESULTS = [
  { text: "Brunella is an AI agent system.", source: "docs/intro.pdf", page_num: 1, score: 0.12 },
  { text: "The ResearcherAgent handles RAG queries.", source: "docs/agents.pdf", page_num: 3, score: 0.21 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ResearcherAgent → /rag/query contract", () => {
  let agent: ResearcherAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ResearcherAgent();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("should call POST /rag/query with correct payload and return formatted results", async () => {
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({ results: SAMPLE_RAG_RESULTS }),
    );

    const result = await agent.executeTask({
      task: "keress a tudásbázisban: Brunella agents",
    });

    // Verify the fetch was called with the right URL and method
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/rag/query");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({ "Content-Type": "application/json" });

    // Verify the request body
    const body = JSON.parse(options.body as string) as { query: string; limit: number };
    expect(body.query).toContain("tudásbázisban");
    expect(body.limit).toBe(5);

    // Verify success result shape
    expect(result.success).toBe(true);
    expect((result.data as { source: string }).source).toBe("rag");
    expect((result.data as { results: unknown[] }).results).toHaveLength(2);
    expect((result.data as { results: typeof SAMPLE_RAG_RESULTS }).results[0].text).toBe(
      SAMPLE_RAG_RESULTS[0].text,
    );
  });

  it("should trigger RAG path on 'rag' keyword", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: SAMPLE_RAG_RESULTS }));

    const result = await agent.executeTask({ task: "rag search for architecture docs" });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  it("should trigger RAG path on 'internal' keyword", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: [SAMPLE_RAG_RESULTS[0]] }));

    const result = await agent.executeTask({ task: "internal knowledge lookup" });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect((result.data as { results: unknown[] }).results).toHaveLength(1);
  });

  it("should trigger RAG path on 'belső' (Hungarian) keyword", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: SAMPLE_RAG_RESULTS }));

    const result = await agent.executeTask({ task: "belső dokumentáció keresése" });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  // ── Empty results ─────────────────────────────────────────────────────────

  it("should return success with empty summary when /rag/query returns no results", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: [] }));

    const result = await agent.executeTask({ task: "rag: unknown topic xyz" });

    expect(result.success).toBe(true);
    expect((result.data as { results: unknown[] }).results).toHaveLength(0);
    expect(result.message).toContain("Nem találtam");
  });

  it("should handle a missing 'results' key gracefully (treats as empty)", async () => {
    // Python server returning unexpected shape — agent should default to []
    mockFetch.mockResolvedValueOnce(makeOkResponse({}));

    const result = await agent.executeTask({ task: "rag missing key scenario" });

    expect(result.success).toBe(true);
  });

  // ── Error / degradation paths ─────────────────────────────────────────────

  it("should degrade gracefully when Python returns 503 (RAG unavailable)", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(503, "Service Unavailable"));

    const result = await agent.executeTask({ task: "tudásbázis lookup" });

    // Agent must not throw — it logs the error and returns empty results
    expect(result.success).toBe(true);
    expect((result.data as { results: unknown[] }).results).toHaveLength(0);
  });

  it("should degrade gracefully on network failure (fetch throws)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await agent.executeTask({ task: "belső query" });

    // Agent's catch block returns []
    expect(result.success).toBe(true);
    expect((result.data as { results: unknown[] }).results).toHaveLength(0);
  });

  // ── Non-RAG path must NOT call fetch ─────────────────────────────────────

  it("should NOT call /rag/query for a plain web search task", async () => {
    const result = await agent.executeTask({ task: "keress az interneten macskák" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("should return failure for an unrecognized task", async () => {
    const result = await agent.executeTask({ task: "unrelated task with no keywords" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  // ── contextUsed is populated ──────────────────────────────────────────────

  it("should populate contextUsed with source file names from results", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: SAMPLE_RAG_RESULTS }));

    const result = await agent.executeTask({ task: "rag overview" });

    expect(result.contextUsed).toBeDefined();
    expect(result.contextUsed).toContain("docs/intro.pdf");
    expect(result.contextUsed).toContain("docs/agents.pdf");
  });
});
