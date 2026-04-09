import { Router } from "express";

import { logError } from "../../utils/logger.js";
import {
  buildDevExPlannerSnapshot,
  renderDevExPlannerMarkdown,
} from "../../tools/missionPlanner.js";
import {
  isMissionSurface,
  isTestCadenceTier,
  type MissionSurface,
  type TestCadenceTier,
} from "../../tools/devExTypes.js";

function parseSurface(value: unknown): MissionSurface | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  if (!isMissionSurface(value)) {
    throw new Error(`Invalid surface parameter: ${value}`);
  }

  return value;
}

function parseTier(value: unknown): TestCadenceTier | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  if (!isTestCadenceTier(value)) {
    throw new Error(`Invalid tier parameter: ${value}`);
  }

  return value;
}

export function createDevExRouter(): Router {
  const router = Router();

  router.get("/planner", (req, res) => {
    try {
      const templateId = typeof req.query.templateId === "string" ? req.query.templateId : undefined;
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
