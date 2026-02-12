import { Router } from "express";
import { agentManager } from "../../agents/AgentManager.js";
import { cloudflareClient } from "../../utils/cloudflareClient.js";

export function createCloudflareRoutes(): Router {
  const router = Router();

  router.get("/status", (_req, res) => {
    try {
      const status = agentManager.getEdgeStatus();
      res.json({ status });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/task", async (req, res) => {
    try {
      const edgeStatus = agentManager.getEdgeStatus();
      if (!edgeStatus.enabled) {
        res.status(503).json({ error: "Edge disabled (set EDGE_ENABLED=true)" });
        return;
      }

      const instruction = typeof req.body?.instruction === "string" ? req.body.instruction.trim() : "";
      const context = (req.body?.context ?? {}) as Record<string, unknown>;

      if (!instruction) {
        res.status(400).json({ error: "instruction is required" });
        return;
      }

      const result = await cloudflareClient.submitTask(instruction, context);
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.get("/status/:taskId", async (req, res) => {
    try {
      const edgeStatus = agentManager.getEdgeStatus();
      if (!edgeStatus.enabled) {
        res.status(503).json({ error: "Edge disabled (set EDGE_ENABLED=true)" });
        return;
      }

      const taskId = String(req.params.taskId || "").trim();
      if (!taskId) {
        res.status(400).json({ error: "taskId is required" });
        return;
      }

      const data = await cloudflareClient.checkStatus(taskId);
      res.json(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
