import { Router } from "express";
import { globalChaosInjector, type ChaosConfig } from "@packages/utils/chaos_injector.js";

const CHAOS_TYPES = new Set<ChaosConfig["types"][number]>([
  "timeout",
  "rate_limit",
  "corruption",
]);

function parseChaosConfig(value: unknown): Partial<ChaosConfig> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const config: Partial<ChaosConfig> = {};

  if (typeof record.enabled === "boolean") {
    config.enabled = record.enabled;
  }
  if (typeof record.probability === "number" && Number.isFinite(record.probability)) {
    config.probability = record.probability;
  }
  if (typeof record.maxDelayMs === "number" && Number.isFinite(record.maxDelayMs)) {
    config.maxDelayMs = record.maxDelayMs;
  }
  if (Array.isArray(record.types)) {
    const types = record.types.filter(
      (type): type is ChaosConfig["types"][number] =>
        typeof type === "string" && CHAOS_TYPES.has(type as ChaosConfig["types"][number]),
    );
    if (types.length > 0) {
      config.types = types;
    }
  }

  return config;
}

export function createChaosRoutes(): Router {
  const router = Router();

  router.get("/status", (_req, res) => {
    res.json(globalChaosInjector.getConfig());
  });

  router.post("/toggle", (req, res) => {
    const status = globalChaosInjector.updateConfig(parseChaosConfig(req.body));
    res.json({ success: true, status });
  });

  return router;
}
