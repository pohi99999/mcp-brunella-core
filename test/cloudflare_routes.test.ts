import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createCloudflareRoutes } from "../src/server/routes/cloudflare.js";

vi.mock("../src/agents/AgentManager.js", () => ({
  agentManager: {
    getEdgeStatus: vi.fn().mockReturnValue({
      enabled: false,
      healthy: false,
      tunnelConnected: false,
    }),
  },
}));

vi.mock("../src/utils/cloudflareClient.js", () => ({
  cloudflareClient: {
    submitTask: vi.fn(),
    checkStatus: vi.fn(),
  },
}));

describe("Cloudflare routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.restoreAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api/cloudflare", createCloudflareRoutes());
  });

  it("GET /api/cloudflare/status returns edge status", async () => {
    const res = await request(app).get("/api/cloudflare/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it("POST /api/cloudflare/task returns 503 when edge disabled", async () => {
    const res = await request(app)
      .post("/api/cloudflare/task")
      .send({ instruction: "hello" });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/Edge disabled/i);
  });

  it("GET /api/cloudflare/status/:taskId returns 503 when edge disabled", async () => {
    const res = await request(app).get("/api/cloudflare/status/abc");
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/Edge disabled/i);
  });

  it("POST /api/cloudflare/chat proxies message and returns assistant text", async () => {
    vi.stubEnv(
      "CLOUDFLARE_CHAT_URL",
      "https://llm-chat-app-template.iam-dd1.workers.dev",
    );

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: "Szia! Cloudflare chat válasz." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const res = await request(app)
      .post("/api/cloudflare/chat")
      .send({ instruction: "Szia", history: [] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("Cloudflare");
    expect(fetchMock).toHaveBeenCalled();

    vi.unstubAllEnvs();
  });

  it("POST /api/cloudflare/chat returns 400 for missing instruction", async () => {
    const res = await request(app)
      .post("/api/cloudflare/chat")
      .send({ history: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/instruction is required/i);
  });

  describe("Edge enabled scenarios", () => {
    beforeEach(async () => {
      // Mock Edge as enabled for this test suite
      const { agentManager } = vi.mocked(
        await import("../src/agents/AgentManager.js"),
      );
      vi.mocked(agentManager.getEdgeStatus).mockReturnValue({
        enabled: true,
        healthy: true,
        tunnelConnected: false,
      });
    });

    it("POST /api/cloudflare/task submits task when edge enabled", async () => {
      const { cloudflareClient } = vi.mocked(
        await import("../src/utils/cloudflareClient.js"),
      );
      vi.mocked(cloudflareClient.submitTask).mockResolvedValueOnce({
        success: true,
        taskId: "task_123",
        type: "code_generation",
        message: "Task submitted successfully",
      });

      const res = await request(app)
        .post("/api/cloudflare/task")
        .send({
          instruction: "Generate Python code",
          context: { language: "python" },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.taskId).toBe("task_123");
      expect(cloudflareClient.submitTask).toHaveBeenCalledWith(
        "Generate Python code",
        { language: "python" },
      );
    });

    it("GET /api/cloudflare/status/:taskId returns task status when edge enabled", async () => {
      const { cloudflareClient } = vi.mocked(
        await import("../src/utils/cloudflareClient.js"),
      );
      vi.mocked(cloudflareClient.checkStatus).mockResolvedValueOnce({
        taskId: "task_123",
        status: "completed",
        result: { code: "print('Hello')" },
      });

      const res = await request(app).get("/api/cloudflare/status/task_123");

      expect(res.status).toBe(200);
      expect(res.body.taskId).toBe("task_123");
      expect(res.body.status).toBe("completed");
      expect(cloudflareClient.checkStatus).toHaveBeenCalledWith("task_123");
    });

    it("POST /api/cloudflare/task returns 400 for missing instruction", async () => {
      const res = await request(app)
        .post("/api/cloudflare/task")
        .send({ context: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/instruction is required/i);
    });

    it("POST /api/cloudflare/task handles worker error gracefully", async () => {
      const { cloudflareClient } = vi.mocked(
        await import("../src/utils/cloudflareClient.js"),
      );
      vi.mocked(cloudflareClient.submitTask).mockRejectedValueOnce(
        new Error("Worker timeout"),
      );

      const res = await request(app)
        .post("/api/cloudflare/task")
        .send({ instruction: "Generate code" });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/Worker timeout/i);
    });
  });
});
