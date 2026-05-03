import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createIntelligenceRouter } from "@apps/mcp-core/server/routes/intelligence.js";

const mocks = vi.hoisted(() => ({
  getIntelligenceOverview: vi.fn(),
  ingestSignal: vi.fn(),
  listReviewQueue: vi.fn(),
  listSignals: vi.fn(),
  reviewSignal: vi.fn(),
}));

vi.mock("@packages/core-logic/intelligenceMonitor.js", () => ({
  getIntelligenceOverview: mocks.getIntelligenceOverview,
  ingestSignal: mocks.ingestSignal,
  listReviewQueue: mocks.listReviewQueue,
  listSignals: mocks.listSignals,
  reviewSignal: mocks.reviewSignal,
}));

describe("Intelligence routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIntelligenceOverview.mockResolvedValue({ total: 1 });
    mocks.ingestSignal.mockResolvedValue({ id: "sig-1" });
    mocks.listReviewQueue.mockReturnValue([]);
    mocks.listSignals.mockReturnValue([]);
    mocks.reviewSignal.mockResolvedValue({ id: "sig-1", status: "approved" });

    app = express();
    app.use(express.json());
    app.use("/api/intelligence", createIntelligenceRouter());
  });

  it("clamps list limits and filters statuses", async () => {
    const res = await request(app).get("/api/intelligence/signals?limit=999&status=approved,bad,promoted");

    expect(res.status).toBe(200);
    expect(mocks.listSignals).toHaveBeenCalledWith({
      limit: 100,
      status: ["approved", "promoted"],
    });
  });

  it("validates and normalizes signal ingestion", async () => {
    const invalid = await request(app)
      .post("/api/intelligence/signals")
      .send({ sourceClass: "invalid", source: "x" });
    expect(invalid.status).toBe(400);

    const res = await request(app)
      .post("/api/intelligence/signals")
      .send({
        sourceClass: "technology",
        source: "  web  ",
        title: "  New MCP pattern  ",
        summary: "  Useful update  ",
        biasLabel: "low",
        provenance: "  manual  ",
        stance: "supports",
        confidence: 0.7,
      });

    expect(res.status).toBe(200);
    expect(mocks.ingestSignal).toHaveBeenCalledWith(expect.objectContaining({
      sourceClass: "technology",
      source: "web",
      title: "New MCP pattern",
      summary: "Useful update",
      biasLabel: "low",
      provenance: "manual",
      stance: "supports",
      confidence: 0.7,
    }));
  });

  it("validates confidence and review decisions", async () => {
    const badConfidence = await request(app)
      .post("/api/intelligence/signals")
      .send({
        sourceClass: "technology",
        source: "web",
        title: "Title",
        summary: "Summary",
        biasLabel: "low",
        provenance: "manual",
        confidence: 3,
      });
    expect(badConfidence.status).toBe(400);

    const badReview = await request(app)
      .post("/api/intelligence/review/sig-1")
      .send({ decision: "maybe" });
    expect(badReview.status).toBe(400);

    const review = await request(app)
      .post("/api/intelligence/review/sig-1")
      .send({ decision: " approve ", note: " looks good " });
    expect(review.status).toBe(200);
    expect(mocks.reviewSignal).toHaveBeenCalledWith("sig-1", "approve", "looks good");
  });
});
