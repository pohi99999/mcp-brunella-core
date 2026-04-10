import { Router } from "express";
import { globalChaosInjector } from "../../utils/chaos_injector.js";

export function createChaosRouter(): Router {
  const router = Router();

  /**
   * @swagger
   * /api/chaos/status:
   *   get:
   *     summary: Lekéri a Chaos Mode aktuális állapotát.
   *     tags: [Chaos]
   */
  router.get("/status", (_req, res) => {
    res.json({
      enabled: process.env.CHAOS_MODE === "true",
      probability: parseFloat(process.env.CHAOS_PROBABILITY || "0.1"),
      types: (process.env.CHAOS_TYPES || "timeout,rate_limit,corruption").split(","),
      maxDelayMs: parseInt(process.env.CHAOS_MAX_DELAY || "5000"),
    });
  });

  /**
   * @swagger
   * /api/chaos/toggle:
   *   post:
   *     summary: Be/ki kapcsolja a Chaos Mode-ot és konfigurálja azt.
   *     tags: [Chaos]
   */
  router.post("/toggle", (req, res) => {
    const { enabled, probability, types, maxDelayMs } = req.body;

    if (enabled !== undefined) {
      process.env.CHAOS_MODE = enabled ? "true" : "false";
    }
    if (probability !== undefined) {
      process.env.CHAOS_PROBABILITY = String(probability);
    }
    if (types !== undefined && Array.isArray(types)) {
      process.env.CHAOS_TYPES = types.join(",");
    }
    if (maxDelayMs !== undefined) {
      process.env.CHAOS_MAX_DELAY = String(maxDelayMs);
    }

    res.json({
      success: true,
      status: {
        enabled: process.env.CHAOS_MODE === "true",
        probability: parseFloat(process.env.CHAOS_PROBABILITY || "0.1"),
        types: (process.env.CHAOS_TYPES || "timeout,rate_limit,corruption").split(","),
        maxDelayMs: parseInt(process.env.CHAOS_MAX_DELAY || "5000"),
      }
    });
  });

  return router;
}
