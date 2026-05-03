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
} from "@packages/utils/memoryTool.js";
import { logInfo, logError } from "@packages/utils/logger.js";
import { socketService } from "@packages/agents/SocketService.js";

const MEMORY_TYPES = new Set(["episodic", "semantic", "procedural"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readMemoryType(value: unknown): string | undefined {
  const memoryType = readString(value)?.toLowerCase();
  return memoryType && MEMORY_TYPES.has(memoryType) ? memoryType : undefined;
}

function readLimit(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value.trim(), 10) : undefined;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function readTtlDays(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value.trim(), 10) : undefined;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(Math.trunc(parsed), 1), 3650);
}

function getUserId(value: unknown): string | undefined {
  return readString(value);
}

export function createPreferencesRouter(): Router {
  const router = Router();

  // GET /api/preferences/stats/:userId — Statisztikák
  router.get("/stats/:userId", async (req, res) => {
    try {
      const userId = getUserId(req.params.userId);
      if (!userId) {
        res.status(400).json({ success: false, error: "userId megadása kötelező" });
        return;
      }
      const result = await memoryContextHandler({ user_id: userId });
      socketService.emit("preferences:stats", { userId, stats: (result as Record<string, unknown>)?.stats, timestamp: Date.now() });
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
      const userId = getUserId(req.params.userId);
      if (!userId) {
        res.status(400).json({ success: false, error: "userId megadása kötelező" });
        return;
      }
      const result = await memoryContextHandler({ user_id: userId });
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
      const userId = getUserId(req.params.userId);
      if (!userId) {
        res.status(400).json({ success: false, error: "userId megadása kötelező" });
        return;
      }
      const memory_type = readMemoryType(req.query.memory_type);
      const key_pattern = readString(req.query.key_pattern);
      const limit = readLimit(req.query.limit);

      logInfo("preferences-route", `Query preferences for user ${userId}`);
      const result = await memoryQueryHandler({
        user_id: userId,
        memory_type,
        key_pattern,
        limit,
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
      const body = isRecord(req.body) ? req.body : {};
      const user_id = readString(body.user_id) ?? "default";
      const key = readString(body.key);
      const value = readString(body.value);
      const memory_type = readMemoryType(body.memory_type);
      const ttl_days = readTtlDays(body.ttl_days);

      if (!key || !value) {
        res.status(400).json({ success: false, error: "key és value megadása kötelező" });
        return;
      }

      logInfo("preferences-route", `Store preference: ${key}`);
      const result = await memoryStoreHandler({
        user_id,
        key,
        value,
        memory_type,
        ttl_days,
      });
      const isUpdate = (result as Record<string, unknown>)?.updated === true;
      socketService.emit("preferences:change", {
        userId: user_id,
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
      const userId = getUserId(req.params.userId);
      const key = readString(req.params.key);
      if (!userId || !key) {
        res.status(400).json({ success: false, error: "userId és key megadása kötelező" });
        return;
      }
      const memory_type = readMemoryType(req.query.memory_type);
      logInfo("preferences-route", `Delete preference: ${key} for ${userId}`);
      const result = await memoryDeleteHandler({
        user_id: userId,
        key,
        memory_type,
      });
      socketService.emit("preferences:change", {
        userId,
        action: "delete",
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
