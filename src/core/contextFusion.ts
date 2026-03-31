/**
 * ContextFusion — Reusable Context Cards / Fusion Summaries
 *
 * Lazily assembles compact, token-efficient context cards from:
 *   - GraphRagEngine  (knowledge-graph stats + recent lessons)
 *   - ReflectionEngine (self-model health, meta-insights)
 *   - HybridMemory    (indexed document count via LanceDB)
 *   - ChromeDevToolsAgent (optional browser diagnostics — lazy import)
 *
 * Design goals:
 *   1. Never throws — all subsystem calls are wrapped in try/catch.
 *   2. Token-efficient — `fusionPrompt` is a compact string for LLM injection.
 *   3. Lazy — only collects what is actually needed via options.
 *   4. Reusable — used by assistantBlueprint, BrowserCopilotSessionService, CLI.
 *
 * @module contextFusion
 */

import { GraphRagEngine } from './graphRagEngine.js';
import { ReflectionEngine } from './reflectionEngine.js';
import { HybridMemory } from '../utils/rag.js';
import { logWarn } from '../utils/logger.js';

// ─── Exported Types ───────────────────────────────────────────────────────────

/** Statistics from the GraphRAG knowledge graph. */
export interface GraphRagFusionStats {
  nodes: number;
  edges: number;
  lessons: number;
  nodeTypes: Record<string, number>;
}

/** Statistics and recent context from the ReflectionEngine. */
export interface ReflectionFusionStats {
  totalReflections: number;
  avgQualityScore: number;
  selfModelHealth: string;
  /** System-prompt fragment produced by ReflectionEngine.getReflectionContext() */
  recentContext: string;
}

/** Statistics from HybridMemory (LanceDB). */
export interface MemoryFusionStats {
  indexedDocuments: number;
}

/** Browser health snapshot from ChromeDevToolsAgent. */
export interface BrowserDiagnosticsCard {
  url: string;
  capturedAt: string;
  /** Number of JS errors captured. -1 when Chrome DevTools were unreachable. */
  jsErrors: number;
  /** Number of failed HTTP requests. -1 when unreachable. */
  networkErrors: number;
  performanceSummary: string;
  rawSummary: string;
}

/**
 * Compact context card merging all active subsystem signals.
 *
 * All fields except `generatedAt` and `fusionPrompt` are nullable so
 * callers can gracefully handle partial data when a subsystem is offline.
 */
export interface ContextFusionCard {
  generatedAt: string;
  graphRag: GraphRagFusionStats | null;
  reflection: ReflectionFusionStats | null;
  memory: MemoryFusionStats | null;
  /**
   * Token-efficient multi-line string ready for LLM system-prompt injection.
   * Empty string when all subsystems returned no data.
   */
  fusionPrompt: string;
  browserDiagnostics?: BrowserDiagnosticsCard;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ContextFusionOptions {
  /**
   * When provided, `GraphRagEngine.queryContext(queryMessage, 5)` is called
   * and the resulting graph context summary is appended to `fusionPrompt`.
   */
  queryMessage?: string;
  /**
   * Set to `false` to skip `GraphRagEngine.init()` (e.g. when the caller
   * already initialised the engine in the same request lifecycle).
   * @default true
   */
  initGraphRag?: boolean;
  /**
   * When set, `buildBrowserDiagnosticsCard(url)` is called and its result
   * is attached to the returned card as `browserDiagnostics`.
   */
  browserDiagnosticsUrl?: string;
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

/**
 * Collects and merges context signals from active subsystems into a single
 * compact `ContextFusionCard`.
 *
 * **Never throws** — if a subsystem call fails the corresponding field is
 * `null` and a WARN is emitted via the project logger.
 *
 * @param options - Tuning options (query message, browser URL, init skip)
 * @returns ContextFusionCard suitable for LLM prompt injection or UI display
 *
 * @example
 * const card = await buildContextFusionCard({ queryMessage: 'invoice processing' });
 * systemPrompt += card.fusionPrompt;
 */
export async function buildContextFusionCard(
  options: ContextFusionOptions = {},
): Promise<ContextFusionCard> {
  const generatedAt = new Date().toISOString();

  // ── GraphRAG Stats ──────────────────────────────────────────────────────────
  let graphRag: GraphRagFusionStats | null = null;
  let graphRagContextSnippet = '';
  try {
    const engine = GraphRagEngine.getInstance();
    if (options.initGraphRag !== false) {
      await engine.init();
    }
    const stats = engine.getStats();
    graphRag = {
      nodes: stats.nodes,
      edges: stats.edges,
      lessons: stats.lessons,
      nodeTypes: stats.nodeTypes,
    };
    if (options.queryMessage && (stats.nodes > 0 || stats.lessons > 0)) {
      const ctx = engine.queryContext(options.queryMessage, 5);
      graphRagContextSnippet = ctx.summary;
    }
  } catch (err: unknown) {
    logWarn(
      'ContextFusion',
      `GraphRag unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Reflection Stats ────────────────────────────────────────────────────────
  let reflection: ReflectionFusionStats | null = null;
  let reflectionContextSnippet = '';
  try {
    const engine = ReflectionEngine.getInstance();
    const stats = engine.getStats();
    const recentContext = engine.getReflectionContext();
    reflection = {
      totalReflections: stats.totalReflections,
      avgQualityScore: stats.avgQualityScore,
      selfModelHealth: stats.selfModelHealth,
      recentContext,
    };
    reflectionContextSnippet = recentContext;
  } catch (err: unknown) {
    logWarn(
      'ContextFusion',
      `ReflectionEngine unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── HybridMemory Stats ──────────────────────────────────────────────────────
  let memory: MemoryFusionStats | null = null;
  try {
    const hybridMemory = new HybridMemory();
    const count = await hybridMemory.getTableCount().catch(() => 0);
    memory = { indexedDocuments: count };
  } catch (err: unknown) {
    logWarn(
      'ContextFusion',
      `HybridMemory unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Compose Fusion Prompt ───────────────────────────────────────────────────
  const promptParts: string[] = [];

  if (graphRag) {
    promptParts.push(
      `📊 GraphRAG: ${graphRag.nodes} entitás, ${graphRag.edges} kapcsolat, ${graphRag.lessons} tanulság`,
    );
    if (graphRagContextSnippet) {
      promptParts.push(graphRagContextSnippet);
    }
  }

  if (reflection) {
    promptParts.push(
      `🔄 Reflexió: ${reflection.totalReflections} ciklus, átlag minőség ${(reflection.avgQualityScore * 100).toFixed(0)}%, self-model: ${reflection.selfModelHealth}`,
    );
    if (reflectionContextSnippet) {
      promptParts.push(reflectionContextSnippet);
    }
  }

  if (memory) {
    promptParts.push(`💾 Memória: ${memory.indexedDocuments} indexelt dokumentum`);
  }

  const fusionPrompt =
    promptParts.length > 0
      ? `\n🧠 Rendszer Kontextus (ContextFusion):\n${promptParts.join('\n')}`
      : '';

  // ── Optional Browser Diagnostics ────────────────────────────────────────────
  let browserDiagnostics: BrowserDiagnosticsCard | undefined;
  if (options.browserDiagnosticsUrl) {
    browserDiagnostics = await buildBrowserDiagnosticsCard(
      options.browserDiagnosticsUrl,
    ).catch(() => undefined);
  }

  return {
    generatedAt,
    graphRag,
    reflection,
    memory,
    fusionPrompt,
    browserDiagnostics,
  };
}

// ─── Browser Diagnostics Builder ──────────────────────────────────────────────

/**
 * Builds a concise browser diagnostics card using ChromeDevToolsAgent.
 *
 * **Safe:** If Chrome DevTools are unreachable or Playwright is not installed,
 * returns a card with `jsErrors: -1` and the error message in `rawSummary`.
 * Uses a dynamic import so the heavy Playwright dependency is tree-shaken
 * in environments where browser automation is not needed.
 *
 * @param url - The URL to analyse
 * @returns BrowserDiagnosticsCard with key browser health signals
 *
 * @example
 * const diag = await buildBrowserDiagnosticsCard('http://localhost:5173');
 * if (diag.jsErrors > 0) logWarn('...');
 */
export async function buildBrowserDiagnosticsCard(
  url: string,
): Promise<BrowserDiagnosticsCard> {
  const capturedAt = new Date().toISOString();

  try {
    // Dynamic import keeps Playwright tree-shakeable when unused
    const { ChromeDevToolsAgent } = await import('../agents/ChromeDevToolsAgent.js');
    const agent = new ChromeDevToolsAgent();
    const result = await agent.execute(`Debug ${url}`, { url, capability: 'report' });

    if (result.status === 'error') {
      return {
        url,
        capturedAt,
        jsErrors: -1,
        networkErrors: -1,
        performanceSummary: 'Debug futtatás sikertelen',
        rawSummary: result.error ?? 'Ismeretlen hiba',
      };
    }

    // result.data is { report: DebugReport, markdown: string }
    const payload = result.data as {
      report?: {
        console?: { errors?: unknown[] };
        network?: { failedRequests?: number };
        performance?: { firstContentfulPaint?: number; pageLoadTime?: number };
        summary?: string;
      };
      markdown?: string;
    } | undefined;

    const jsErrors = payload?.report?.console?.errors?.length ?? 0;
    const networkErrors = payload?.report?.network?.failedRequests ?? 0;
    const fcp = payload?.report?.performance?.firstContentfulPaint;
    const load = payload?.report?.performance?.pageLoadTime;

    const performanceSummary =
      fcp !== undefined && load !== undefined
        ? `FCP: ${fcp.toFixed(0)}ms, betöltés: ${load.toFixed(0)}ms`
        : 'Teljesítmény adatok nem elérhetők';

    return {
      url,
      capturedAt,
      jsErrors,
      networkErrors,
      performanceSummary,
      rawSummary: payload?.report?.summary ?? payload?.markdown ?? '',
    };
  } catch (err: unknown) {
    return {
      url,
      capturedAt,
      jsErrors: -1,
      networkErrors: -1,
      performanceSummary: 'Chrome DevTools nem elérhető',
      rawSummary: `Hiba: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
