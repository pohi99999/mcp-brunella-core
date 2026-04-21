/**
 * User Preferences REST API Routes — Dashboard és CLI számára
 *
 * GET    /api/preferences/stats/:userId   — Felhasználó preferencia statisztikái
 * GET    /api/preferences/context/:userId — Felhasználó kontextus (LLM-hez)
 * GET    /api/preferences/:userId         — Preferenciák lekérdezése (szűrőkkel)
 * POST   /api/preferences                 — Preferencia mentése
 * DELETE /api/preferences/:userId/:key    — Preferencia törlése
 * POST   /api/preferences/purge           — Lejárt preferenciák törlése
 */

import { Router } from "express";
import {
  memoryStoreHandler,
  memoryQueryHandler,
  memoryContextHandler,
  memoryDeleteHandler,
  memoryPurgeHandler,
} from "../../tools/memoryTool.js";
import { logInfo, logError } from "../../utils/logger.js";
import { socketService } from "@packages/agents/SocketService.js";

export function createPreferencesRouter(): Router {
  const router = Router();

  // GET /api/preferences/stats/:userId — Statisztikák
  router.get("/stats/:userId", async (req, res) => {
    try {
      const result = await memoryContextHandler({ user_id: req.params.userId });
      socketService.emit("preferences:stats", { userId: req.params.userId, stats: (result as Record<string, unknown>)?.stats, timestamp: Date.now() });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("preferences-route", msg);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // GET /api/preferences/context/:userId — LLM kontextus lekérdezés
  router.get("/context/:userId", async (req, res) => {
    try {
      const result = await memoryContextHandler({ user_id: req.params.userId });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("preferences-route", msg);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // GET /api/preferences/:userId — Preferenciák listázása
  router.get("/:userId", async (req, res) => {
    try {
      const { memory_type, key_pattern, limit } = req.query as {
        memory_type?: string;
        key_pattern?: string;
        limit?: string;
      };

      logInfo("preferences-route", `Query preferences for user ${req.params.userId}`);
      const result = await memoryQueryHandler({
        user_id: req.params.userId,
        memory_type,
        key_pattern,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("preferences-route", msg);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // POST /api/preferences — Preferencia mentése
  router.post("/", async (req, res) => {
    try {
      const { user_id, key, value, memory_type, ttl_days } = req.body as {
        user_id?: string;
        key?: string;
        value?: string;
        memory_type?: string;
        ttl_days?: number;
      };

      if (!key || !value) {
        res.status(400).json({ success: false, error: "key és value megadása kötelező" });
        return;
      }

      logInfo("preferences-route", `Store preference: ${key}`);
      const result = await memoryStoreHandler({
        user_id: user_id || "default",
        key,
        value,
        memory_type,
        ttl_days,
      });
      const isUpdate = (result as Record<string, unknown>)?.updated === true;
      socketService.emit("preferences:change", {
        userId: user_id || "default",
        action: isUpdate ? "update" : "create",
        key,
        timestamp: Date.now(),
      });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("preferences-route", msg);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // DELETE /api/preferences/:userId/:key — Preferencia törlése
  router.delete("/:userId/:key", async (req, res) => {
    try {
      const { memory_type } = req.query as { memory_type?: string };
      logInfo("preferences-route", `Delete preference: ${req.params.key} for ${req.params.userId}`);
      const result = await memoryDeleteHandler({
        user_id: req.params.userId,
        key: req.params.key,
        memory_type,
      });
      socketService.emit("preferences:change", {
        userId: req.params.userId,
        action: "delete",
        key: req.params.key,
        timestamp: Date.now(),
      });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("preferences-route", msg);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // POST /api/preferences/purge — Lejárt preferenciák törlése
  router.post("/purge", async (_req, res) => {
    try {
      const result = await memoryPurgeHandler({} as Record<string, never>);
      socketService.emit("preferences:change", {
        userId: "system",
        action: "purge",
        key: "*expired*",
        timestamp: Date.now(),
      });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("preferences-route", msg);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
