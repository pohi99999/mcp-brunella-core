import { Router, type Request, type Response } from "express";

import {
  buildKkvPackResponse,
  isKkvPackId,
  type KkvPackResponse,
} from "@packages/utils/kkvPack.js";
import { logError } from "@packages/utils/logger.js";

function readPackId(queryValue: unknown): string | undefined {
  if (typeof queryValue !== "string") return undefined;
  const trimmed = queryValue.trim();
  return trimmed ? trimmed : undefined;
}

function sendPackResponse(req: Request, res: Response): void {
  try {
    const packId = readPackId(req.query.pack);
    if (packId && !isKkvPackId(packId)) {
      res.status(400).json({ success: false, error: "Invalid pack parameter" });
      return;
    }

    const response: KkvPackResponse = buildKkvPackResponse({ packId });
    res.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError("KkvPackRoute", `KKV pack response failed: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
}

export function createKkvPackRoutes(): Router {
  const router = Router();

  router.get("/", sendPackResponse);
  router.get("/snapshot", sendPackResponse);
  router.get("/brief", sendPackResponse);
  router.get("/markdown", sendPackResponse);

  return router;
}
