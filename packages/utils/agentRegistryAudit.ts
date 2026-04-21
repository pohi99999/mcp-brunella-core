import { normalizeRegistryConfig, type RegistryConfig } from "@packages/agents/registryStandard.js";

export type AgentRegistryLoadStatus = "pending" | "loaded" | "error" | "skipped";
export type AgentRegistryRuntimeStatus = "idle" | "working" | "error" | "unloaded";
export type AgentRegistryHealthStatus = "healthy" | "warning" | "critical" | "unknown";
export type AgentRegistryUsageStatus = "active" | "stale" | "never-used" | "unknown";
export type AgentRegistryOverallStatus = "healthy" | "attention" | "critical";

export interface AgentRegistryDiagnosticsInput {
  validation?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    checkedAt: string;
    summary: {
      totalAgents: number;
      activeAgents: number;
      invalidAgents: number;
      defaultAgent: string;
    };
  };
  agents?: AgentRegistryRuntimeDiagnostic[];
}

export interface AgentRegistryRuntimeDiagnostic {
  name: string;
  module: string;
  configuredClass: string;
  loadStatus: AgentRegistryLoadStatus;
  resolvedExportName?: string;
  resolutionStrategy?: string;
  availableExports: string[];
  error?: string;
  metadata: {
    category: string;
    status: "active" | "disabled" | "experimental";
    tags: string[];
    tools: string[];
    triggers: string[];
    capabilities: string[];
    priority: number;
    autoStart: boolean;
    executionMode: "local" | "cloud" | "hybrid";
    costTier: "low" | "medium" | "high";
    runtimeCompatibility: "node" | "python" | "hybrid";
  };
  runtime: {
    status: AgentRegistryRuntimeStatus;
    lastTaskAt?: string;
    lastTask?: string;
    successCount: number;
    errorCount: number;
  };
}

export interface GovernanceDocumentInput {
  name: string;
  content: string;
  path?: string;
}

export interface AgentRegistryDuplicateNameGroup {
  name: string;
  count: number;
  agents: string[];
}

export interface AgentRegistryCapabilityOverlapGroup {
  id: string;
  agents: string[];
  sharedCapabilities: string[];
  overlapScore: number;
  pairCount: number;
}

export interface AgentRegistryStaleAgent {
  name: string;
  usageStatus: AgentRegistryUsageStatus;
  lastTaskAt?: string;
  lastTask?: string;
  successCount: number;
  errorCount: number;
  daysSinceLastTask?: number;
  reason: string;
}

export interface AgentRegistryUndocumentedAgent {
  name: string;
  title?: string;
  mentions: string[];
}

export interface AgentRegistryLoadError {
  name: string;
  module: string;
  configuredClass: string;
  loadStatus: AgentRegistryLoadStatus;
  error: string;
}

export interface AgentRegistryAgentHealth {
  name: string;
  title?: string;
  category?: string;
  health: AgentRegistryHealthStatus;
  score: number;
  loadStatus: AgentRegistryLoadStatus;
  runtimeStatus: AgentRegistryRuntimeStatus;
  usageStatus: AgentRegistryUsageStatus;
  documented: boolean;
  duplicateName: boolean;
  duplicateCapabilityGroupIds: string[];
  issues: string[];
  lastTaskAt?: string;
  lastTask?: string;
  successCount: number;
  errorCount: number;
}

export interface AgentRegistryDocumentCoverage {
  documents: Array<{
    name: string;
    path?: string;
    present: boolean;
    agentMentions: number;
  }>;
  agentsReferenced: number;
  agentsMissingReferences: string[];
  coveragePercent: number;
}

export interface AgentRegistryAuditSummary {
  totalAgents: number;
  activeAgents: number;
  loadedAgents: number;
  loadErrorCount: number;
  duplicateNameCount: number;
  duplicateCapabilityGroupCount: number;
  staleAgentCount: number;
  undocumentedAgentCount: number;
  warningCount: number;
  score: number;
  overallStatus: AgentRegistryOverallStatus;
}

export interface AgentRegistryAuditReport {
  checkedAt: string;
  summary: AgentRegistryAuditSummary;
  duplicateNames: AgentRegistryDuplicateNameGroup[];
  duplicateCapabilityOverlapGroups: AgentRegistryCapabilityOverlapGroup[];
  staleAgents: AgentRegistryStaleAgent[];
  undocumentedAgents: AgentRegistryUndocumentedAgent[];
  loadErrors: AgentRegistryLoadError[];
  perAgentHealth: AgentRegistryAgentHealth[];
  documentCoverage: AgentRegistryDocumentCoverage;
  warnings: string[];
}

const STALE_AFTER_DAYS = 30;
const DUPLICATE_OVERLAP_THRESHOLD = 0.6;

type RegistryAgent = RegistryConfig["agents"][number] & { title?: string };

function toNormalizedText(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

function getAgentLabels(agent: RegistryAgent): string[] {
  const labels = [agent.name, agent.title ?? ""].flatMap((value) => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return [trimmed, trimmed.toLowerCase(), toNormalizedText(trimmed)];
  });
  return uniqueSorted(labels);
}

function countDaysBetween(laterIso: string, earlierIso: string): number | undefined {
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) {
    return undefined;
  }

  return Math.max(0, Math.floor((later - earlier) / (1000 * 60 * 60 * 24)));
}

function buildCapabilitySet(capabilities: string[] | undefined): Set<string> {
  return new Set(
    (Array.isArray(capabilities) ? capabilities : [])
      .map((capability) => capability.trim())
      .filter(Boolean),
  );
}

function calculateOverlap(left: Set<string>, right: Set<string>): { score: number; shared: string[] } {
  const shared = Array.from(left).filter((value) => right.has(value));
  const unionSize = new Set([...left, ...right]).size;
  const score = unionSize === 0 ? 0 : shared.length / unionSize;
  return {
    score,
    shared: uniqueSorted(shared),
  };
}

function buildDuplicateNameGroups(registry: RegistryConfig): AgentRegistryDuplicateNameGroup[] {
  const grouped = new Map<string, string[]>();
  for (const agent of registry.agents) {
    const current = grouped.get(agent.name) ?? [];
    current.push(agent.name);
    grouped.set(agent.name, current);
  }

  return Array.from(grouped.entries())
    .filter(([, agents]) => agents.length > 1)
    .map(([name, agents]) => ({
      name,
      count: agents.length,
      agents: uniqueSorted(agents),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

function buildOverlapGroups(registry: RegistryConfig): AgentRegistryCapabilityOverlapGroup[] {
  const agents = registry.agents
    .map((agent) => ({
      name: agent.name,
      capabilities: buildCapabilitySet(agent.metadataStandard?.capabilities ?? agent.capabilities),
    }))
    .filter((agent) => agent.capabilities.size > 0);

  const adjacency = new Map<string, Set<string>>();
  const pairScores = new Map<string, number>();
  const pairShared = new Map<string, string[]>();

  for (let leftIndex = 0; leftIndex < agents.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < agents.length; rightIndex += 1) {
      const left = agents[leftIndex];
      const right = agents[rightIndex];
      const overlap = calculateOverlap(left.capabilities, right.capabilities);
      if (overlap.shared.length < 2 || overlap.score < DUPLICATE_OVERLAP_THRESHOLD) {
        continue;
      }

      const pairId = [left.name, right.name]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .join("::");

      if (!adjacency.has(left.name)) adjacency.set(left.name, new Set());
      if (!adjacency.has(right.name)) adjacency.set(right.name, new Set());
      adjacency.get(left.name)?.add(right.name);
      adjacency.get(right.name)?.add(left.name);
      pairScores.set(pairId, overlap.score);
      pairShared.set(pairId, overlap.shared);
    }
  }

  const visited = new Set<string>();
  const groups: AgentRegistryCapabilityOverlapGroup[] = [];

  for (const agent of agents) {
    if (visited.has(agent.name) || !adjacency.has(agent.name)) {
      continue;
    }

    const stack = [agent.name];
    const cluster: string[] = [];
    const scores: number[] = [];
    const shared = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        const pairId = [current, neighbor]
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
          .join("::");
        const score = pairScores.get(pairId);
        if (typeof score === "number") {
          scores.push(score);
        }
        for (const capability of pairShared.get(pairId) ?? []) {
          shared.add(capability);
        }

        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    if (cluster.length > 1) {
      groups.push({
        id: cluster
          .slice()
          .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
          .join("::"),
        agents: cluster.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })),
        sharedCapabilities: uniqueSorted(Array.from(shared)),
        overlapScore: scores.length > 0
          ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2))
          : 0,
        pairCount: scores.length,
      });
    }
  }

  return groups.sort((left, right) => left.id.localeCompare(right.id, undefined, { sensitivity: "base" }));
}

function buildDocumentCoverage(
  registry: RegistryConfig,
  documents: GovernanceDocumentInput[],
): AgentRegistryDocumentCoverage {
  const documentsSummary = documents.map((document) => {
    const normalizedContent = toNormalizedText(document.content);
    let agentMentions = 0;

    for (const agent of registry.agents) {
      if (getAgentLabels(agent).some((label) => normalizedContent.includes(toNormalizedText(label)))) {
        agentMentions += 1;
      }
    }

    return {
      name: document.name,
      path: document.path,
      present: true,
      agentMentions,
    };
  });

  const missingAgents: string[] = [];
  let referencedAgents = 0;

  for (const agent of registry.agents) {
    const mentioned = documents.some((document) => {
      const normalizedContent = toNormalizedText(document.content);
      return getAgentLabels(agent).some((label) => normalizedContent.includes(toNormalizedText(label)));
    });

    if (mentioned) {
      referencedAgents += 1;
    } else {
      missingAgents.push(agent.name);
    }
  }

  return {
    documents: documentsSummary,
    agentsReferenced: referencedAgents,
    agentsMissingReferences: uniqueSorted(missingAgents),
    coveragePercent: registry.agents.length === 0 ? 100 : Math.round((referencedAgents / registry.agents.length) * 100),
  };
}

function buildStaleAgentEntry(
  agent: AgentRegistryRuntimeDiagnostic,
  checkedAt: string,
): AgentRegistryStaleAgent | null {
  if (agent.loadStatus === "error" || agent.loadStatus === "skipped") {
    return null;
  }

  const usageCount = agent.runtime.successCount + agent.runtime.errorCount;
  const lastTaskAt = agent.runtime.lastTaskAt;

  if (usageCount > 0 && lastTaskAt) {
    const daysSinceLastTask = countDaysBetween(checkedAt, lastTaskAt);
    if (typeof daysSinceLastTask === "number" && daysSinceLastTask <= STALE_AFTER_DAYS) {
      return null;
    }

    return {
      name: agent.name,
      usageStatus: "stale",
      lastTaskAt,
      lastTask: agent.runtime.lastTask,
      successCount: agent.runtime.successCount,
      errorCount: agent.runtime.errorCount,
      daysSinceLastTask,
      reason: `No execution in the last ${STALE_AFTER_DAYS} days.`,
    };
  }

  if (usageCount === 0) {
    return {
      name: agent.name,
      usageStatus: "never-used",
      lastTaskAt,
      lastTask: agent.runtime.lastTask,
      successCount: 0,
      errorCount: 0,
      reason: "Agent has never been used in the current runtime window.",
    };
  }

  return null;
}

function buildAgentHealth(
  registry: RegistryConfig,
  diagnostics: AgentRegistryDiagnosticsInput | undefined,
  duplicateNameSet: Set<string>,
  overlapGroupsByAgent: Map<string, string[]>,
  documentedAgents: Set<string>,
  staleAgentsByName: Map<string, AgentRegistryStaleAgent>,
  loadErrorsByName: Map<string, AgentRegistryLoadError>,
): AgentRegistryAgentHealth[] {
  return registry.agents
    .map((agent) => {
      const diagnostic = diagnostics?.agents?.find((entry) => entry.name === agent.name);
      const issues: string[] = [];
      const duplicateName = duplicateNameSet.has(agent.name);
      const overlapGroupIds = overlapGroupsByAgent.get(agent.name) ?? [];
      const documented = documentedAgents.has(agent.name);
      const staleEntry = staleAgentsByName.get(agent.name);
      const loadError = loadErrorsByName.get(agent.name);

      let health: AgentRegistryHealthStatus = "healthy";
      let score = 100;

      if (loadError) {
        health = "critical";
        score -= 60;
        issues.push(`Load error: ${loadError.error}`);
      } else if (diagnostic?.loadStatus === "skipped") {
        health = "warning";
        score -= 15;
        issues.push("Agent was skipped during load.");
      }

      if (duplicateName) {
        health = "critical";
        score -= 35;
        issues.push("Duplicate agent name detected.");
      }

      if (overlapGroupIds.length > 0) {
        if (health !== "critical") {
          health = "warning";
        }
        score -= Math.min(15, overlapGroupIds.length * 5);
        issues.push(`Capability overlap group(s): ${overlapGroupIds.join(", ")}`);
      }

      if (staleEntry) {
        if (health !== "critical") {
          health = "warning";
        }
        score -= staleEntry.usageStatus === "never-used" ? 20 : 12;
        issues.push(staleEntry.reason);
      }

      if (!documented) {
        if (health !== "critical") {
          health = "warning";
        }
        score -= 10;
        issues.push("Missing documentation references.");
      }

      if (diagnostic?.runtime.status === "error") {
        if (health !== "critical") {
          health = "warning";
        }
        score -= 10;
        issues.push("Runtime reports an error state.");
      }

      if (typeof diagnostic?.runtime.successCount === "number" && diagnostic.runtime.successCount > 0) {
        score += Math.min(5, diagnostic.runtime.successCount);
      }

      score = Math.max(0, Math.min(100, Math.round(score)));
      if (score >= 90 && health !== "critical") {
        health = "healthy";
      } else if (health !== "critical" && issues.length > 0) {
        health = "warning";
      }

      return {
        name: agent.name,
        title: agent.title,
        category: agent.category ?? agent.metadataStandard?.category,
        health,
        score,
        loadStatus: diagnostic?.loadStatus ?? "pending",
        runtimeStatus: diagnostic?.runtime.status ?? "unloaded",
        usageStatus:
          staleEntry?.usageStatus ??
          (diagnostic?.loadStatus === "loaded" ? "active" : "unknown"),
        documented,
        duplicateName,
        duplicateCapabilityGroupIds: overlapGroupIds,
        issues,
        lastTaskAt: diagnostic?.runtime.lastTaskAt,
        lastTask: diagnostic?.runtime.lastTask,
        successCount: diagnostic?.runtime.successCount ?? 0,
        errorCount: diagnostic?.runtime.errorCount ?? 0,
      } satisfies AgentRegistryAgentHealth;
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
}

function buildWarnings(
  diagnostics: AgentRegistryDiagnosticsInput | undefined,
  duplicateNames: AgentRegistryDuplicateNameGroup[],
  overlapGroups: AgentRegistryCapabilityOverlapGroup[],
  staleAgents: AgentRegistryStaleAgent[],
  undocumentedAgents: AgentRegistryUndocumentedAgent[],
  loadErrors: AgentRegistryLoadError[],
): string[] {
  const warnings = new Set<string>();

  for (const warning of diagnostics?.validation?.warnings ?? []) {
    warnings.add(`Validation: ${warning}`);
  }

  for (const error of diagnostics?.validation?.errors ?? []) {
    warnings.add(`Validation error: ${error}`);
  }

  for (const group of duplicateNames) {
    warnings.add(`Duplicate agent name: ${group.name}`);
  }

  for (const group of overlapGroups) {
    warnings.add(`Capability overlap cluster: ${group.agents.join(", ")}`);
  }

  for (const agent of staleAgents) {
    warnings.add(`Stale agent: ${agent.name} (${agent.usageStatus})`);
  }

  for (const agent of undocumentedAgents) {
    warnings.add(`Undocumented agent: ${agent.name}`);
  }

  for (const loadError of loadErrors) {
    warnings.add(`Load error: ${loadError.name} — ${loadError.error}`);
  }

  return Array.from(warnings).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

function clampGovernanceScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function auditAgentRegistry(
  registryInput: RegistryConfig | Partial<RegistryConfig>,
  diagnostics?: AgentRegistryDiagnosticsInput,
  governanceDocuments: GovernanceDocumentInput[] = [],
  checkedAt = new Date().toISOString(),
): AgentRegistryAuditReport {
  const registry = normalizeRegistryConfig(registryInput as Partial<RegistryConfig>);

  const duplicateNames = buildDuplicateNameGroups(registry);
  const overlapGroups = buildOverlapGroups(registry);
  const overlapGroupsByAgent = new Map<string, string[]>();

  for (const group of overlapGroups) {
    for (const agentName of group.agents) {
      const current = overlapGroupsByAgent.get(agentName) ?? [];
      current.push(group.id);
      overlapGroupsByAgent.set(agentName, current);
    }
  }

  const loadErrors = (diagnostics?.agents ?? [])
    .filter((agent) => agent.loadStatus === "error")
    .map((agent) => ({
      name: agent.name,
      module: agent.module,
      configuredClass: agent.configuredClass,
      loadStatus: agent.loadStatus,
      error: agent.error ?? "Unknown load error.",
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

  const loadErrorsByName = new Map(loadErrors.map((entry) => [entry.name, entry] as const));

  const documentedAgents = new Set<string>();
  for (const agent of registry.agents as RegistryAgent[]) {
    const labels = getAgentLabels(agent);
    const mentioned = governanceDocuments.some((document) => {
      const normalizedContent = toNormalizedText(document.content);
      return labels.some((label) => normalizedContent.includes(toNormalizedText(label)));
    });
    if (mentioned) {
      documentedAgents.add(agent.name);
    }
  }

  const staleAgents = (diagnostics?.agents ?? [])
    .map((agent) => buildStaleAgentEntry(agent, checkedAt))
    .filter((entry): entry is AgentRegistryStaleAgent => Boolean(entry))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

  const staleAgentsByName = new Map(staleAgents.map((entry) => [entry.name, entry] as const));

  const undocumentedAgentMap = new Map<string, AgentRegistryUndocumentedAgent>();
  for (const agent of registry.agents as RegistryAgent[]) {
    if (documentedAgents.has(agent.name)) {
      continue;
    }

    const mentions = getAgentLabels(agent).filter((label) =>
      governanceDocuments.some((document) => toNormalizedText(document.content).includes(toNormalizedText(label))),
    );

    const existing = undocumentedAgentMap.get(agent.name);
    if (existing) {
      existing.mentions = uniqueSorted([...existing.mentions, ...mentions]);
      continue;
    }

    undocumentedAgentMap.set(agent.name, {
      name: agent.name,
      title: agent.title,
      mentions,
    });
  }

  const undocumentedAgents = Array.from(undocumentedAgentMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );

  const perAgentHealth = buildAgentHealth(
    registry,
    diagnostics,
    new Set(duplicateNames.map((group) => group.name)),
    overlapGroupsByAgent,
    documentedAgents,
    staleAgentsByName,
    loadErrorsByName,
  );

  const documentCoverage = buildDocumentCoverage(registry, governanceDocuments);
  const warningCount =
    duplicateNames.length +
    overlapGroups.length +
    staleAgents.length +
    undocumentedAgents.length +
    loadErrors.length +
    (diagnostics?.validation?.warnings.length ?? 0) +
    (diagnostics?.validation?.errors.length ?? 0);

  const score = clampGovernanceScore(
    100 -
      duplicateNames.length * 15 -
      overlapGroups.length * 4 -
      staleAgents.length * 6 -
      undocumentedAgents.length * 3 -
      loadErrors.length * 20,
  );

  const overallStatus: AgentRegistryOverallStatus =
    loadErrors.length > 0 || duplicateNames.length > 0
      ? "critical"
      : warningCount > 0
        ? "attention"
        : "healthy";

  return {
    checkedAt,
    summary: {
      totalAgents: registry.agents.length,
      activeAgents: registry.agents.filter((agent) => (agent.metadataStandard?.status ?? agent.status) !== "disabled").length,
      loadedAgents: (diagnostics?.agents ?? []).filter((agent) => agent.loadStatus === "loaded").length,
      loadErrorCount: loadErrors.length,
      duplicateNameCount: duplicateNames.length,
      duplicateCapabilityGroupCount: overlapGroups.length,
      staleAgentCount: staleAgents.length,
      undocumentedAgentCount: undocumentedAgents.length,
      warningCount,
      score,
      overallStatus,
    },
    duplicateNames,
    duplicateCapabilityOverlapGroups: overlapGroups,
    staleAgents,
    undocumentedAgents,
    loadErrors,
    perAgentHealth,
    documentCoverage,
    warnings: buildWarnings(
      diagnostics,
      duplicateNames,
      overlapGroups,
      staleAgents,
      undocumentedAgents,
      loadErrors,
    ),
  };
}


