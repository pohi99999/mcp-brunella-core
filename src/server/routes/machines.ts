/**
 * Machine Hunter API Routes
 * Track: industrial_machine_hunter_20260216 – Phase 3 (Alerting)
 *
 * Endpoints:
 *   POST /api/machines/hunt  – Hunt + valuate + broadcast BUY alerts
 *   GET  /api/machines/ping  – Health check
 *
 * Glass Box: A machine_hunter.py-t hívja, majd BUY eredményeket Socket.IO-n
 * broadcasts `machine_alert` event-ként a dashboardnak.
 */

import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { socketService } from "../SocketService.js";
import { logInfo, logError } from "../../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.resolve(__dirname, "../../../myai/workers/machine_hunter.py");

export interface MachineHuntRequest {
  query: string;
  sources?: string[];
  limit?: number;
  mock?: boolean;
}

export interface ValuationResult {
  listing_id: string;
  title: string;
  price_eur: number;
  estimated_value_eur: number;
  arbitrage_score: number;
  confidence: number;
  recommendation: "BUY" | "WATCH" | "IGNORE";
  reasoning: string;
  discount_pct: number;
}

export interface MachineHuntResult {
  query: string;
  valuations: ValuationResult[];
  top_buys: ValuationResult[];
  total_scraped: number;
  after_filters: number;
  sources_used: string[];
  duration_seconds: number;
  success: boolean;
  error_message?: string;
}

export interface HuntResponse {
  success: boolean;
  query: string;
  total: number;
  buy_count: number;
  results: ValuationResult[];
  top_buys: ValuationResult[];
  broadcast_sent: boolean;
  duration_seconds: number;
}

function runMachineHunter(input: MachineHuntRequest): Promise<MachineHuntResult> {
  return new Promise((resolve, reject) => {
    const args = [
      WORKER_PATH,
      "--query", input.query,
      "--limit", String(input.limit ?? 20),
    ];
    if (input.mock) args.push("--mock");
    if (input.sources?.length) args.push("--sources", ...input.sources);

    const proc = spawn("python", args, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        const errMsg = stderr.slice(0, 500) || `Exit code ${code}`;
        return reject(new Error(errMsg));
      }
      try {
        const trimmed = stdout.trim();
        const parsed = JSON.parse(trimmed) as MachineHuntResult;
        resolve(parsed);
      } catch {
        reject(new Error(`JSON parse error. stdout: ${stdout.slice(0, 300)}`));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}

export function createMachinesRouter(): Router {
  const router = Router();

  /**
   * GET /api/machines/ping
   */
  router.get("/ping", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "machine_hunter", timestamp: Date.now() });
  });

  /**
   * POST /api/machines/hunt
   * Body: { query: string, sources?: string[], limit?: number, mock?: boolean }
   *
   * Runs machine_hunter.py, broadcasts BUY alerts via Socket.IO,
   * returns full valuation list.
   */
  router.post("/hunt", async (req: Request, res: Response) => {
    const body = req.body as Partial<MachineHuntRequest>;

    if (!body.query || typeof body.query !== "string" || !body.query.trim()) {
      res.status(400).json({ success: false, error: "query mező kötelező." });
      return;
    }

    const huntReq: MachineHuntRequest = {
      query: body.query.trim(),
      sources: body.sources,
      limit: typeof body.limit === "number" ? body.limit : 20,
      mock: body.mock ?? false,
    };

    logInfo("MachinesRoute", `Hunt indítva – query="${huntReq.query}" limit=${huntReq.limit} mock=${huntReq.mock}`);

    let huntResult: MachineHuntResult;
    try {
      huntResult = await runMachineHunter(huntReq);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logError("MachinesRoute", `machine_hunter.py hiba: ${errMsg}`);
      res.status(500).json({ success: false, error: errMsg });
      return;
    }

    const buyResults = huntResult.top_buys ?? [];
    const broadcastSent = buyResults.length > 0 && socketService.isReady();

    if (broadcastSent) {
      // 🔔 BUY ajánlások broadcast a dashboardnak (machine_alert event)
      socketService.emit("machine_alert", {
        query: huntReq.query,
        buy_count: buyResults.length,
        alerts: buyResults,
        timestamp: Date.now(),
      });
      logInfo("MachinesRoute", `Socket.IO machine_alert broadcast – ${buyResults.length} BUY ajánlás`);
    }

    const response: HuntResponse = {
      success: true,
      query: huntReq.query,
      total: huntResult.total_scraped,
      buy_count: buyResults.length,
      results: huntResult.valuations,
      top_buys: buyResults,
      broadcast_sent: broadcastSent,
      duration_seconds: huntResult.duration_seconds,
    };

    res.json(response);
  });

  return router;
}
