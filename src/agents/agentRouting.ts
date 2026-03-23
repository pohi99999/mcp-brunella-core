import type { AgentConfig, RegistryConfig } from "./registryStandard.js";

export type RoutingRuntimeStatus = "idle" | "working" | "error" | "unloaded";

export interface AgentRoutingRuntimeInfo {
  status: RoutingRuntimeStatus;
  successCount: number;
  errorCount: number;
}

export interface AgentRoutingDecision {
  agentName: string | null;
  strategy: "rule" | "trigger" | "capability" | "default";
  reason: string;
  scores: Array<{ name: string; score: number }>;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9áéíóöőúüű]+/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function includesPhrase(haystack: string, needle: string): boolean {
  return haystack.includes(needle.toLowerCase());
}

function scoreKeywordList(source: string, terms: string[], weight: number): number {
  return terms.reduce((score, term) => {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return score;
    return includesPhrase(source, normalized) ? score + weight : score;
  }, 0);
}

function scoreTokenOverlap(tokens: Set<string>, phrases: string[], weight: number): number {
  return phrases.reduce((score, phrase) => {
    const phraseTokens = tokenize(phrase);
    if (phraseTokens.length === 0) return score;
    const overlap = phraseTokens.filter((token) => tokens.has(token)).length;
    return overlap > 0 ? score + overlap * weight : score;
  }, 0);
}

function scoreRuntime(runtime: AgentRoutingRuntimeInfo | undefined): number {
  if (!runtime) return 0;
  if (runtime.status === "error") return -30;
  if (runtime.status === "working") return 1;
  if (runtime.status === "idle") return 6;
  return 0;
}

function scoreMetadata(agent: AgentConfig): number {
  const metadata = agent.metadataStandard;
  if (!metadata) return agent.priority ?? 0;

  let score = metadata.priority;
  if (metadata.costTier === "low") score += 4;
  if (metadata.costTier === "medium") score += 2;
  if (metadata.executionMode === "local") score += 3;
  if (metadata.executionMode === "hybrid") score += 1;
  if (metadata.status === "experimental") score -= 2;
  if (metadata.status === "disabled") score -= 1000;
  return score;
}

function scoreAgent(agent: AgentConfig, instruction: string, instructionTokens: Set<string>, runtime: AgentRoutingRuntimeInfo | undefined): number {
  const metadata = agent.metadataStandard;
  const capabilities = metadata?.capabilities ?? agent.capabilities ?? [];
  const triggers = metadata?.triggers ?? agent.triggers ?? [];
  const tags = metadata?.tags ?? agent.tags ?? [];
  const category = metadata?.category ? [metadata.category] : [];

  let score = 0;
  score += scoreKeywordList(instruction, triggers, 50);
  score += scoreTokenOverlap(instructionTokens, capabilities, 9);
  score += scoreTokenOverlap(instructionTokens, tags, 4);
  score += scoreTokenOverlap(instructionTokens, category, 3);
  score += scoreMetadata(agent);
  score += scoreRuntime(runtime);
  return score;
}

export function selectAgentForInstruction(
  instruction: string,
  registry: RegistryConfig,
  runtimeByAgent: Map<string, AgentRoutingRuntimeInfo>,
): AgentRoutingDecision {
  const lowerInstruction = instruction.toLowerCase();

  for (const rule of registry.routingRules) {
    const regex = new RegExp(rule.pattern, "i");
    if (regex.test(lowerInstruction)) {
      return {
        agentName: rule.agent,
        strategy: "rule",
        reason: `routing rule matched: ${rule.pattern}`,
        scores: [{ name: rule.agent, score: Number.POSITIVE_INFINITY }],
      };
    }
  }

  const instructionTokens = new Set(tokenize(lowerInstruction));
  const scoredAgents = registry.agents.map((agent) => ({
    name: agent.name,
    score: scoreAgent(agent, lowerInstruction, instructionTokens, runtimeByAgent.get(agent.name)),
  }));

  scoredAgents.sort((left, right) => right.score - left.score);
  const winner = scoredAgents[0];
  if (!winner || winner.score <= 0) {
    return {
      agentName: registry.defaultAgent,
      strategy: "default",
      reason: "no routing rule, trigger or capability match exceeded threshold",
      scores: scoredAgents,
    };
  }

  const winningAgent = registry.agents.find((agent) => agent.name === winner.name);
  const hasTriggerMatch = (winningAgent?.triggers ?? []).some((trigger) => includesPhrase(lowerInstruction, trigger));

  return {
    agentName: winner.name,
    strategy: hasTriggerMatch ? "trigger" : "capability",
    reason: hasTriggerMatch ? "trigger match with runtime-aware scoring" : "capability/metadata/runtime score winner",
    scores: scoredAgents,
  };
}
