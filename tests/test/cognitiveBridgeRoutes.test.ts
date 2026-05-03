import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createCognitiveBridgeRoutes } from "@apps/mcp-core/server/routes/cognitiveBridge.js";

const mocks = vi.hoisted(() => ({
  enrich: vi.fn(),
  reflect: vi.fn(),
  getCognitiveStats: vi.fn(),
  queryMemory: vi.fn(),
  queryContext: vi.fn(),
  queryPreferences: vi.fn(),
  getGoldenStats: vi.fn(),
}));

vi.mock("@packages/core-logic/copilotCognitiveBridge.js", () => ({
  enrich: mocks.enrich,
  reflect: mocks.reflect,
  getCognitiveStats: mocks.getCognitiveStats,
}));

vi.mock("@packages/core-logic/structuredMemory.js", () => ({
  queryMemory: mocks.queryMemory,
}));

vi.mock("@packages/core-logic/graphRagEngine.js", () => ({
  GraphRagEngine: {
    getInstance: () => ({
      queryContext: mocks.queryContext,
    }),
  },
}));

vi.mock("@packages/core-logic/userPreferences.js", () => ({
  queryPreferences: mocks.queryPreferences,
}));

vi.mock("@packages/core-logic/goldenDatasetBridge.js", () => ({
  getGoldenStats: mocks.getGoldenStats,
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

describe("Cognitive Bridge routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enrich.mockResolvedValue({ layers: [{ status: "ok" }], processingTimeMs: 3 });
    mocks.reflect.mockResolvedValue({ stored: true, layers: ["structured"] });
    mocks.getCognitiveStats.mockResolvedValue({ activeLayers: 4, totalLayers: 13, timestamp: "now" });
    mocks.queryMemory.mockReturnValue([{ id: "memory" }]);
    mocks.queryContext.mockReturnValue({ nodes: [] });
    mocks.queryPreferences.mockReturnValue([{ key: "theme" }]);
    mocks.getGoldenStats.mockResolvedValue({ examples: 2 });

    app = express();
    app.use(express.json());
    app.use("/api/cognitive", createCognitiveBridgeRoutes());
  });

  it("validates and normalizes enrichment requests", async () => {
    const invalid = await request(app)
      .post("/api/cognitive/enrich")
      .send({ query: "   " });
    expect(invalid.status).toBe(400);

    const res = await request(app)
      .post("/api/cognitive/enrich")
      .send({ query: "  readiness  ", userId: "  user-1  ", agentName: " Copilot ", maxResults: 999 });

    expect(res.status).toBe(200);
    expect(mocks.enrich).toHaveBeenCalledWith({
      query: "readiness",
      userId: "user-1",
      agentName: "Copilot",
      maxResults: 50,
    });
  });

  it("validates reflection requests and confidence bounds", async () => {
    const invalidConfidence = await request(app)
      .post("/api/cognitive/reflect")
      .send({ taskId: "t1", agentName: "Agent", task: "Task", result: "Done", success: true, confidence: 2 });
    expect(invalidConfidence.status).toBe(400);

    const res = await request(app)
      .post("/api/cognitive/reflect")
      .send({ taskId: " t1 ", agentName: " Agent ", task: " Task ", result: " Done ", success: true, confidence: 0.8 });

    expect(res.status).toBe(200);
    expect(mocks.reflect).toHaveBeenCalledWith({
      taskId: "t1",
      agentName: "Agent",
      task: "Task",
      result: "Done",
      success: true,
      confidence: 0.8,
    });
  });

  it("validates memory query layer and clamps numeric params", async () => {
    const invalid = await request(app)
      .post("/api/cognitive/query")
      .send({ layer: "unknown", query: "test" });
    expect(invalid.status).toBe(400);

    const structured = await request(app)
      .post("/api/cognitive/query")
      .send({ layer: "structured", query: "  task  ", params: { agentName: " Agent ", limit: 999 } });

    expect(structured.status).toBe(200);
    expect(mocks.queryMemory).toHaveBeenCalledWith({
      task: "task",
      agentName: "Agent",
      limit: 50,
    });
  });

  it("reports health from cognitive stats", async () => {
    const res = await request(app).get("/api/cognitive/health");

    expect(res.status).toBe(200);
    expect(res.body.healthy).toBe(true);
    expect(res.body.activeLayers).toBe(4);
  });
});
