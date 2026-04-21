// FILE: src/agents/SpecWriterAgent.ts
// PURPOSE: Automatically generates EPP v2 compliant tracks from creative ideas
//          + SpecDocument generation from SystemBlueprint (Software Genesis Phase 2)
// VERSION: 2.1 (EPP v2 Protocol + Blueprint Spec Engine)
// UPDATED: 2026-02-16 - Added generateBlueprintSpec() pipeline

import { BaseAgent, type AgentContext, type AgentResult } from "./BaseAgent.js";
import { generateResponse } from "@packages/core-logic/llm_client.js";
import { logInfo, logError, logDebug, setAgentStatus } from "@packages/utils/logger.js";
import { ensureError } from "@packages/utils/ensureError.js";
import { safeJsonParse } from '@packages/utils/aiHelpers.js';
import fs from "fs/promises";
import path from "path";
import type {
  SystemBlueprint,
  SpecDocument,
  ModuleSpec,
  ModuleTask,
  AgentTaskQueueItem,
  AppLayer,
} from "@packages/types/blueprint.js";

// ════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ════════════════════════════════════════════════════════════════

/**
 * Structured requirements JSON from Stage 1
 */
interface RequirementsJson {
  title: string;
  description: string;
  priority: "P0" | "P1" | "P2";
  estimated_hours: number;
  phases: Array<{
    name: string;
    tasks: Array<{
      task: string;
      estimate_minutes: number;
    }>;
  }>;
  integrations: {
    dashboard: string;
    cli: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSystemBlueprint(value: unknown): value is SystemBlueprint {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.app_name === "string" &&
    Array.isArray(value.modules)
  );
}

// ════════════════════════════════════════════════════════════════
// AGENT IMPLEMENTATION
// ════════════════════════════════════════════════════════════════

/**
 * SpecWriterAgent v2.0 - EPP v2 Track Generator
 *
 * FEATURES:
 * - 3-stage LLM pipeline (qwen2.5-coder:latest)
 * - EPP v2 compliant track.md generation
 * - Dashboard + CLI integration checklist
 * - Automatic TODO breakdown
 * - conductor/tracks/ structure
 *
 * INPUT: Creative idea (2-5 sentences, natural language, magyar OK)
 * OUTPUT: Professional track.md (EPP v2, 7 Arany Szabály)
 */
export class SpecWriterAgent extends BaseAgent {
  name = "SpecWriter";
  role = "EPP v2 Track Generator";
  description =
    "Generates EPP v2 compliant tracks from creative ideas using 3-stage LLM pipeline.";
  capabilities = [
    "track_generation",
    "epp_v2_compliance",
    "requirement_extraction",
    "todo_breakdown",
  ];

  private getTracksDir(): string {
    const rawOverride = process.env.BRUNELLA_CONDUCTOR_TRACKS_DIR?.trim();
    if (rawOverride) {
      return path.isAbsolute(rawOverride)
        ? rawOverride
        : path.join(process.cwd(), rawOverride);
    }

    return path.join(process.cwd(), "conductor", "tracks");
  }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task || "").toLowerCase();

    try {
      const meta = isRecord(context.metadata) ? context.metadata : {};

      // Blueprint Spec generálás (Software Genesis Phase 2)
      if (this.isBlueprintSpecTask(task, meta) && isSystemBlueprint(meta.blueprint)) {
        const blueprint = meta.blueprint;
        return await this.generateBlueprintSpec(blueprint);
      }

      // Track generálás (hagyományos 3-stage pipeline)
      if (this.isTrackGenerationTask(task)) {
        return await this.generate3StageTrack(context);
      }

      if (this.isListTracksTask(task)) {
        return await this.listTracks();
      }

      // Default: 3-stage track generation
      return await this.generate3StageTrack(context);
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Error: ${err.message}`);
      return {
        success: false,
        message: `SpecWriter error: ${err.message}`,
        metadata: { error: err.message, stack: err.stack },
      };
    }
  }

  private isTrackGenerationTask(task: string): boolean {
    const keywords = [
      "track",
      "generate",
      "create",
      "új",
      "írj",
      "készíts",
      "generálj",
    ];
    return keywords.some((kw) => task.includes(kw));
  }

  private isListTracksTask(task: string): boolean {
    const keywords = ["list", "show", "tracks", "listázd", "mutasd"];
    return keywords.some((kw) => task.includes(kw)) && task.includes("track");
  }

  private isBlueprintSpecTask(task: string, meta: Record<string, unknown>): boolean {
    const hasBlueprintKeyword =
      task.includes("blueprint") ||
      task.includes("spec") ||
      task.includes("genesis") ||
      task.includes("modul");
    const hasBlueprintObject =
      meta.blueprint !== undefined &&
      typeof meta.blueprint === "object" &&
      meta.blueprint !== null &&
      "modules" in (meta.blueprint as object);
    return hasBlueprintObject || (hasBlueprintKeyword && hasBlueprintObject);
  }

  // ════════════════════════════════════════════════════════════════
  // BLUEPRINT SPEC ENGINE – Software Genesis Protocol Phase 2
  // ════════════════════════════════════════════════════════════════

  /**
   * Generál részletes SpecDocument-et egy SystemBlueprint-ből.
   *
   * Pipeline:
   *   1. Topológiai rendezés (dependency graph)
   *   2. Modul-szintű task bővítés (minden prompt → ModuleTask)
   *   3. Layer-specifikus prompt template alkalmazás
   *   4. AgentTaskQueue sszeállítás prioritással
   *   5. SpecDocument visszaadás
   *
   * @param blueprint - Jóváhagyott SystemBlueprint (ArchitectAgent kimenet)
   */
  async generateBlueprintSpec(blueprint: SystemBlueprint): Promise<AgentResult> {
    logInfo(this.name, `📋 Blueprint spec generálás: ${blueprint.app_name}`);
    logInfo(this.name, `   Modulok: ${blueprint.modules.length} db`);

    const now = new Date().toISOString();

    // 1. Topológiai rendezés (Kahn-algoritmus)
    const depOrder = this.topoSort(blueprint);
    logInfo(this.name, `   Dependency order: [${depOrder.join(" → ")}]`);

    // 2. Modul Spec generálás
    const moduleSpecs: ModuleSpec[] = [];
    let globalTaskCounter = 0;
    const allQueueItems: AgentTaskQueueItem[] = [];

    for (const modId of depOrder) {
      const mod = blueprint.modules.find((m) => m.id === modId);
      if (!mod) continue;

      const agentName = this.resolveAgent(mod.layer, blueprint);
      const tasks: ModuleTask[] = [];
      const fileManifest = mod.files_to_generate.map((filePath) => ({
        path: filePath,
        description: this.inferFileDescription(filePath, mod.layer),
        tech: mod.tech_stack[0] ?? "typescript",
      }));

      // Minden `prompt` → ModuleTask
      mod.prompts.forEach((promptText, i) => {
        globalTaskCounter++;
        const taskId = `${mod.id}_task_${i + 1}`;
        const expandedPrompt = this.buildPromptTemplate(
          promptText,
          mod.layer,
          blueprint,
          mod,
        );
        const criterion = mod.acceptance_criteria[i] ?? mod.acceptance_criteria[0] ?? "A feladat teljesítve.";

        tasks.push({
          id: taskId,
          description: promptText,
          prompt_template: expandedPrompt,
          estimated_minutes: Math.round((mod.estimated_hours * 60) / Math.max(mod.prompts.length, 1)),
          assigned_agent: agentName,
          dependencies: i === 0
            ? mod.dependencies.flatMap((dep) => [`${dep}_task_1`])
            : [`${mod.id}_task_${i}`],
          acceptance_criteria: [criterion],
        });

        // Queue item (prioritás: dependency order index + task sorrend)
        allQueueItems.push({
          priority: depOrder.indexOf(mod.id) * 10 + i,
          module_id: mod.id,
          task_id: taskId,
          agent: agentName,
          prompt: expandedPrompt,
          estimated_minutes: tasks[tasks.length - 1].estimated_minutes,
        });
      });

      const totalMin = tasks.reduce((s, t) => s + t.estimated_minutes, 0);

      moduleSpecs.push({
        module_id: mod.id,
        module_name: mod.name,
        layer: mod.layer,
        summary: mod.description,
        tasks,
        file_manifest: fileManifest,
        total_estimated_minutes: totalMin,
        assigned_agents: [...new Set(tasks.map((t) => t.assigned_agent))],
        generated_at: now,
      });

      logInfo(this.name, `   ✅ ${mod.id}: ${tasks.length} task, ${totalMin} perc`);
    }

    // Rendezés prioritás szerint
    allQueueItems.sort((a, b) => a.priority - b.priority);

    const totalHours = moduleSpecs.reduce(
      (s, m) => s + m.total_estimated_minutes / 60,
      0,
    );

    const specDoc: SpecDocument = {
      blueprint_id: blueprint.id,
      app_name: blueprint.app_name,
      generated_at: now,
      module_specs: moduleSpecs,
      dependency_order: depOrder,
      total_tasks: globalTaskCounter,
      total_estimated_hours: Math.round(totalHours * 10) / 10,
      agent_task_queue: allQueueItems,
    };

    logInfo(
      this.name,
      `✨ SpecDocument kész: ${specDoc.total_tasks} task, ${specDoc.total_estimated_hours}h`,
    );

    return {
      success: true,
      message: `✅ SpecDocument generálva: ${specDoc.total_tasks} task, ${specDoc.total_estimated_hours}h`,
      data: { spec: specDoc, blueprint_id: blueprint.id },
    };
  }

  // ────────────────────────────────────────────────────────────
  // TOPOLÓGIAI RENDEZÉS (Kahn-algoritmus)
  // ────────────────────────────────────────────────────────────

  private topoSort(blueprint: SystemBlueprint): string[] {
    const ids = blueprint.modules.map((m) => m.id);
    const deps = new Map<string, string[]>(
      blueprint.modules.map((m) => [m.id, m.dependencies.filter((d) => ids.includes(d))]),
    );

    const inDegree = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const [, depList] of deps) {
      for (const dep of depList) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0));
      }
      for (const id of ids) {
        if ((deps.get(id) ?? []).length > 0) {
          // count how many others depend on this
        }
      }
    }

    // Calculate in-degrees (how many modules depend on each)
    const dependedOn = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const [id, depList] of deps) {
      for (const dep of depList) {
        if (ids.includes(dep)) {
          dependedOn.set(id, (dependedOn.get(id) ?? 0));
        }
      }
    }

    // Simple topological sort: process nodes with no unmet dependencies first
    const ordered: string[] = [];
    const resolved = new Set<string>();
    let remaining = [...ids];

    let maxIterations = ids.length * ids.length + 1;
    while (remaining.length > 0 && maxIterations-- > 0) {
      const canProcess = remaining.filter((id) =>
        (deps.get(id) ?? []).every((dep) => resolved.has(dep)),
      );
      if (canProcess.length === 0) {
        // Ciklikus függőség – maradékot eredeti sorrendben hozzáadjuk
        ordered.push(...remaining);
        break;
      }
      for (const id of canProcess) {
        ordered.push(id);
        resolved.add(id);
      }
      remaining = remaining.filter((id) => !resolved.has(id));
    }

    return ordered;
  }

  // ────────────────────────────────────────────────────────────
  // AGENT KIVÁLASZTÁS Layer alapján
  // ────────────────────────────────────────────────────────────

  private resolveAgent(layer: AppLayer, blueprint: SystemBlueprint): string {
    // Blueprint agent_assignments elsőbbséget élvez
    const explicit = blueprint.agent_assignments?.find(
      (a) => blueprint.modules.find((m) => m.layer === layer && m.id === a.module_id),
    );
    if (explicit) return explicit.agent_name;

    // Default layer → agent mapping
    const layerAgentMap: Record<AppLayer, string> = {
      frontend: "DeveloperAgent",
      backend: "DeveloperAgent",
      database: "DataScientistAgent",
      infra: "EdgeProxyAgent",
      ai: "DeveloperAgent",
      mobile: "DeveloperAgent",
    };
    return layerAgentMap[layer] ?? "DeveloperAgent";
  }

  // ────────────────────────────────────────────────────────────
  // LAYER-SPECIFIKUS PROMPT TEMPLATE
  // ────────────────────────────────────────────────────────────

  private buildPromptTemplate(
    basePrompt: string,
    layer: AppLayer,
    blueprint: SystemBlueprint,
    mod: { name: string; tech_stack: string[] },
  ): string {
    const techList = mod.tech_stack.join(", ");
    const appCtx = `App: ${blueprint.app_name} (${blueprint.architecture_style})`;

    const prefixes: Record<AppLayer, string> = {
      frontend: `[FRONTEND TASK – ${techList}] ${appCtx}\n`,
      backend: `[BACKEND TASK – ${techList}] ${appCtx}\n`,
      database: `[DATABASE TASK – ${techList}] ${appCtx}\n`,
      infra: `[INFRA TASK – ${techList}] ${appCtx}\n`,
      ai: `[AI/ML TASK – ${techList}] ${appCtx}\n`,
      mobile: `[MOBILE TASK – ${techList}] ${appCtx}\n`,
    };

    const layerGuidelines: Record<AppLayer, string> = {
      frontend: "Kövesd a komponens-alapú architektúrát. TypeScript strict mode. Tailwind v4 styling.",
       backend: "ESM + .js import. Try/catch/finally. Logger használata kötelező, közvetlen logolás tilos. RESTful API.",
      database: "Pydantic modellek minden sémához. Migration script generálása kötelező.",
      infra: "Minimális cold-start. Edge-compatible. Secrets Cloudflare Workers via env.",
      ai: "Ollama/Gemini integráció. Streaming response support. Prompt injection védelem.",
      mobile: "React Native. Offline-first. Platform-specifikus UI guideline betartása.",
    };

    return `${prefixes[layer] ?? ""}Modul: ${mod.name}\nFeladat: ${basePrompt}\nGuideline: ${layerGuidelines[layer] ?? ""}`;
  }

  // ────────────────────────────────────────────────────────────
  // FÁJL LEÍRÁS INFERENCE
  // ────────────────────────────────────────────────────────────

  private inferFileDescription(filePath: string, layer: AppLayer): string {
    if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.py")) return "Unit test fájl";
    if (filePath.endsWith(".md")) return "Dokumentáció";
    if (filePath.includes("schema")) return "Adatbázis schema";
    if (filePath.includes("routes") || filePath.includes("router")) return "API route handler";
    if (filePath.includes("component") || filePath.includes("Component")) return "UI komponens";
    if (filePath.includes("agent") || filePath.includes("Agent")) return "AI Agent implementáció";
    if (filePath.includes("types") || filePath.includes(".d.ts")) return "TypeScript típusdefiníciók";
    if (filePath.includes("utils") || filePath.includes("helpers")) return "Segédfüggvények";
    if (filePath.includes("worker")) return "Background worker";

    const layerDefaults: Record<AppLayer, string> = {
      frontend: "Frontend modul fájl",
      backend: "Backend implementáció",
      database: "Adatbázis réteg fájl",
      infra: "Infrastruktúra konfiguráció",
      ai: "AI/ML modul",
      mobile: "Mobil komponens",
    };
    return layerDefaults[layer] ?? "Generált fájl";
  }

  /**
   * 3-STAGE LLM PIPELINE - EPP v2 Track Generation
   *
   * Stage 1: Requirement Extraction (idea → structured JSON)
   * Stage 2: Track Generation (JSON → track.md markdown)
   * Stage 3: Validation & File Write (EPP v2 compliance check)
   */
  private async generate3StageTrack(
    context: AgentContext,
  ): Promise<AgentResult> {
    logInfo(this.name, "🚀 Starting 3-stage track generation...");

    const metadata = (context.metadata || {}) as Record<string, any>;
    const idea = metadata.idea || context.task || "";

    if (!idea) {
      return {
        success: false,
        message: "Missing idea in context.metadata.idea or context.task",
      };
    }

    try {
      // ────────────────────────────────────────────────────────────
      // STAGE 1: Requirement Extraction
      // ────────────────────────────────────────────────────────────
      logInfo(this.name, "📊 Stage 1/3: Requirement extraction...");
      const requirementsJson = await this.stage1_extractRequirements(idea);
      logInfo(this.name, `✅ Stage 1 complete: ${requirementsJson.title}`);

      // ────────────────────────────────────────────────────────────
      // STAGE 2: Track Markdown Generation
      // ────────────────────────────────────────────────────────────
      logInfo(this.name, "📝 Stage 2/3: Generating track.md...");
      const trackMarkdown =
        await this.stage2_generateTrackMarkdown(requirementsJson);
      logInfo(this.name, `✅ Stage 2 complete: ${trackMarkdown.length} chars`);

      // ────────────────────────────────────────────────────────────
      // STAGE 3: Validation & File Write
      // ────────────────────────────────────────────────────────────
      logInfo(this.name, "✔️ Stage 3/3: Validating EPP v2 compliance...");
      const validationResult = await this.stage3_validateAndWrite(
        requirementsJson,
        trackMarkdown,
      );

      if (!validationResult.success) {
        return validationResult;
      }

      const trackData = validationResult.data as {
        trackId: string;
        trackPath: string;
        trackFile: string;
      };
      logInfo(this.name, `✨ Track generated: ${trackData.trackId}`);

      return {
        success: true,
        message: `✅ Track generated successfully: ${trackData.trackId}`,
        data: {
          trackId: trackData.trackId,
          trackPath: trackData.trackPath,
          trackFile: trackData.trackFile,
          trackMarkdown,
          requirements: requirementsJson,
          preview: trackMarkdown.slice(0, 500) + "...",
        },
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      const errorMessage = err.message;
      logError(this.name, `3-stage pipeline error: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to generate track: ${errorMessage}`,
        metadata: { error: errorMessage, stack: err.stack },
      };
    }
  }

  // ════════════════════════════════════════════════════════════════
  // STAGE 1: REQUIREMENT EXTRACTION
  // ════════════════════════════════════════════════════════════════

  /**
   * Stage 1: Extract structured requirements from natural language idea
   * Uses qwen2.5-coder:latest via Ollama
   *
   * @param idea - Natural language idea (2-5 sentences, magyar OK)
   * @returns Structured JSON: { title, description, priority, phases[] }
   */
  private async stage1_extractRequirements(
    idea: string,
  ): Promise<RequirementsJson> {
    const systemPrompt = `You are an expert requirements analyst. Extract structured information from the user's creative idea.

**OUTPUT FORMAT (JSON ONLY):**
{
  "title": "Short descriptive title (English, 4-6 words)",
  "description": "1-2 sentence description (English)",
  "priority": "P0" | "P1" | "P2",
  "estimated_hours": <number>,
  "phases": [
    {
      "name": "Phase 1: Core Implementation",
      "tasks": [
        { "task": "Create agent class", "estimate_minutes": 60 },
        { "task": "Write unit tests", "estimate_minutes": 30 }
      ]
    }
  ],
  "integrations": {
    "dashboard": "Brief dashboard component description",
    "cli": "Brief CLI command description (magyar)"
  }
}

**RULES:**
- Output ONLY valid JSON (no markdown, no extra text)
- priority: P0 (critical), P1 (high), P2 (medium)
- estimated_hours: total implementation time (1-40 hours)
- phases: 2-6 phases, each with 2-8 tasks
- tasks: specific, actionable, with realistic time estimates (15-240 min)
- integrations: MANDATORY (Dashboard + CLI required per EPP v2 Rule #6)`;

    const userPrompt = `Idea:\n${idea}`;

    try {
      const rawResponse = await generateResponse(
        `${systemPrompt}\n\n${userPrompt}`,
        "ollama",
        "qwen2.5-coder:latest",
      );

      if (typeof rawResponse !== "string") {
        throw new Error("LLM returned non-string or empty response");
      }

      let jsonString = rawResponse;

      // Try to extract from markdown code block first
      const markdownMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1];
      } else {
        // If not in markdown, try to find the first { and last }
        const firstCurly = rawResponse.indexOf("{");
        const lastCurly = rawResponse.lastIndexOf("}");
        if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
          jsonString = rawResponse.substring(firstCurly, lastCurly + 1);
        } else {
          throw new Error(
            "LLM did not return valid JSON format (missing curly braces or markdown block)",
          );
        }
      }
      const parsed = safeJsonParse<RequirementsJson>(jsonString, null as unknown as RequirementsJson);

      // Validation
      if (!parsed || !parsed.title || !parsed.phases || !parsed.integrations) {
        throw new Error("Missing required fields in extracted requirements");
      }

      return parsed;
    } catch (error: unknown) {
      const err = ensureError(error);
      const errorMessage = err.message;
      logError(this.name, `Stage 1 error: ${errorMessage}`);
      throw new Error(`Requirement extraction failed: ${errorMessage}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // STAGE 2: TRACK MARKDOWN GENERATION
  // ════════════════════════════════════════════════════════════════

  /**
   * Stage 2: Generate EPP v2 compliant track.md from requirements
   * Uses qwen2.5-coder:latest via Ollama
   *
   * @param requirements - Structured JSON from Stage 1
   * @returns Complete track.md markdown (EPP v2 format)
   */
  private async stage2_generateTrackMarkdown(
    requirements: RequirementsJson,
  ): Promise<string> {
    const today = new Date().toISOString().split("T")[0];
    const trackId = this.generateTrackId(requirements.title, today);

    // Build phases checklist
    const phasesMarkdown = requirements.phases
      .map((phase, idx) => {
        const tasksList = phase.tasks
          .map((t) => `- [ ] ${t.task} (${t.estimate_minutes} min)`)
          .join("\n");
        return `### Phase ${idx + 1}: ${phase.name}\n${tasksList}`;
      })
      .join("\n\n");

    const systemPrompt = `You are a technical writer generating an EPP v2 compliant track.md file.

**TEMPLATE (Markdown):**

# ${requirements.title}

**Track ID:** \`${trackId}\`
**Priority:** ${requirements.priority}
**Progress:** 0%
**Created:** ${today}
**Estimated Time:** ${requirements.estimated_hours} hours

---

## 🎯 Cél

${requirements.description}

## 📋 Feladatok (TODO)

${phasesMarkdown}

## ✅ Acceptance Criteria

- [ ] Dashboard integráció kész (${requirements.integrations.dashboard})
- [ ] CLI integráció kész (${requirements.integrations.cli})
- [ ] \`npm test\` - All tests passing (0 errors)
- [ ] \`npm run build\` - Clean build (0 TypeScript errors)
- [ ] EPP v2 compliance: 7 Arany Szabály követve
- [ ] Documentation updated (.ai/claude.md + FOSZAL.md)

## 🔗 Integrációk

### Dashboard
${requirements.integrations.dashboard}

**Component:** \`src/dashboard/components/[ComponentName].tsx\`

### CLI
${requirements.integrations.cli}

**Command:** \`brunella [command-name]\`
**File:** \`src/cli/[commandName]Commands.ts\`

## 📝 Notes

- **EPP v2 Protocol:** This track follows the 7 Arany Szabály (Golden Rules)
- **Testing:** Unit + Integration tests required
- **Documentation:** Update .ai/claude.md work log after completion

---

**Status:** Ready for Implementation ✅
**Next Step:** Begin Phase 1

---

**OUTPUT RULES:**
- Output the COMPLETE track.md file as markdown
- Include ALL sections from template
- Keep the TODO checklist with [ ] unchecked boxes
- Magyar and English mixed OK (magyar for CLI, English for code)
- NO markdown code blocks around output (raw markdown only)
`;

    try {
      const trackMarkdown = await generateResponse(
        systemPrompt,
        "ollama",
        "qwen2.5-coder:latest",
      );
      return trackMarkdown.trim();
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Stage 2 error: ${err.message}`);
      throw new Error(`Track generation failed: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // STAGE 3: VALIDATION & FILE WRITE
  // ════════════════════════════════════════════════════════════════

  /**
   * Stage 3: Validate EPP v2 compliance and write track file
   *
   * @param requirements - Structured JSON from Stage 1
   * @param trackMarkdown - Generated markdown from Stage 2
   * @returns AgentResult with track file info
   */
  private async stage3_validateAndWrite(
    requirements: RequirementsJson,
    trackMarkdown: string,
  ): Promise<AgentResult> {
    // EPP v2 Compliance Checks
    const requiredSections = [
      "## 🎯 Cél",
      "## 📋 Feladatok (TODO)",
      "## ✅ Acceptance Criteria",
      "## 🔗 Integrációk",
    ];

    for (const section of requiredSections) {
      if (!trackMarkdown.includes(section)) {
        logError(
          this.name,
          `EPP v2 validation failed: Missing section "${section}"`,
        );
        return {
          success: false,
          message: `EPP v2 validation failed: Missing required section "${section}"`,
        };
      }
    }

    // Check Dashboard + CLI integration (Rule #6) - must have both subsections
    const hasIntegrationsSection = trackMarkdown.includes("## 🔗 Integrációk");
    const hasDashboardSubsection =
      trackMarkdown.includes("### Dashboard") ||
      trackMarkdown.includes("**Dashboard:**");
    const hasCLISubsection =
      trackMarkdown.includes("### CLI") || trackMarkdown.includes("**CLI:**");

    if (
      !hasIntegrationsSection ||
      !hasDashboardSubsection ||
      !hasCLISubsection
    ) {
      logError(
        this.name,
        "EPP v2 Rule #6 violation: Missing Dashboard or CLI integration subsection",
      );
      return {
        success: false,
        message:
          "EPP v2 Rule #6 violation: Both Dashboard and CLI integration subsections are mandatory",
      };
    }

    // Create track directory
    const today = new Date().toISOString().split("T")[0];
    const trackId = this.generateTrackId(requirements.title, today);
    const trackPath = path.join(this.getTracksDir(), trackId);

    try {
      await fs.mkdir(trackPath, { recursive: true });
      logInfo(this.name, `Track directory created: ${trackId}`);

      // Write track.md
      const trackFilePath = path.join(trackPath, "track.md");
      await fs.writeFile(trackFilePath, trackMarkdown, "utf-8");
      logInfo(this.name, `Track file written: ${trackFilePath}`);

      return {
        success: true,
        message: `Track validated and written: ${trackId}`,
        data: {
          trackId,
          trackPath,
          trackFile: trackFilePath,
        },
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Stage 3 file write error: ${err.message}`);
      return {
        success: false,
        message: `Failed to write track file: ${err.message}`,
      };
    }
  }

  // ════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ════════════════════════════════════════════════════════════════

  /**
   * Generate track ID from title and date
   * Format: {kebab-case-title}-{YYYYMMDD}
   */
  private generateTrackId(title: string, date: string): string {
    const kebab = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const dateStr = date.replace(/-/g, "");
    return `${kebab}-${dateStr}`;
  }

  /**
   * List all tracks from conductor/tracks/ directory
   * Reads track.md files and extracts metadata
   */
  async listTracks(): Promise<AgentResult> {
    try {
      const tracksDir = this.getTracksDir();
      let trackDirs: Array<{ isDirectory(): boolean; name: string }> = [];

      try {
        trackDirs = await fs.readdir(tracksDir, { withFileTypes: true });
      } catch (error: unknown) {
        // In test mode (or fresh setup) the tracks dir may not exist yet.
        const err = ensureError(error);
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") {
          logDebug(this.name, `Tracks directory missing, returning empty list: ${err.message}`);
          return {
            success: true,
            message: "Found 0 track(s)",
            data: { tracks: [] },
          };
        }
        logError(this.name, `Failed to list tracks directory: ${err.message}`);
        throw err;
      }
      const tracks = [];

      for (const dir of trackDirs.filter((d) => d.isDirectory())) {
        const trackPath = path.join(this.getTracksDir(), dir.name, "track.md");
        try {
          const trackContent = await fs.readFile(trackPath, "utf-8");

          // Extract metadata from track.md (first 20 lines)
          const lines = trackContent.split("\n").slice(0, 20);
          const title =
            lines
              .find((l) => l.startsWith("# "))
              ?.replace("# ", "")
              .trim() || dir.name;
          const priorityMatch = lines.find((l) => l.includes("**Priority:**"));
          const priority = priorityMatch?.match(/P[0-2]/)?.[0] || "P2";
          const progressMatch = lines.find((l) => l.includes("**Progress:**"));
          const progress = parseInt(progressMatch?.match(/\d+/)?.[0] || "0");

          tracks.push({
            id: dir.name,
            title,
            priority,
            progress,
            path: trackPath,
          });
        } catch (error: unknown) {
          // Skip if track.md is missing or invalid
          const err = ensureError(error);
          logDebug(this.name, `Skipping invalid track: ${dir.name} (${err.message})`);
        }
      }

      return {
        success: true,
        message: `Found ${tracks.length} track(s)`,
        data: { tracks },
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Failed to list tracks: ${err.message}`);
      return {
        success: false,
        message: `Failed to list tracks: ${err.message}`,
      };
    }
  }
}

export default SpecWriterAgent;

