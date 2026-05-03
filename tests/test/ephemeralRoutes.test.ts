import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createEphemeralRouter } from "@apps/mcp-core/server/routes/ephemeral.js";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  listAgents: vi.fn(),
  getAgent: vi.fn(),
  terminate: vi.fn(),
  executeEphemeralAgent: vi.fn(),
}));

vi.mock("@packages/core-logic/ephemeralAgentManager.js", () => ({
  ephemeralAgentManager: {
    spawn: mocks.spawn,
    listAgents: mocks.listAgents,
    getAgent: mocks.getAgent,
    terminate: mocks.terminate,
  },
}));

vi.mock("@packages/core-logic/ephemeralAgentExecutor.js", () => ({
  executeEphemeralAgent: mocks.executeEphemeralAgent,
}));

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
}));

describe("Ephemeral routes", () => {
  let app: express.Express;

  const spec = {
    parentAgentName: "Orchestrator",
    purpose: "Governance check",
    allowedTools: ["readiness", "mcp"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.spawn.mockResolvedValue({ id: "eph-1", state: "running" });
    mocks.executeEphemeralAgent.mockResolvedValue({ success: true, output: "ok" });
    mocks.listAgents.mockReturnValue([{ id: "eph-1" }]);
    mocks.getAgent.mockReturnValue({ id: "eph-1" });
    mocks.terminate.mockReturnValue({ id: "eph-1", state: "terminated" });

    app = express();
    app.use(express.json());
    app.use("/api/ephemeral", createEphemeralRouter());
  });

  it("validates spawn specs before creating agents", async () => {
    const invalid = await request(app)
      .post("/api/ephemeral/spawn")
      .send({ parentAgentName: "Orchestrator", purpose: "x", allowedTools: "bad" });
    expect(invalid.status).toBe(400);
    expect(mocks.spawn).not.toHaveBeenCalled();

    const valid = await request(app)
      .post("/api/ephemeral/spawn")
      .send({ ...spec, purpose: "  Governance check  ", allowedTools: [" readiness ", 42, "mcp"] });
    expect(valid.status).toBe(201);
    expect(mocks.spawn).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "Governance check",
      allowedTools: ["readiness", "mcp"],
    }));
  });

  it("normalizes execute payloads", async () => {
    const res = await request(app)
      .post("/api/ephemeral/execute")
      .send({ spec, task: "  Run check  ", context: ["bad"] });

    expect(res.status).toBe(200);
    expect(mocks.executeEphemeralAgent).toHaveBeenCalledWith({
      spec,
      task: "Run check",
      context: undefined,
    });
  });

  it("filters list state and trims terminate reasons", async () => {
    const list = await request(app).get("/api/ephemeral?state= running ");
    expect(list.status).toBe(200);
    expect(mocks.listAgents).toHaveBeenCalledWith("running");

    const deleted = await request(app)
      .delete("/api/ephemeral/eph-1")
      .send({ reason: "  done  " });
    expect(deleted.status).toBe(200);
    expect(mocks.terminate).toHaveBeenCalledWith("eph-1", "done");
  });
});
