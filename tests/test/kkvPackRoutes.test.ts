import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createKkvPackRoutes } from "@apps/mcp-core/server/routes/kkvPack.js";

vi.mock("@packages/utils/logger.js", () => ({
  logError: vi.fn(),
}));

describe("kkv pack routes", () => {
  it("returns the combined snapshot and markdown", async () => {
    const app = express();
    app.use("/api/v1/kkv-pack", createKkvPackRoutes());

    const response = await request(app).get("/api/v1/kkv-pack/snapshot?pack=%20inventory-core%20");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.snapshot.selectedPackId).toBe("inventory-core");
    expect(response.body.markdown).toContain("Inventory Core Pack");
    expect(response.body.briefMarkdown).toContain("Guardrail");
  });

  it("returns the brief view for logistics", async () => {
    const app = express();
    app.use("/api/v1/kkv-pack", createKkvPackRoutes());

    const response = await request(app).get("/api/v1/kkv-pack/brief?pack=logistics-core");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.snapshot.selectedPackId).toBe("logistics-core");
    expect(response.body.briefMarkdown).toContain("Logistics Core Pack");
  });

  it("rejects invalid pack ids", async () => {
    const app = express();
    app.use("/api/v1/kkv-pack", createKkvPackRoutes());

    const response = await request(app).get("/api/v1/kkv-pack/snapshot?pack=missing-pack");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("Invalid pack parameter");
  });
});
