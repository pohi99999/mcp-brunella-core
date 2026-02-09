// FILE: src/core/modelRouter.ts
// PURPOSE: Intelligent model routing — Brain vs Muscle selection (G3.1)
// RULES: RULE-MR1 (high→Cloud), RULE-MR2 (low→Ollama), RULE-MR3 (budget=0→Ollama), RULE-MR4 (fallback)

import { logInfo, logError } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type ModelRole = 'brain' | 'muscle';
export type ModelSpeed = 'fast' | 'medium' | 'slow';
export type TaskComplexity = 'high' | 'medium' | 'low';
export type ProviderName = 'ollama' | 'gemini' | 'github';

export interface ModelProfile {
  name: string;
  provider: ProviderName;
  role: ModelRole;
  contextWindow: number;
  costPerToken: number;    // 0 = local/free
  speed: ModelSpeed;
  strengths: string[];
}

export interface TaskProfile {
  description: string;
  complexity: TaskComplexity;
  category?: string;       // 'planning' | 'code_gen' | 'test' | 'docs' | 'analysis' | 'debug'
  requiredStrengths?: string[];
  maxCostUsd?: number;     // per-request budget cap
}

export interface RouterConfig {
  budget: number;            // 0-100 scale, 0 = Ollama only
  preferLocal: boolean;      // default: true
  fallbackEnabled: boolean;  // default: true
  overrideModel?: string;    // Force a specific model (manual override)
  overrideProvider?: ProviderName;
}

export interface RoutingDecision {
  model: ModelProfile;
  reason: string;
  fallback?: ModelProfile;
  timestamp: number;
}

// ============================================================================
// MODEL REGISTRY
// ============================================================================

export const MODEL_REGISTRY: ModelProfile[] = [
  // Brain models (Cloud) — planning, architecture, complex analysis
  {
    name: 'gpt-4o',
    provider: 'github',
    role: 'brain',
    contextWindow: 128000,
    costPerToken: 0.005,
    speed: 'medium',
    strengths: ['planning', 'architecture', 'analysis', 'complex_reasoning', 'code_review']
  },
  {
    name: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    provider: 'gemini',
    role: 'brain',
    contextWindow: 1000000,
    costPerToken: 0.0001,
    speed: 'fast',
    strengths: ['planning', 'analysis', 'long_context', 'documentation', 'summarization']
  },
  // Muscle models (Ollama local) — code gen, tests, repetitive tasks
  {
    name: process.env.OLLAMA_MODEL || 'llama3.1:8b',
    provider: 'ollama',
    role: 'muscle',
    contextWindow: 32768,
    costPerToken: 0,
    speed: 'fast',
    strengths: ['code_gen', 'test_gen', 'docs', 'translation', 'simple_tasks']
  },
  {
    name: 'qwen2.5-coder:7b',
    provider: 'ollama',
    role: 'muscle',
    contextWindow: 32768,
    costPerToken: 0,
    speed: 'fast',
    strengths: ['code_gen', 'refactor', 'debug', 'test_gen']
  }
];

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: RouterConfig = {
  budget: parseInt(process.env.ROUTER_BUDGET || '50', 10),
  preferLocal: process.env.ROUTER_PREFER_LOCAL !== 'false',
  fallbackEnabled: process.env.ROUTER_FALLBACK !== 'false',
  overrideModel: process.env.ROUTER_OVERRIDE_MODEL,
  overrideProvider: process.env.ROUTER_OVERRIDE_PROVIDER as ProviderName | undefined
};

// ============================================================================
// COMPLEXITY DETECTION
// ============================================================================

const HIGH_COMPLEXITY_PATTERNS = [
  /architect/i, /design.*(system|api|schema)/i, /plan/i, /strateg/i,
  /refactor.*large/i, /review.*code/i, /analyz/i, /evaluat/i,
  /debug.*complex/i, /migration/i, /security.*audit/i
];

const LOW_COMPLEXITY_PATTERNS = [
  /write.*test/i, /generate.*test/i, /fix.*lint/i, /format/i,
  /translate/i, /docstring/i, /comment/i, /rename/i,
  /simple.*fix/i, /typo/i, /update.*import/i, /add.*log/i
];

/**
 * Auto-detect task complexity from description.
 */
export function detectComplexity(description: string): TaskComplexity {
  for (const pattern of HIGH_COMPLEXITY_PATTERNS) {
    if (pattern.test(description)) return 'high';
  }
  for (const pattern of LOW_COMPLEXITY_PATTERNS) {
    if (pattern.test(description)) return 'low';
  }
  // Medium by default
  return 'medium';
}

/**
 * Detect task category from description.
 */
export function detectCategory(description: string): string {
  const lower = description.toLowerCase();
  if (/plan|architect|design|strateg/.test(lower)) return 'planning';
  if (/test|spec|vitest|jest/.test(lower)) return 'test';
  if (/doc|readme|comment|jsdoc/.test(lower)) return 'docs';
  if (/debug|fix|error|bug/.test(lower)) return 'debug';
  if (/analy|review|audit|evaluat/.test(lower)) return 'analysis';
  return 'code_gen';
}

// ============================================================================
// ROUTING DECISIONS LOG
// ============================================================================

const routingHistory: RoutingDecision[] = [];
const MAX_HISTORY = 200;

function recordDecision(decision: RoutingDecision): void {
  routingHistory.push(decision);
  if (routingHistory.length > MAX_HISTORY) {
    routingHistory.splice(0, routingHistory.length - MAX_HISTORY);
  }
}

// ============================================================================
// CORE ROUTER
// ============================================================================

/**
 * Select the best model for a given task profile.
 * Implements RULE-MR1 through RULE-MR4.
 */
export function selectModel(task: TaskProfile, config: Partial<RouterConfig> = {}): RoutingDecision {
  const cfg: RouterConfig = { ...DEFAULT_CONFIG, ...config };

  // Manual override (highest priority)
  if (cfg.overrideModel) {
    const overrideProfile = MODEL_REGISTRY.find(m => m.name === cfg.overrideModel)
      || MODEL_REGISTRY.find(m => m.provider === cfg.overrideProvider)
      || MODEL_REGISTRY[0];
    
    const decision: RoutingDecision = {
      model: overrideProfile,
      reason: `Manual override: ${cfg.overrideModel}`,
      timestamp: Date.now()
    };
    recordDecision(decision);
    return decision;
  }

  // RULE-MR3: budget === 0 → exclusively Ollama
  if (cfg.budget === 0) {
    const ollamaModel = findBestOllama(task);
    const decision: RoutingDecision = {
      model: ollamaModel,
      reason: 'RULE-MR3: Budget=0, Ollama only',
      timestamp: Date.now()
    };
    logInfo('ModelRouter', `[MR3] Budget=0 → ${ollamaModel.name}`);
    recordDecision(decision);
    return decision;
  }

  // RULE-MR1: high complexity → Cloud model
  if (task.complexity === 'high') {
    const cloudModel = findBestCloud(task, cfg);
    const fallback = cfg.fallbackEnabled ? findBestOllama(task) : undefined;
    
    const decision: RoutingDecision = {
      model: cloudModel,
      reason: `RULE-MR1: High complexity (${task.category || 'unknown'}) → ${cloudModel.provider}`,
      fallback,
      timestamp: Date.now()
    };
    logInfo('ModelRouter', `[MR1] High complexity → ${cloudModel.name} (${cloudModel.provider})`);
    recordDecision(decision);
    return decision;
  }

  // RULE-MR2: low complexity → Ollama local
  if (task.complexity === 'low') {
    const ollamaModel = findBestOllama(task);
    const decision: RoutingDecision = {
      model: ollamaModel,
      reason: `RULE-MR2: Low complexity (${task.category || 'unknown'}) → Ollama local`,
      timestamp: Date.now()
    };
    logInfo('ModelRouter', `[MR2] Low complexity → ${ollamaModel.name}`);
    recordDecision(decision);
    return decision;
  }

  // Medium complexity: prefer local if configured, otherwise choose by strengths
  if (cfg.preferLocal) {
    const ollamaModel = findBestOllama(task);
    const decision: RoutingDecision = {
      model: ollamaModel,
      reason: `Medium complexity + preferLocal → Ollama`,
      fallback: cfg.fallbackEnabled ? findBestCloud(task, cfg) : undefined,
      timestamp: Date.now()
    };
    logInfo('ModelRouter', `[Medium+Local] → ${ollamaModel.name}`);
    recordDecision(decision);
    return decision;
  }

  // Medium complexity, no preferLocal: pick best match by strengths
  const bestMatch = findBestByStrengths(task);
  const decision: RoutingDecision = {
    model: bestMatch,
    reason: `Medium complexity, best strength match → ${bestMatch.name}`,
    fallback: cfg.fallbackEnabled ? findBestOllama(task) : undefined,
    timestamp: Date.now()
  };
  logInfo('ModelRouter', `[Medium+Strength] → ${bestMatch.name}`);
  recordDecision(decision);
  return decision;
}

/**
 * Convenience: auto-detect complexity and select model.
 */
export function routeTask(description: string, config: Partial<RouterConfig> = {}): RoutingDecision {
  const complexity = detectComplexity(description);
  const category = detectCategory(description);

  const taskProfile: TaskProfile = {
    description,
    complexity,
    category
  };

  return selectModel(taskProfile, config);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findBestOllama(task: TaskProfile): ModelProfile {
  const ollamaModels = MODEL_REGISTRY.filter(m => m.provider === 'ollama');
  if (ollamaModels.length === 0) {
    // Fallback to first model in registry
    return MODEL_REGISTRY[0];
  }

  // Score by matching strengths
  const scored = ollamaModels.map(m => ({
    model: m,
    score: scoreByStrengths(m, task)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].model;
}

function findBestCloud(task: TaskProfile, cfg: RouterConfig): ModelProfile {
  const cloudModels = MODEL_REGISTRY.filter(m => m.provider !== 'ollama');
  if (cloudModels.length === 0) {
    // RULE-MR4: no cloud available → fallback to Ollama
    logInfo('ModelRouter', '[MR4] No cloud models available, falling back to Ollama');
    return findBestOllama(task);
  }

  // Check API key availability
  const available = cloudModels.filter(m => {
    if (m.provider === 'gemini') return !!process.env.GEMINI_API_KEY;
    if (m.provider === 'github') return !!(process.env.GITHUB_TOKEN || process.env.GITHUB_PAT);
    return true;
  });

  if (available.length === 0) {
    // RULE-MR4: cloud not reachable → fallback to Ollama + warning
    logInfo('ModelRouter', '[MR4] No cloud API keys configured, falling back to Ollama');
    return findBestOllama(task);
  }

  // Score available cloud models by strengths
  const scored = available.map(m => ({
    model: m,
    score: scoreByStrengths(m, task)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].model;
}

function findBestByStrengths(task: TaskProfile): ModelProfile {
  const scored = MODEL_REGISTRY.map(m => ({
    model: m,
    score: scoreByStrengths(m, task)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].model;
}

function scoreByStrengths(model: ModelProfile, task: TaskProfile): number {
  let score = 0;

  // Category match
  if (task.category && model.strengths.includes(task.category)) {
    score += 10;
  }

  // Required strengths match
  if (task.requiredStrengths) {
    for (const req of task.requiredStrengths) {
      if (model.strengths.includes(req)) score += 5;
    }
  }

  // Speed bonus
  if (model.speed === 'fast') score += 3;
  else if (model.speed === 'medium') score += 1;

  // Cost efficiency bonus (prefer free)
  if (model.costPerToken === 0) score += 2;

  return score;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all registered model profiles.
 */
export function getModelProfiles(): ModelProfile[] {
  return [...MODEL_REGISTRY];
}

/**
 * Get routing decision history.
 */
export function getRoutingHistory(): RoutingDecision[] {
  return [...routingHistory];
}

/**
 * Get recent routing decisions (for CLI/API).
 * Returns last N decisions with flattened data for display.
 */
export function getRecentDecisions(limit= 50): Array<{
  timestamp: string;
  task: string;
  category: string;
  selectedModel: string;
  reason: string;
}> {
  const recent = routingHistory.slice(-limit);
  return recent.map(d => ({
    timestamp: new Date(d.timestamp).toISOString(),
    task: d.reason,
    category: d.model.role, // brain or muscle
    selectedModel: d.model.name,
    reason: d.reason,
  }));
}

/**
 * Clear routing history.
 */
export function clearRoutingHistory(): void {
  routingHistory.length = 0;
}

/**
 * Get current default router config.
 */
export function getRouterConfig(): RouterConfig {
  return { ...DEFAULT_CONFIG };
}
