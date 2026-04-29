import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createCopilotBridgeRoutes } from "@apps/mcp-core/server/routes/copilotBridge.js";

vi.mock("@packages/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

describe("CopilotBridge routes", () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/copilot-bridge", createCopilotBridgeRoutes());
    // Clear singleton state before each test
    await request(app).delete("/api/copilot-bridge/clear");
  });

  // ── GET /stats ────────────────────────────────────────────────
  describe("GET /stats", () => {
    it("should return initial stats with 0 commands", async () => {
      const res = await request(app).get("/api/copilot-bridge/stats");
      expect(res.status).toBe(200);
      expect(res.body.totalCommands).toBe(0);
      expect(res.body.successCount).toBe(0);
      expect(res.body.errorCount).toBe(0);
      expect(res.body.lastCommandAt).toBeNull();
      expect(res.body.activeDispatches).toBe(0);
      expect(res.body.uptimeSince).toBeDefined();
    });

    it("should reflect correct counts after operations", async () => {
      // Add two commands (default status: running)
      await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "agent", action: "run" });
      const cmd2 = await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "agent", action: "stop" });
      // Mark second command as success
      await request(app)
        .patch(`/api/copilot-bridge/commands/${cmd2.body.id}`)
        .send({ status: "success" });
      // Add a dispatch (default status: queued → active)
      await request(app)
        .post("/api/copilot-bridge/dispatches")
        .send({ agentName: "TestAgent", task: "do stuff" });

      const res = await request(app).get("/api/copilot-bridge/stats");
      expect(res.status).toBe(200);
      expect(res.body.totalCommands).toBe(2);
      expect(res.body.successCount).toBe(1);
      expect(res.body.activeDispatches).toBe(1);
      expect(res.body.lastCommandAt).toBeDefined();
    });
  });

  // ── POST /commands ────────────────────────────────────────────
  describe("POST /commands", () => {
    it("should create a command with generated id and timestamp", async () => {
      const res = await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "cli", action: "build", params: { target: "all" } });
      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^cmd-/);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.domain).toBe("cli");
      expect(res.body.action).toBe("build");
      expect(res.body.params).toEqual({ target: "all" });
      expect(res.body.status).toBe("running");
    });

    it("should return 400 when domain is missing", async () => {
      const res = await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ action: "build" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/domain/i);
    });

    it("should return 400 when action is missing", async () => {
      const res = await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "cli" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/action/i);
    });
  });

  // ── GET /commands ─────────────────────────────────────────────
  describe("GET /commands", () => {
    it("should return posted commands in reverse chronological order", async () => {
      await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "a", action: "first" });
      await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "b", action: "second" });

      const res = await request(app).get("/api/copilot-bridge/commands");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      // Most recent first (unshift in state)
      expect(res.body[0].action).toBe("second");
      expect(res.body[1].action).toBe("first");
    });

    it("should respect the limit query parameter", async () => {
      await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "a", action: "one" });
      await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "b", action: "two" });
      await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "c", action: "three" });

      const res = await request(app).get("/api/copilot-bridge/commands?limit=1");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].action).toBe("three");
    });
  });

  // ── PATCH /commands/:id ───────────────────────────────────────
  describe("PATCH /commands/:id", () => {
    it("should update an existing command status", async () => {
      const created = await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "cli", action: "deploy" });
      const id = created.body.id;

      const res = await request(app)
        .patch(`/api/copilot-bridge/commands/${id}`)
        .send({ status: "success", durationMs: 1234 });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.status).toBe("success");
      expect(res.body.durationMs).toBe(1234);
    });

    it("should return 404 for a nonexistent command id", async () => {
      const res = await request(app)
        .patch("/api/copilot-bridge/commands/cmd-nonexistent-999")
        .send({ status: "error" });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // ── POST /dispatches ──────────────────────────────────────────
  describe("POST /dispatches", () => {
    it("should create a dispatch with generated id and timestamp", async () => {
      const res = await request(app)
        .post("/api/copilot-bridge/dispatches")
        .send({ agentName: "ResearcherAgent", task: "find info" });
      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^dsp-/);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.agentName).toBe("ResearcherAgent");
      expect(res.body.task).toBe("find info");
      expect(res.body.status).toBe("queued");
    });

    it("should return 400 when agentName is missing", async () => {
      const res = await request(app)
        .post("/api/copilot-bridge/dispatches")
        .send({ task: "do something" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/agentName/i);
    });

    it("should return 400 when task is missing", async () => {
      const res = await request(app)
        .post("/api/copilot-bridge/dispatches")
        .send({ agentName: "TestAgent" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/task/i);
    });
  });

  // ── GET /dispatches ───────────────────────────────────────────
  describe("GET /dispatches", () => {
    it("should return posted dispatches", async () => {
      await request(app)
        .post("/api/copilot-bridge/dispatches")
        .send({ agentName: "AgentA", task: "task1" });
      await request(app)
        .post("/api/copilot-bridge/dispatches")
        .send({ agentName: "AgentB", task: "task2" });

      const res = await request(app).get("/api/copilot-bridge/dispatches");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].agentName).toBe("AgentB");
      expect(res.body[1].agentName).toBe("AgentA");
    });
  });

  // ── DELETE /clear ─────────────────────────────────────────────
  describe("DELETE /clear", () => {
    it("should clear all state and reset stats to 0", async () => {
      // Populate state
      await request(app)
        .post("/api/copilot-bridge/commands")
        .send({ domain: "x", action: "y" });
      await request(app)
        .post("/api/copilot-bridge/dispatches")
        .send({ agentName: "A", task: "t" });

      const clearRes = await request(app).delete("/api/copilot-bridge/clear");
      expect(clearRes.status).toBe(200);
      expect(clearRes.body).toEqual({
        success: true,
        message: "Bridge state cleared",
      });

      // Verify everything is empty
      const stats = await request(app).get("/api/copilot-bridge/stats");
      expect(stats.body.totalCommands).toBe(0);
      expect(stats.body.activeDispatches).toBe(0);

      const cmds = await request(app).get("/api/copilot-bridge/commands");
      expect(cmds.body).toHaveLength(0);

      const dsps = await request(app).get("/api/copilot-bridge/dispatches");
      expect(dsps.body).toHaveLength(0);
    });
  });
});
