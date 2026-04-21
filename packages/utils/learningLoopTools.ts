/**
 * Learning Loop MCP Tools
 * Brunella tanulási ciklus: snapshot-ok, tréning futtatások, reflex modell registry, golden dataset
 * Lefedi: /api/v1/learning-loop
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logInfo, logError } from "@packages/utils/logger.js";

const CHAR_LIMIT = 20000;
function truncate(text: string): string {
  return text.length > CHAR_LIMIT ? text.slice(0, CHAR_LIMIT) + "\n…[csonkítva]" : text;
}

export function registerLearningLoopTools(server: McpServer): void {

  // ──────────────────────────────────────────
  // SNAPSHOT-OK (curated golden dataset)
  // ──────────────────────────────────────────

  server.tool(
    "learning_snapshots_list",
    "Brunella learning loop snapshot-ok listázása. " +
    "Ezek a tréninghez előkészített, kuráltott arany-dataset pillanatképek. " +
    "Visszaadja a snapshot azonosítókat, mintaszámokat és átlagos minőségi pontszámokat.",
    {},
    async () => {
      try {
        const { listLearningLoopSnapshots } = await import("@packages/core-logic/learningLoopService.js");
        const snapshots = await listLearningLoopSnapshots();
        const summary = {
          total: snapshots.length,
          latest: snapshots[0] ?? null,
          total_samples: snapshots.reduce((sum: number, s) => sum + s.sampleCount, 0),
          avg_quality: snapshots.length > 0
            ? Math.round((snapshots.reduce((sum: number, s) => sum + s.avgQuality, 0) / snapshots.length) * 100) / 100
            : 0,
          snapshots,
        };
        logInfo("MCP:learningLoop", `learning_snapshots_list: ${snapshots.length} snapshot`);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(summary, null, 2)) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_snapshots_list hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // TRÉNING FUTTATÁSOK
  // ──────────────────────────────────────────

  server.tool(
    "learning_training_runs",
    "Brunella reflex modell tréning futtatások előzményei. " +
    "Megmutatja a korábbi tréning ciklus adatait: snapshot forrás, futásidő, " +
    "eredmény státusz és modell azonosítók.",
    {
      limit: z.number().min(1).max(50).default(10).optional()
        .describe("Visszaadott futtatások száma (alap: 10)"),
    },
    async ({ limit = 10 }) => {
      try {
        const { listTrainingRuns } = await import("@packages/core-logic/reflexModelRegistry.js");
        const runs = listTrainingRuns(limit);
        logInfo("MCP:learningLoop", `learning_training_runs: ${runs.length} futtatás`);
        return {
          content: [{
            type: "text" as const,
            text: truncate(JSON.stringify({ count: runs.length, runs }, null, 2))
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_training_runs hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "learning_eval_results",
    "Brunella reflex modell értékelési eredmények listája. " +
    "Megmutatja az egyes modellek értékelési pontszámait, regresszió-deltákat " +
    "és a ki értékelési eszközzel volt mérve.",
    {
      limit: z.number().min(1).max(50).default(10).optional()
        .describe("Visszaadott értékelések száma (alap: 10)"),
    },
    async ({ limit = 10 }) => {
      try {
        const { listEvalResults } = await import("@packages/core-logic/reflexModelRegistry.js");
        const results = listEvalResults(limit);
        logInfo("MCP:learningLoop", `learning_eval_results: ${results.length} értékelés`);
        return {
          content: [{
            type: "text" as const,
            text: truncate(JSON.stringify({ count: results.length, results }, null, 2))
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_eval_results hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // REFLEX MODELL REGISTRY
  // ──────────────────────────────────────────

  server.tool(
    "learning_model_registry",
    "Brunella reflex modell registry összefoglalója. " +
    "Megmutatja az összes modell jelölt státuszát: aktív, tesztelés alatt, visszavont. " +
    "Tartalmazza az aktuálisan élesben lévő modell adatait is.",
    {},
    async () => {
      try {
        const { getReflexRegistrySummary } = await import("@packages/core-logic/reflexModelRegistry.js");
        const summary = getReflexRegistrySummary();
        logInfo("MCP:learningLoop", "learning_model_registry lekérve");
        return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_model_registry hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "learning_model_list",
    "Brunella reflex modell jelöltek listázása státusz alapján szűrve. " +
    "Visszaadja a modell azonosítókat, teljesítmény pontszámokat és státuszokat.",
    {
      state: z.enum(["candidate", "active", "retired", "shadow"]).optional()
        .describe("Szűrés modell státuszra (opcionális, alap: összes)"),
      limit: z.number().min(1).max(50).default(25).optional()
        .describe("Maximális sorok száma (alap: 25)"),
    },
    async ({ state, limit = 25 }) => {
      try {
        const { listReflexModels } = await import("@packages/core-logic/reflexModelRegistry.js");
        const models = listReflexModels(state, limit);
        logInfo("MCP:learningLoop", `learning_model_list: ${models.length} modell (state=${state ?? "all"})`);
        return {
          content: [{
            type: "text" as const,
            text: truncate(JSON.stringify({ count: models.length, models }, null, 2))
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_model_list hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "learning_active_model",
    "Az aktuálisan aktív Brunella reflex modell lekérése. " +
    "Opcionálisan szűrhető task kategóriára (pl. 'coding', 'analysis', 'general'). " +
    "Ha nincs aktív modell, null-t ad vissza.",
    {
      task_category: z.string().optional()
        .describe("Task kategória (pl. 'coding', 'analysis', 'general') - opcionális"),
    },
    async ({ task_category }) => {
      try {
        const { getActiveReflexModel } = await import("@packages/core-logic/reflexModelRegistry.js");
        const model = getActiveReflexModel(task_category);
        logInfo("MCP:learningLoop", `learning_active_model: ${model?.modelId ?? "nincs aktív modell"}`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ active_model: model }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_active_model hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // GOLDEN DATASET
  // ──────────────────────────────────────────

  server.tool(
    "learning_golden_stats",
    "Brunella golden dataset statisztikái. Megmutatja a kuráltott tréning példák " +
    "számát, minőségi eloszlását, forrás megoszlását és jóváhagyási státuszait.",
    {},
    async () => {
      try {
        const { getCuratedGoldenStats } = await import("@packages/core-logic/goldenDatasetBridge.js");
        const stats = getCuratedGoldenStats();
        logInfo("MCP:learningLoop", "learning_golden_stats lekérve");
        return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_golden_stats hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  server.tool(
    "learning_golden_samples",
    "Brunella kuráltott golden dataset minták böngészése. " +
    "Visszaadja a tréning példákat: prompt, completion, minőségi pontszám, forrás és jóváhagyási állapot. " +
    "Szűrhető forrás, minimális minőség és jóváhagyási státusz alapján.",
    {
      source: z.string().optional()
        .describe("Szűrés forrásra (pl. 'github_remediation_runtime', 'manual_curation')"),
      min_quality: z.number().min(0).max(1).optional()
        .describe("Minimális minőségi pontszám (0.0-1.0)"),
      approval_state: z.enum(["approved", "pending", "rejected"]).optional()
        .describe("Szűrés jóváhagyási státuszra"),
      limit: z.number().min(1).max(100).default(20).optional()
        .describe("Maximális sorok száma (alap: 20)"),
      offset: z.number().min(0).default(0).optional()
        .describe("Eltolás lapozáshoz"),
    },
    async ({ source, min_quality, approval_state, limit = 20, offset = 0 }) => {
      try {
        const { listCuratedGoldenSamples } = await import("@packages/core-logic/goldenDatasetBridge.js");
        const allSamples = listCuratedGoldenSamples({
          source,
          state: approval_state,
          limit,
          offset,
        });
        const paginated = allSamples;
        const result = {
          total: paginated.length,
          returned: paginated.length,
          offset,
          limit,
          samples: paginated,
        };
        logInfo("MCP:learningLoop", `learning_golden_samples: ${paginated.length}/${allSamples.length} minta`);
        return { content: [{ type: "text" as const, text: truncate(JSON.stringify(result, null, 2)) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_golden_samples hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );

  // ──────────────────────────────────────────
  // LEARNING LOOP VEZÉRLÉS
  // ──────────────────────────────────────────

  server.tool(
    "learning_rollback_model",
    "Brunella reflex modell visszaállítása az előző stabil verzióra. " +
    "Ha megadunk target_model_id-t, arra a modellre áll vissza, " +
    "különben az utolsó stable modellt aktiválja. Visszafordítható vészstop.",
    {
      target_model_id: z.string().optional()
        .describe("A célmodell azonosítója (opcionális - ha nem adod meg, az előző stabilt választja)"),
      reason: z.string().optional()
        .describe("A visszaállítás oka (opcionális, pl. 'regresszió észlelve')"),
    },
    async ({ target_model_id, reason = "manual rollback via MCP" }) => {
      try {
        const { rollbackReflexModel } = await import("@packages/core-logic/reflexModelRegistry.js");
        const rolledBack = rollbackReflexModel(target_model_id, reason);
        logInfo("MCP:learningLoop", `learning_rollback_model: ${rolledBack.modelId} aktiválva`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              activated_model: rolledBack.modelId,
              reason,
              state: rolledBack.state,
            }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("MCP:learningLoop", `learning_rollback_model hiba: ${msg}`);
        return { isError: true, content: [{ type: "text" as const, text: `❌ Hiba: ${msg}` }] };
      }
    }
  );
}

