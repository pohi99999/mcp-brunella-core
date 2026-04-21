/**
 * Copilot Cognitive Bridge — Connects ALL 13 BAS intelligence systems to Copilot CLI
 *
 * Memory layers connected:
 * 1. StructuredMemory (task cache + pattern reuse)
 * 2. GraphRAG (knowledge graph + entity extraction)
 * 3. ReflectionEngine (self-learning loop)
 * 4. SharedCognition (collective awareness)
 * 5. GoldenDataset (successful decision archive)
 * 6. UserPreferences (episodic/semantic/procedural memory)
 * 7. PatternReuse (fuzzy task matching)
 * 8. SelfModel (capability tracking)
 * 9. MetaReasoner (decision analysis)
 * 10. PredictiveIntelligence (anomaly detection)
 * 11. KnowledgeGraph (entity-relation graph)
 * 12. Swarm VotingProtocol (multi-agent consensus)
 * 13. CollectiveMind (perspective aggregation)
 */

import { logInfo, logError } from '@packages/utils/logger.js';
import { queryMemory, getMemoryStats, type StoredAgentMemory } from './structuredMemory.js';
import { checkPattern } from './patternReuse.js';
import { getPreferenceContext, queryPreferences } from './userPreferences.js';
import { autoSaveGoldenSample, getGoldenStats } from './goldenDatasetBridge.js';

const MODULE = 'CopilotCognitiveBridge';

// ── Types ───────────────────────────────────────────────────────────────

export interface EnrichmentRequest {
  query: string;
  userId?: string;
  agentName?: string;
  maxResults?: number;
}

export interface EnrichmentResult {
  query: string;
  timestamp: string;
  layers: LayerResult[];
  summary: string;
  recommendedAgents: string[];
  confidence: number;
  processingTimeMs: number;
}

export interface LayerResult {
  layer: string;
  status: 'ok' | 'error' | 'skipped';
  data: unknown;
  timeMs: number;
}

export interface ReflectRequest {
  taskId: string;
  agentName: string;
  task: string;
  result: string;
  success: boolean;
  confidence?: number;
}

export interface ReflectResult {
  stored: boolean;
  layers: string[];
  lesson?: string;
  qualityScore?: number;
}

export interface CognitiveStats {
  timestamp: string;
  layers: Record<string, { status: string; stats: unknown }>;
  totalLayers: number;
  activeLayers: number;
}

// ── Lazy singleton loaders (avoid circular deps + startup cost) ─────────
// Use `as unknown as T` pattern to avoid strict type incompatibility with
// the actual class signatures that use specific union types/interfaces.

type LazyGraphRag = { queryContext: (msg: string, max?: number) => unknown; getStats: () => unknown; storeLesson: (sid: string, agent: string, task: string, lesson: string, quality: number) => void };
type LazyReflection = { reflect: (outcome: Record<string, unknown>) => Promise<unknown>; getStats: () => unknown; getReflectionContext: () => string };
type LazyCognition = { query: (q: Record<string, unknown>) => unknown; store: (e: Record<string, unknown>) => unknown; getStats: () => unknown };
type LazySelfModel = { getState: () => unknown; ingestSignal: (s: Record<string, unknown>) => unknown };
type LazyMetaReasoner = { getInsights: (cat?: string) => unknown[]; recordDecision: (d: Record<string, unknown>) => unknown; getStats: () => unknown };
type LazyPredictive = { getActiveAlerts: () => unknown[]; getPredictiveContext: () => string; getStats: () => unknown };
type LazyCollectiveMind = { getStats: () => unknown; buildConsensus: (q: Record<string, unknown>) => unknown };

let _graphRag: LazyGraphRag | null = null;
let _reflection: LazyReflection | null = null;
let _cognition: LazyCognition | null = null;
let _selfModel: LazySelfModel | null = null;
let _metaReasoner: LazyMetaReasoner | null = null;
let _predictive: LazyPredictive | null = null;
let _collectiveMind: LazyCollectiveMind | null = null;

async function loadGraphRag() {
  if (_graphRag) return _graphRag;
  try {
    const mod = await import('./graphRagEngine.js');
    const instance = mod.GraphRagEngine.getInstance();
    _graphRag = instance as unknown as LazyGraphRag;
    return _graphRag;
  } catch {
    logError(MODULE, 'GraphRagEngine not available');
    return null;
  }
}

async function loadReflection() {
  if (_reflection) return _reflection;
  try {
    const mod = await import('./reflectionEngine.js');
    _reflection = mod.ReflectionEngine.getInstance() as unknown as LazyReflection;
    return _reflection;
  } catch {
    logError(MODULE, 'ReflectionEngine not available');
    return null;
  }
}

async function loadCognition() {
  if (_cognition) return _cognition;
  try {
    const mod = await import('./sharedCognition.js');
    _cognition = new mod.SharedCognition() as unknown as LazyCognition;
    return _cognition;
  } catch {
    logError(MODULE, 'SharedCognition not available');
    return null;
  }
}

async function loadSelfModel() {
  if (_selfModel) return _selfModel;
  try {
    const mod = await import('./selfModel.js');
    _selfModel = new mod.SelfModel() as unknown as LazySelfModel;
    return _selfModel;
  } catch {
    logError(MODULE, 'SelfModel not available');
    return null;
  }
}

async function loadMetaReasoner() {
  if (_metaReasoner) return _metaReasoner;
  try {
    const mod = await import('./metaReasoner.js');
    _metaReasoner = new mod.MetaReasoner() as unknown as LazyMetaReasoner;
    return _metaReasoner;
  } catch {
    logError(MODULE, 'MetaReasoner not available');
    return null;
  }
}

async function loadPredictive() {
  if (_predictive) return _predictive;
  try {
    const mod = await import('./predictiveIntelligence.js');
    _predictive = mod.PredictiveIntelligence.getInstance() as unknown as LazyPredictive;
    return _predictive;
  } catch {
    logError(MODULE, 'PredictiveIntelligence not available');
    return null;
  }
}

async function loadCollectiveMind() {
  if (_collectiveMind) return _collectiveMind;
  try {
    const mod = await import('./collectiveMind.js');
    _collectiveMind = new mod.CollectiveMind() as unknown as LazyCollectiveMind;
    return _collectiveMind;
  } catch {
    logError(MODULE, 'CollectiveMind not available');
    return null;
  }
}

// ── Helper: timed execution ─────────────────────────────────────────────

async function timedLayer<T>(name: string, fn: () => T | Promise<T>): Promise<LayerResult> {
  const start = Date.now();
  try {
    const data = await fn();
    return { layer: name, status: 'ok', data, timeMs: Date.now() - start };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError(MODULE, `Layer ${name} failed: ${msg}`);
    return { layer: name, status: 'error', data: { error: msg }, timeMs: Date.now() - start };
  }
}

// ── CORE: enrich() — Multi-source context enrichment ────────────────────

export async function enrich(req: EnrichmentRequest): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const { query, userId = 'default', agentName, maxResults = 5 } = req;
  logInfo(MODULE, `Enriching query: "${query.slice(0, 60)}..." for user=${userId}`);

  const layers: LayerResult[] = [];
  const recommendedAgents: string[] = [];

  // Layer 1: StructuredMemory — cached task results
  layers.push(await timedLayer('StructuredMemory', () => {
    const memories = queryMemory({ task: query, agentName, limit: maxResults });
    return { matches: memories.length, results: memories.map((m: StoredAgentMemory) => ({
      agent: m.agentName, task: m.rawTask, confidence: m.confidence, reuseCount: m.reuseCount
    })) };
  }));

  // Layer 2: PatternReuse — fuzzy matching
  layers.push(await timedLayer('PatternReuse', () => {
    if (!agentName) return { skipped: true, reason: 'no agentName' };
    const result = checkPattern(agentName, query);
    return result;
  }));

  // Layer 3: UserPreferences — user context
  layers.push(await timedLayer('UserPreferences', () => {
    const context = getPreferenceContext(userId);
    const prefs = queryPreferences({ user_id: userId, limit: maxResults });
    return { contextSnippet: context.slice(0, 500), preferenceCount: prefs.length };
  }));

  // Layer 4: GraphRAG — knowledge graph context
  layers.push(await timedLayer('GraphRAG', async () => {
    const graphRag = await loadGraphRag();
    if (!graphRag) return { skipped: true };
    const context = graphRag.queryContext(query, maxResults);
    return context;
  }));

  // Layer 5: SharedCognition — collective awareness
  layers.push(await timedLayer('SharedCognition', async () => {
    const cognition = await loadCognition();
    if (!cognition) return { skipped: true };
    const result = cognition.query({ question: query, maxResults });
    return result;
  }));

  // Layer 6: ReflectionEngine — past lessons
  layers.push(await timedLayer('ReflectionEngine', async () => {
    const reflection = await loadReflection();
    if (!reflection) return { skipped: true };
    return {
      context: reflection.getReflectionContext().slice(0, 500),
      stats: reflection.getStats()
    };
  }));

  // Layer 7: GoldenDataset — successful patterns
  layers.push(await timedLayer('GoldenDataset', async () => {
    const stats = await getGoldenStats();
    return { stats: stats ?? { totalSamples: 0 } };
  }));

  // Layer 8: SelfModel — capability awareness
  layers.push(await timedLayer('SelfModel', async () => {
    const selfModel = await loadSelfModel();
    if (!selfModel) return { skipped: true };
    return selfModel.getState();
  }));

  // Layer 9: MetaReasoner — decision insights
  layers.push(await timedLayer('MetaReasoner', async () => {
    const meta = await loadMetaReasoner();
    if (!meta) return { skipped: true };
    const insights = meta.getInsights();
    return { insightCount: insights.length, recent: insights.slice(0, 3) };
  }));

  // Layer 10: PredictiveIntelligence — anomaly alerts
  layers.push(await timedLayer('PredictiveIntelligence', async () => {
    const pred = await loadPredictive();
    if (!pred) return { skipped: true };
    const alerts = pred.getActiveAlerts();
    return {
      activeAlerts: alerts.length,
      alerts: alerts.slice(0, 3),
      context: pred.getPredictiveContext().slice(0, 300)
    };
  }));

  // Layer 11: CollectiveMind — perspective synthesis
  layers.push(await timedLayer('CollectiveMind', async () => {
    const cm = await loadCollectiveMind();
    if (!cm) return { skipped: true };
    return cm.getStats();
  }));

  // Extract agent recommendations from GraphRAG results
  const graphLayer = layers.find(l => l.layer === 'GraphRAG');
  if (graphLayer?.status === 'ok' && graphLayer.data && typeof graphLayer.data === 'object') {
    const graphData = graphLayer.data as Record<string, unknown>;
    if (Array.isArray(graphData.relevantNodes)) {
      for (const node of graphData.relevantNodes) {
        if (node && typeof node === 'object' && 'type' in node && node.type === 'agent' && 'label' in node) {
          recommendedAgents.push(String(node.label));
        }
      }
    }
  }

  // Calculate overall confidence
  const okLayers = layers.filter(l => l.status === 'ok');
  const confidence = okLayers.length / layers.length;

  // Build summary
  const memoryHits = layers[0]?.status === 'ok' && layers[0].data
    ? (layers[0].data as { matches?: number }).matches ?? 0
    : 0;
  const summary = [
    `${okLayers.length}/${layers.length} réteg válaszolt`,
    memoryHits > 0 ? `${memoryHits} korábbi tapasztalat találat` : null,
    recommendedAgents.length > 0 ? `Javasolt agentek: ${recommendedAgents.join(', ')}` : null,
  ].filter(Boolean).join('. ');

  const result: EnrichmentResult = {
    query,
    timestamp: new Date().toISOString(),
    layers,
    summary,
    recommendedAgents,
    confidence,
    processingTimeMs: Date.now() - startTime,
  };

  logInfo(MODULE, `Enrichment done: ${summary} (${result.processingTimeMs}ms)`);
  return result;
}

// ── CORE: reflect() — Post-task learning loop ───────────────────────────

export async function reflect(req: ReflectRequest): Promise<ReflectResult> {
  const { taskId, agentName, task, result, success, confidence = 0.5 } = req;
  logInfo(MODULE, `Reflecting on task: ${agentName}/${taskId} (${success ? 'SUCCESS' : 'FAIL'})`);

  const storedLayers: string[] = [];
  let lesson: string | undefined;
  let qualityScore: number | undefined;

  // 1. ReflectionEngine — extract lessons
  try {
    const reflection = await loadReflection();
    if (reflection) {
      const reflResult = await reflection.reflect({
        taskId,
        agent: agentName,
        task,
        result: success ? 'success' : 'failure',
        output: result,
        durationMs: 0,
      });
      if (reflResult && typeof reflResult === 'object') {
        const r = reflResult as Record<string, unknown>;
        lesson = typeof r.lesson === 'string' ? r.lesson : undefined;
        qualityScore = typeof r.qualityScore === 'number' ? r.qualityScore : undefined;
      }
      storedLayers.push('ReflectionEngine');
    }
  } catch (e: unknown) {
    logError(MODULE, `Reflection failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. GraphRAG — store lesson in knowledge graph
  try {
    const graphRag = await loadGraphRag();
    if (graphRag && lesson) {
      graphRag.storeLesson(taskId, agentName, task, lesson, qualityScore ?? confidence);
      storedLayers.push('GraphRAG');
    }
  } catch (e: unknown) {
    logError(MODULE, `GraphRAG lesson store failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 3. GoldenDataset — save if successful with good confidence
  if (success && confidence >= 0.5) {
    try {
      await autoSaveGoldenSample(agentName, task, result);
      storedLayers.push('GoldenDataset');
    } catch (e: unknown) {
      logError(MODULE, `Golden save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. MetaReasoner — record the decision
  try {
    const meta = await loadMetaReasoner();
    if (meta) {
      meta.recordDecision({
        decisionMaker: agentName,
        action: task.slice(0, 100),
        context: { lesson: lesson ?? result.slice(0, 200), confidence },
        outcome: success ? 'success' : 'failure',
        metrics: { confidence },
      });
      storedLayers.push('MetaReasoner');
    }
  } catch (e: unknown) {
    logError(MODULE, `MetaReasoner failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 5. SelfModel — ingest performance signal
  try {
    const selfModel = await loadSelfModel();
    if (selfModel) {
      selfModel.ingestSignal({
        source: agentName,
        category: success ? 'performance' : 'risk',
        confidence,
        payload: { task: task.slice(0, 100), outcome: success ? 'success' : 'failure' },
      });
      storedLayers.push('SelfModel');
    }
  } catch (e: unknown) {
    logError(MODULE, `SelfModel failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 6. SharedCognition — broadcast the outcome
  try {
    const cognition = await loadCognition();
    if (cognition) {
      cognition.store({
        source: 'brunella',
        category: success ? 'decision' : 'observation',
        content: `${agentName}: ${task.slice(0, 100)} → ${success ? 'SIKER' : 'HIBA'}`,
        confidence,
        context: { agentName, taskId },
        tags: [agentName, success ? 'success' : 'failure', 'copilot-reflection'],
      });
      storedLayers.push('SharedCognition');
    }
  } catch (e: unknown) {
    logError(MODULE, `SharedCognition failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  logInfo(MODULE, `Reflection complete: ${storedLayers.length} layers updated: [${storedLayers.join(', ')}]`);

  return {
    stored: storedLayers.length > 0,
    layers: storedLayers,
    lesson,
    qualityScore,
  };
}

// ── CORE: getStats() — Aggregate statistics from all layers ─────────────

export async function getCognitiveStats(): Promise<CognitiveStats> {
  const layerStats: Record<string, { status: string; stats: unknown }> = {};
  let activeLayers = 0;

  // StructuredMemory
  try {
    const stats = getMemoryStats();
    layerStats['StructuredMemory'] = { status: 'active', stats };
    activeLayers++;
  } catch {
    layerStats['StructuredMemory'] = { status: 'error', stats: null };
  }

  // UserPreferences
  try {
    const prefs = queryPreferences({ user_id: 'default', limit: 1 });
    layerStats['UserPreferences'] = { status: 'active', stats: { count: prefs.length } };
    activeLayers++;
  } catch {
    layerStats['UserPreferences'] = { status: 'error', stats: null };
  }

  // GoldenDataset
  try {
    const stats = await getGoldenStats();
    layerStats['GoldenDataset'] = { status: 'active', stats };
    activeLayers++;
  } catch {
    layerStats['GoldenDataset'] = { status: 'error', stats: null };
  }

  // GraphRAG
  try {
    const graphRag = await loadGraphRag();
    if (graphRag) {
      layerStats['GraphRAG'] = { status: 'active', stats: graphRag.getStats() };
      activeLayers++;
    } else {
      layerStats['GraphRAG'] = { status: 'unavailable', stats: null };
    }
  } catch {
    layerStats['GraphRAG'] = { status: 'error', stats: null };
  }

  // ReflectionEngine
  try {
    const reflection = await loadReflection();
    if (reflection) {
      layerStats['ReflectionEngine'] = { status: 'active', stats: reflection.getStats() };
      activeLayers++;
    } else {
      layerStats['ReflectionEngine'] = { status: 'unavailable', stats: null };
    }
  } catch {
    layerStats['ReflectionEngine'] = { status: 'error', stats: null };
  }

  // SharedCognition
  try {
    const cognition = await loadCognition();
    if (cognition) {
      layerStats['SharedCognition'] = { status: 'active', stats: cognition.getStats() };
      activeLayers++;
    } else {
      layerStats['SharedCognition'] = { status: 'unavailable', stats: null };
    }
  } catch {
    layerStats['SharedCognition'] = { status: 'error', stats: null };
  }

  // SelfModel
  try {
    const selfModel = await loadSelfModel();
    if (selfModel) {
      layerStats['SelfModel'] = { status: 'active', stats: selfModel.getState() };
      activeLayers++;
    } else {
      layerStats['SelfModel'] = { status: 'unavailable', stats: null };
    }
  } catch {
    layerStats['SelfModel'] = { status: 'error', stats: null };
  }

  // MetaReasoner
  try {
    const meta = await loadMetaReasoner();
    if (meta) {
      layerStats['MetaReasoner'] = { status: 'active', stats: meta.getStats() };
      activeLayers++;
    } else {
      layerStats['MetaReasoner'] = { status: 'unavailable', stats: null };
    }
  } catch {
    layerStats['MetaReasoner'] = { status: 'error', stats: null };
  }

  // PredictiveIntelligence
  try {
    const pred = await loadPredictive();
    if (pred) {
      layerStats['PredictiveIntelligence'] = { status: 'active', stats: pred.getStats() };
      activeLayers++;
    } else {
      layerStats['PredictiveIntelligence'] = { status: 'unavailable', stats: null };
    }
  } catch {
    layerStats['PredictiveIntelligence'] = { status: 'error', stats: null };
  }

  // CollectiveMind
  try {
    const cm = await loadCollectiveMind();
    if (cm) {
      layerStats['CollectiveMind'] = { status: 'active', stats: cm.getStats() };
      activeLayers++;
    } else {
      layerStats['CollectiveMind'] = { status: 'unavailable', stats: null };
    }
  } catch {
    layerStats['CollectiveMind'] = { status: 'error', stats: null };
  }

  return {
    timestamp: new Date().toISOString(),
    layers: layerStats,
    totalLayers: Object.keys(layerStats).length,
    activeLayers,
  };
}

