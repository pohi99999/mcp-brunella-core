import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createDevExRouter } from "@apps/mcp-core/server/routes/devex.js";

vi.mock("@packages/utils/logger.js", () => ({
  logError: vi.fn(),
}));

describe("devex routes", () => {
  it("returns the planner snapshot and markdown", async () => {
    const app = express();
    app.use("/api/v1/devex", createDevExRouter());

    const response = await request(app).get(
      "/api/v1/devex/planner?templateId=docs-config&surface=docs&tier=recommended",
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.snapshot.selectedTemplate.id).toBe("docs-config");
    expect(response.body.markdown).toContain("# Mission Planner");
    expect(response.body.markdown).toContain("# Test Cadence Advisor");
  });

  it("returns a 400 for an invalid surface value", async () => {
    const app = express();
    app.use("/api/v1/devex", createDevExRouter());

    const response = await request(app).get("/api/v1/devex/planner?surface=bogus");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("Invalid surface parameter");
  });

  it("returns a 400 for an invalid tier value", async () => {
    const app = express();
    app.use("/api/v1/devex", createDevExRouter());

    const response = await request(app).get("/api/v1/devex/planner?tier=super-full");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("Invalid tier parameter");
  });
});
