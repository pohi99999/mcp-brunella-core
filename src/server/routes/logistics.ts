import { Router, type Request, type Response } from "express";
import { agentManager } from "../../agents/AgentManager.js";
import { ensureError } from "../../utils/ensureError.js";
import { logError } from "../../utils/logger.js";

interface LogisticsAgentSummary {
  name: string;
  role: string;
  description: string;
  registered: boolean;
  capabilities: string[];
}

interface LogisticsRouteStatus {
  status: "success";
  scope: "repository-local";
  blockedByExternalFrontend: boolean;
  currentTrackId: string;
  currentTrackStatus: string;
  followUpTrackId: string;
  logisticsAgent: LogisticsAgentSummary;
  availablePublicSurfaces: string[];
}

const CURRENT_TRACK_ID = "logistics_vertical_20260222";
const FOLLOW_UP_TRACK_ID = "logistics_vertical_repo_local_20260407";
const LOGISTICS_CAPABILITIES = [
  "shipment_tracking",
  "route_optimization",
  "proactive_notifications",
  "carrier_coordination",
  "delivery_scheduling",
] as const;

function buildStatus(): LogisticsRouteStatus {
  const definitions = agentManager.listAgentDefinitions();
  const logisticsAgent = definitions.find(
    (agent) => agent.name === "LogisticsDispatcher" || agent.name === "LogisticsDispatcherAgent",
  );

  return {
    status: "success",
    scope: "repository-local",
    blockedByExternalFrontend: true,
    currentTrackId: CURRENT_TRACK_ID,
    currentTrackStatus: "archived",
    followUpTrackId: FOLLOW_UP_TRACK_ID,
    logisticsAgent: {
      name: logisticsAgent?.name ?? "LogisticsDispatcher",
      role: logisticsAgent?.role ?? "Supply Chain & Logistics",
      description: logisticsAgent?.description ?? "Shipment tracking and complaint management",
      registered: Boolean(logisticsAgent),
      capabilities: [...LOGISTICS_CAPABILITIES],
    },
    availablePublicSurfaces: [
      "/api/enterprise/modules",
      "/api/enterprise/stats",
      "/api/enterprise/execute",
    ],
  };
}

/**
 * Create the repository-local logistics router.
 *
 * The router intentionally exposes only read-only capability and boundary
 * information. Full timber B2B matchmaking remains a separate follow-up track.
 */
export function createLogisticsRoutes(): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    res.json(buildStatus());
  });

  router.get("/status", (_req: Request, res: Response) => {
    res.json(buildStatus());
  });

  router.get("/capabilities", (_req: Request, res: Response) => {
    const status = buildStatus();
    res.json({
      status: status.status,
      scope: status.scope,
      capabilities: status.logisticsAgent.capabilities,
      currentTrackId: status.currentTrackId,
      followUpTrackId: status.followUpTrackId,
    });
  });

  router.get("/track-split", (_req: Request, res: Response) => {
    res.json({
      currentTrackId: CURRENT_TRACK_ID,
      currentTrackStatus: "archived",
      followUpTrackId: FOLLOW_UP_TRACK_ID,
      blocker: "PohiAIProt2 frontend repository is outside this workspace",
    });
  });

  router.use((error: unknown, _req: Request, res: Response, _next: () => void) => {
    const normalized = ensureError(error);
    logError("LogisticsRoutes", `Repository-local logistics route failed: ${normalized.message}`);
    res.status(500).json({ status: "error", error: normalized.message });
  });

  return router;
}

export default createLogisticsRoutes;
