import { Router } from "express";

import { logError } from "@packages/utils/logger.js";
import {
  buildDevExPlannerSnapshot,
  renderDevExPlannerMarkdown,
} from "@packages/utils/missionPlanner.js";
import {
  isMissionSurface,
  isTestCadenceTier,
  type MissionSurface,
  type TestCadenceTier,
} from "@packages/utils/devExTypes.js";

function parseSurface(value: unknown): MissionSurface | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const normalized = value.trim();
  if (!isMissionSurface(normalized)) {
    throw new Error(`Invalid surface parameter: ${normalized}`);
  }

  return normalized;
}

function parseTier(value: unknown): TestCadenceTier | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const normalized = value.trim();
  if (!isTestCadenceTier(normalized)) {
    throw new Error(`Invalid tier parameter: ${normalized}`);
  }

  return normalized;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function createDevExRouter(): Router {
  const router = Router();

  router.get("/planner", (req, res) => {
    try {
      const templateId = readString(req.query.templateId);
      const surface = parseSurface(req.query.surface);
      const tier = parseTier(req.query.tier);

      const snapshot = buildDevExPlannerSnapshot({
        templateId,
        surface,
        tier,
      });

      res.json({
        success: true,
        snapshot,
        markdown: renderDevExPlannerMarkdown(snapshot),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError("DevExRoute", `GET /planner failed: ${message}`);
      res.status(400).json({ success: false, error: message });
    }
  });

  return router;
}
