/**
 * Task Management MCP Tools
 * Feladatsor kezelés, ütemezett feladatok és workflow orchestráció
 * Lefedi: /api/v1/tasks, /api/v1/scheduled-tasks, /api/v1/workflow
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logInfo, logError } from "../utils/logger.js";

const CHAR_LIMIT = 20000;
function truncate(text: string): string {
  return text.length > CHAR_LIMIT ? text.slice(0, CHAR_LIMIT) + "\n…[csonkítva]" : text;
}

export function registerTaskManagementTools(server: McpServer): void {

  // ──────────────────────────────────────────
  // FELADATSOR (tasks.db)
  // ──────────────────────────────────────────

  server.tool(
    "task_queue_list",
    "Brunella feladatsor listázása. Szűrés státusz, limit és offset alapján. " +
    "Visszaadja az agenthez rendelt feladatokat, azok státuszát és eredményeit.",
    {
      limit: z.number().min(1).max(100).default(20).optional()
        .describe("Maximális sorok száma (1-100, alap: 20)"),
      offset: z.number().min(0).default(0).optional()
        .describe("Eltolás lapozáshoz"),
      status: z.enum(["pending", "running", "done", "error", "cancelled"]).optional()
        .describe("Szűrés státuszra (pending/running/done/error/cancelled)"),
    },
    async ({ limit = 20, offset = 0, status }) => {
      try {
        const { getTasks, getTaskCount } = await import("../utils/tasksDb.js");
        const tasks = await getTasks(limit, offset, status);
        const total = await getTaskCount(status);
        logInfo("MCP:taskManagement", `task_queue_list: ${tasks.length}/${total} feladat`);
        const result = { tasks, total, limit, offset, statusFilter: status ?? "all" };
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `task_queue_list hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "task_queue_stats",
    "Brunella feladatsor statisztikái. Megmutatja az összes feladat összesített adatait: " +
    "sikerességi arány, átlagos futásidő, hibák agentenkénti bontásban.",
    {},
    async () => {
      try {
        const { getTaskStats } = await import("../utils/tasksDb.js");
        const stats = await getTaskStats();
        logInfo("MCP:taskManagement", "task_queue_stats lekérve");
        return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `task_queue_stats hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "task_queue_get",
    "Egy adott Brunella feladat részleteinek lekérése azonosító alapján. " +
    "Visszaadja a feladat státuszát, eredményét és kontextusát.",
    {
      id: z.number().describe("A feladat számazonosítója"),
    },
    async ({ id }) => {
      try {
        const { getTaskById } = await import("../utils/tasksDb.js");
        const task = await getTaskById(id);
        if (!task) {
          return { isError: true, content: [{ type: "text" as const, text: `❌ Feladat nem található: ${id}` }] };
        }
        logInfo("MCP:taskManagement", `task_queue_get: feladat #${id} lekérve`);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(task, null, 2)) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `task_queue_get hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "task_queue_add",
    "Új feladat hozzáadása a Brunella feladatsorhoz. " +
    "A feladat az agentManager-en keresztül kerül végrehajtásra. " +
    "Visszaadja az új feladat azonosítóját.",
    {
      agent: z.string().describe("Az agent neve (pl. 'Developer', 'Researcher', 'OrchestratorAgent')"),
      task: z.string().describe("A feladat szöveges leírása"),
      context: z.string().optional().describe("Opcionális JSON kontextus string"),
    },
    async ({ agent, task, context }) => {
      try {
        const { agentManager } = await import("../agents/AgentManager.js");
        let parsedContext: Record<string, unknown> | undefined;

        if (context) {
          const value = JSON.parse(context) as unknown;
          if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: "❌ Hiba: a context JSON objektum kell legyen." }],
            };
          }
          parsedContext = value as Record<string, unknown>;
        }

        const id = await agentManager.queueTask(task, agent, parsedContext);
        logInfo("MCP:taskManagement", `task_queue_add: feladat hozzáadva #${id} → ${agent}`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, taskId: id, agent, status: "pending" }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `task_queue_add hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // WORKFLOW ORCHESTRÁCIÓ
  // ──────────────────────────────────────────

  server.tool(
    "task_workflow_preview",
    "Feladat dekompozíció előnézete DAG-ként (irányított aciklikus gráf). " +
    "Megmutatja, hogyan bontaná fel a TaskDecomposer az adott feladatot részfeladatokra, " +
    "végrehajtás nélkül. Hasznos tervezéshez és áttekintéshez.",
    {
      task: z.string().describe("A dekompozálandó feladat leírása"),
      defaultAgent: z.string().optional().describe("Alapértelmezett agent ha nincs explicit hozzárendelés"),
    },
    async ({ task, defaultAgent }) => {
      try {
        const { decomposeToDAGAsync } = await import("../agents/taskDecomposerCore.js");
        const workflow = await decomposeToDAGAsync(task, { defaultAgent });
        logInfo("MCP:taskManagement", `task_workflow_preview: ${task.slice(0, 60)}`);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(workflow, null, 2)) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `task_workflow_preview hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "task_workflow_status",
    "Futó workflow végrehajtások listázása. Megmutatja az aktuálisan aktív, " +
    "várakozó és nemrég befejezett workflow-kat az agentManager-ben.",
    {},
    async () => {
      try {
        const { agentManager } = await import("../agents/AgentManager.js");
        const executions = agentManager.listWorkflowExecutions();
        logInfo("MCP:taskManagement", `task_workflow_status: ${executions.length} execution`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ count: executions.length, executions }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `task_workflow_status hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // ÜTEMEZETT FELADATOK (brunella.db → scheduled_tasks)
  // ──────────────────────────────────────────

  server.tool(
    "scheduled_task_list",
    "Brunella ütemezett (cron) feladatok listázása. Visszaadja az összes konfigurált " +
    "cron feladatot státuszukkal, utolsó futásukkal és következő ütemezésükkel.",
    {
      enabled_only: z.boolean().default(false).optional()
        .describe("Csak engedélyezett feladatok visszaadása"),
    },
    async ({ enabled_only = false }) => {
      try {
        const { getGlobalDb } = await import("../utils/globalDb.js");
        const db = getGlobalDb();
        const query = enabled_only
          ? "SELECT * FROM scheduled_tasks WHERE enabled = 1 ORDER BY created_at DESC"
          : "SELECT * FROM scheduled_tasks ORDER BY created_at DESC";
        const tasks = db.prepare(query).all();
        logInfo("MCP:taskManagement", `scheduled_task_list: ${tasks.length} ütemezett feladat`);
        return {
          content: [{
            type: "text" as const,
            text: truncate(JSON.stringify({ count: tasks.length, tasks }, null, 2))
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `scheduled_task_list hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "scheduled_task_create",
    "Új ütemezett (cron) feladat létrehozása a Brunella rendszerben. " +
    "A feladat a megadott cron kifejezés szerint fog futni.",
    {
      title: z.string().describe("A feladat neve (pl. 'Napi agent egészség ellenőrzés')"),
      prompt: z.string().describe("Az agent számára küldendő prompt/utasítás"),
      cron_expression: z.string()
        .describe("Cron kifejezés (pl. '0 9 * * *' = minden nap reggel 9-kor)"),
      handler: z.string().default("agentManager")
        .describe("Kezelő neve (alap: 'agentManager')"),
      metadata: z.record(z.unknown()).default({}).optional()
        .describe("Opcionális metaadat JSON objektum"),
    },
    async ({ title, prompt, cron_expression, handler = "agentManager", metadata = {} }) => {
      try {
        const { getGlobalDb } = await import("../utils/globalDb.js");
        const { v4: uuidv4 } = await import("uuid");
        const db = getGlobalDb();
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO scheduled_tasks (id, title, prompt, cron_expression, handler, enabled, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).run(id, title, prompt, cron_expression, handler, JSON.stringify(metadata), now, now);
        logInfo("MCP:taskManagement", `scheduled_task_create: '${title}' (${cron_expression}) → ${id}`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, id, title, cron_expression, enabled: true }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `scheduled_task_create hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "scheduled_task_toggle",
    "Ütemezett feladat engedélyezése vagy letiltása azonosító alapján.",
    {
      id: z.string().describe("A scheduled_tasks rekord UUID-ja"),
      enabled: z.boolean().describe("true = engedélyezett, false = letiltott"),
    },
    async ({ id, enabled }) => {
      try {
        const { getGlobalDb } = await import("../utils/globalDb.js");
        const db = getGlobalDb();
        const now = new Date().toISOString();
        const result = db.prepare(
          "UPDATE scheduled_tasks SET enabled = ?, updated_at = ? WHERE id = ?"
        ).run(enabled ? 1 : 0, now, id);
        if (result.changes === 0) {
          return { isError: true, content: [{ type: "text" as const, text: `❌ Feladat nem található: ${id}` }] };
        }
        logInfo("MCP:taskManagement", `scheduled_task_toggle: ${id} → ${enabled ? "engedélyezve" : "letiltva"}`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, id, enabled }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `scheduled_task_toggle hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "scheduled_task_delete",
    "Ütemezett feladat törlése azonosító alapján. Ez visszafordíthatatlan művelet.",
    {
      id: z.string().describe("A scheduled_tasks rekord UUID-ja"),
    },
    async ({ id }) => {
      try {
        const { getGlobalDb } = await import("../utils/globalDb.js");
        const db = getGlobalDb();
        const result = db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(id);
        if (result.changes === 0) {
          return { isError: true, content: [{ type: "text" as const, text: `❌ Feladat nem található: ${id}` }] };
        }
        logInfo("MCP:taskManagement", `scheduled_task_delete: ${id} törölve`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, deleted_id: id }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:taskManagement", `scheduled_task_delete hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );
}
