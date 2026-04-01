/**
 * Observability MCP Tools
 * Brunella rendszer megfigyelhetőség: agent státuszok, LLM hívások, tool futások, webhook események
 * Lefedi: /api/v1/agents (status), /api/v1/metrics, /api/v1/telemetry, /api/v1/webhooks
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logInfo, logError } from "../utils/logger.js";

const CHAR_LIMIT = 20000;
function truncate(text: string): string {
  return text.length > CHAR_LIMIT ? text.slice(0, CHAR_LIMIT) + "\n…[csonkítva]" : text;
}

export function registerObservabilityTools(server: McpServer): void {

  // ──────────────────────────────────────────
  // AGENT STÁTUSZOK
  // ──────────────────────────────────────────

  server.tool(
    "agent_status_list",
    "Összes Brunella agent futásidejű státuszának lekérése. " +
    "Visszaadja minden agent nevét, aktuális állapotát (idle/working/error), " +
    "sikerességi/hibaszámait és utolsó feladatát.",
    {
      filter_status: z.enum(["idle", "working", "error", "all"]).default("all").optional()
        .describe("Szűrés agent státuszra (alap: all)"),
    },
    async ({ filter_status = "all" }) => {
      try {
        const { agentManager } = await import("../agents/AgentManager.js");
        let statuses = agentManager.listAgentStatuses();
        if (filter_status !== "all") {
          statuses = statuses.filter((s) => s.status === filter_status);
        }
        const summary = {
          total: statuses.length,
          idle: statuses.filter((s) => s.status === "idle").length,
          working: statuses.filter((s) => s.status === "working").length,
          error: statuses.filter((s) => s.status === "error").length,
          agents: statuses,
        };
        logInfo("MCP:observability", `agent_status_list: ${summary.total} agent, ${summary.working} aktív`);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(summary, null, 2)) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `agent_status_list hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "agent_status_get",
    "Egy adott Brunella agent részletes státuszának lekérése névvel. " +
    "Visszaadja a futásidejű állapotot, metrikákat és az utolsó feladat adatait.",
    {
      name: z.string().describe("Az agent neve (pl. 'Developer', 'OrchestratorAgent', 'RobotkezV2')"),
    },
    async ({ name }) => {
      try {
        const { agentManager } = await import("../agents/AgentManager.js");
        const statuses = agentManager.listAgentStatuses();
        const agent = statuses.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (!agent) {
          const available = statuses.map((s) => s.name).join(", ");
          return {
            isError: true,
            content: [{
              type: "text" as const,
              text: `❌ Agent nem található: '${name}'\nElérhető agentok: ${available}`
            }]
          };
        }
        logInfo("MCP:observability", `agent_status_get: ${agent.name} → ${agent.status}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(agent, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `agent_status_get hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "agent_diagnostics",
    "Brunella agent rendszer teljes diagnosztikája. " +
    "Tartalmazza az összes agent összesített metrikáit, a leggyakoribb hibákat, " +
    "a rendszer terhelési adatait és a memória-használatot.",
    {},
    async () => {
      try {
        const { agentManager } = await import("../agents/AgentManager.js");
        const diag = agentManager.getAgentDiagnostics();
        logInfo("MCP:observability", "agent_diagnostics lekérve");
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(diag, null, 2)) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `agent_diagnostics hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // LLM HÍVÁS TELEMETRIA
  // ──────────────────────────────────────────

  server.tool(
    "llm_call_stats",
    "LLM hívások összesített statisztikái. Megmutatja a sikerességi arányt, " +
    "átlagos válaszidőt, token-fogyasztást és cost-ot providerenkénti bontásban. " +
    "Opcionálisan szűrhető időszakra.",
    {
      since: z.string().optional()
        .describe("ISO 8601 dátum, pl. '2024-01-01T00:00:00Z' (opcionális, alap: összes)"),
    },
    async ({ since }) => {
      try {
        const { getLlmCallStats } = await import("../utils/globalDb.js");
        const stats = getLlmCallStats(since);
        logInfo("MCP:observability", `llm_call_stats: ${stats.totalCalls} hívás összesen`);
        return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `llm_call_stats hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "llm_call_query",
    "LLM hívások lekérdezése szűrőkkel. Visszaadja az egyes hívások részleteit: " +
    "provider, modell, token-számok, válaszidő, sikeresség, fallback-ok.",
    {
      provider: z.string().optional()
        .describe("Szűrés providerre (pl. 'ollama', 'gemini', 'github-models', 'anthropic')"),
      since: z.string().optional()
        .describe("ISO 8601 kezdő dátum"),
      until: z.string().optional()
        .describe("ISO 8601 záró dátum"),
      limit: z.number().min(1).max(200).default(50).optional()
        .describe("Maximális sorok száma (alap: 50)"),
      offset: z.number().min(0).default(0).optional()
        .describe("Eltolás lapozáshoz"),
    },
    async ({ provider, since, until, limit = 50, offset = 0 }) => {
      try {
        const { queryLlmCalls } = await import("../utils/globalDb.js");
        const calls = queryLlmCalls({ provider, since, until, limit, offset });
        logInfo("MCP:observability", `llm_call_query: ${calls.length} hívás visszaadva`);
        return {
          content: [{
            type: "text" as const,
            text: truncate(JSON.stringify({ count: calls.length, calls }, null, 2))
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `llm_call_query hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // TOOL FUTÁS STATISZTIKÁK
  // ──────────────────────────────────────────

  server.tool(
    "tool_run_stats",
    "MCP eszközök futtatási statisztikái. Megmutatja az összes tool nevét, " +
    "futásszámát, sikerességi arányát és átlagos futásidejét. " +
    "Hasznos a leghasználtabb/leghibásabb toolok azonosításához.",
    {},
    async () => {
      try {
        const { getToolRunStats } = await import("../utils/globalDb.js");
        const stats = getToolRunStats();
        logInfo("MCP:observability", `tool_run_stats: ${stats.totalRuns} tool futás összesen`);
        return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `tool_run_stats hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "tool_run_query",
    "MCP eszközök futásainak részletes lekérdezése szűrőkkel. " +
    "Visszaadja az egyes futások bemenetét, kimenetét, futásidejét és sikerességét.",
    {
      tool_name: z.string().optional()
        .describe("Szűrés eszköz neve szerint (pl. 'agent_execute', 'task_queue_add')"),
      success: z.boolean().optional()
        .describe("true = csak sikeres, false = csak hibás futások"),
      since: z.string().optional()
        .describe("ISO 8601 kezdő dátum"),
      limit: z.number().min(1).max(200).default(50).optional()
        .describe("Maximális sorok száma (alap: 50)"),
    },
    async ({ tool_name, success, since, limit = 50 }) => {
      try {
        const { queryToolRuns } = await import("../utils/globalDb.js");
        const successNum = success === undefined ? undefined : (success ? 1 : 0);
        const runs = queryToolRuns({ tool_name, success: successNum, since, limit });
        logInfo("MCP:observability", `tool_run_query: ${runs.length} futás visszaadva`);
        return {
          content: [{
            type: "text" as const,
            text: truncate(JSON.stringify({ count: runs.length, runs }, null, 2))
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `tool_run_query hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // WEBHOOK ESEMÉNYEK
  // ──────────────────────────────────────────

  server.tool(
    "webhook_events_list",
    "Bejövő webhook események listázása a Brunella rendszerből. " +
    "Tartalmazza a GitHub push/PR/workflow webhookokat és más integrációs eseményeket. " +
    "Szűrhető provider és feldolgozottsági státusz alapján.",
    {
      provider: z.string().optional()
        .describe("Szűrés providerre (pl. 'github', 'n8n', 'cloudflare')"),
      processed: z.boolean().optional()
        .describe("true = feldolgozott, false = feldolgozatlan, undefined = összes"),
      limit: z.number().min(1).max(100).default(30).optional()
        .describe("Maximális sorok száma (alap: 30)"),
    },
    async ({ provider, processed, limit = 30 }) => {
      try {
        const { getGlobalDb } = await import("../utils/globalDb.js");
        const db = getGlobalDb();
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (provider) { conditions.push("provider = ?"); params.push(provider); }
        if (processed !== undefined) { conditions.push("processed = ?"); params.push(processed ? 1 : 0); }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const events = db.prepare(
          `SELECT * FROM webhook_events ${where} ORDER BY created_at DESC LIMIT ?`
        ).all(...params, limit);
        logInfo("MCP:observability", `webhook_events_list: ${events.length} esemény`);
        return {
          content: [{
            type: "text" as const,
            text: truncate(JSON.stringify({ count: events.length, events }, null, 2))
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `webhook_events_list hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // CEAN FLEET ÁLLAPOT
  // ──────────────────────────────────────────

  server.tool(
    "fleet_status",
    "Cloudflare Edge Agent Network (CEAN) fleet állapotának lekérése. " +
    "Visszaadja az összes flotta és worker aktuális státuszát, " +
    "hibaszámokat és utolsó heartbeat időpontját.",
    {},
    async () => {
      try {
        const { getGlobalDb } = await import("../utils/globalDb.js");
        const db = getGlobalDb();
        const fleets = db.prepare("SELECT * FROM cean_fleets ORDER BY created_at DESC").all();
        const workers = db.prepare("SELECT * FROM cean_workers ORDER BY fleet_id, name").all();
        const result = {
          fleets: fleets.length,
          workers: workers.length,
          active_workers: (workers as Array<{ status: string }>).filter((w) => w.status === "active").length,
          fleets_data: fleets,
          workers_data: workers,
        };
        logInfo("MCP:observability", `fleet_status: ${result.fleets} flotta, ${result.workers} worker`);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:observability", `fleet_status hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );
}
