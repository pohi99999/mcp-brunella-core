import type {
  AgentRegistryAuditReport,
  AgentRegistryCapabilityOverlapGroup,
  AgentRegistryDuplicateNameGroup,
  AgentRegistryLoadError,
  AgentRegistryStaleAgent,
  AgentRegistryUndocumentedAgent,
} from "./agentRegistryAudit.js";

export type AgentRegistryRecommendationPriority = "critical" | "high" | "medium" | "low";
export type AgentRegistryRecommendationType = "merge" | "archive" | "document" | "fix" | "consolidate";

export interface AgentRegistryRecommendation {
  id: string;
  type: AgentRegistryRecommendationType;
  priority: AgentRegistryRecommendationPriority;
  title: string;
  rationale: string;
  targets: string[];
  evidence: string[];
}

const PRIORITY_ORDER: Record<AgentRegistryRecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

function createRecommendation(
  type: AgentRegistryRecommendationType,
  priority: AgentRegistryRecommendationPriority,
  title: string,
  rationale: string,
  targets: string[],
  evidence: string[],
): AgentRegistryRecommendation {
  return {
    id: `${type}:${priority}:${uniqueSorted(targets).join("|")}`.toLowerCase(),
    type,
    priority,
    title,
    rationale,
    targets: uniqueSorted(targets),
    evidence: uniqueSorted(evidence),
  };
}

function buildDuplicateNameRecommendation(group: AgentRegistryDuplicateNameGroup): AgentRegistryRecommendation {
  return createRecommendation(
    "merge",
    "critical",
    `Merge duplicate agent name: ${group.name}`,
    `The registry contains ${group.count} entries with the same agent name. Duplicate names make routing ambiguous and should be reduced to one canonical entry.`,
    group.agents,
    [`Duplicate name count: ${group.count}`],
  );
}

function buildLoadErrorRecommendation(entry: AgentRegistryLoadError): AgentRegistryRecommendation {
  return createRecommendation(
    "fix",
    "critical",
    `Fix load error for ${entry.name}`,
    `The agent failed to load with "${entry.error}". This should be corrected before any consolidation or archival work.`,
    [entry.name],
    [entry.module, entry.configuredClass, entry.error],
  );
}

function buildOverlapRecommendation(group: AgentRegistryCapabilityOverlapGroup): AgentRegistryRecommendation {
  return createRecommendation(
    "consolidate",
    "high",
    `Consolidate overlapping capability group: ${group.agents.join(", ")}`,
    `These agents share ${group.sharedCapabilities.length} capabilities with an average overlap score of ${group.overlapScore}. The group should be reviewed for a smaller canonical surface.`,
    group.agents,
    group.sharedCapabilities.length > 0
      ? [`Shared capabilities: ${group.sharedCapabilities.join(", ")}`]
      : ["No shared capability details were provided."],
  );
}

function buildStaleRecommendation(entry: AgentRegistryStaleAgent): AgentRegistryRecommendation {
  const priority: AgentRegistryRecommendationPriority =
    entry.usageStatus === "never-used" ? "high" : "medium";

  return createRecommendation(
    "archive",
    priority,
    `${entry.usageStatus === "never-used" ? "Archive never-used" : "Review stale"} agent: ${entry.name}`,
    entry.usageStatus === "never-used"
      ? "The agent has never been used in the current runtime window. Archive it or provide a concrete near-term ownership path."
      : `The agent has not been used for ${entry.daysSinceLastTask ?? "an unknown number of"} days. Review it for retirement or reactivation.`,
    [entry.name],
    [entry.reason, entry.lastTaskAt ?? "no last task timestamp"],
  );
}

function buildDocumentationRecommendation(entry: AgentRegistryUndocumentedAgent): AgentRegistryRecommendation {
  return createRecommendation(
    "document",
    "medium",
    `Document agent: ${entry.name}`,
    "This agent is not referenced in the governance documents. Add a short purpose, ownership, and lifecycle note to keep the registry auditable.",
    [entry.name],
    entry.mentions.length > 0 ? entry.mentions : ["No document mentions were found."],
  );
}

export function generateAgentRegistryRecommendations(
  report: AgentRegistryAuditReport,
): AgentRegistryRecommendation[] {
  const recommendations: AgentRegistryRecommendation[] = [
    ...report.duplicateNames.map(buildDuplicateNameRecommendation),
    ...report.loadErrors.map(buildLoadErrorRecommendation),
    ...report.duplicateCapabilityOverlapGroups.map(buildOverlapRecommendation),
    ...report.staleAgents.map(buildStaleRecommendation),
    ...report.undocumentedAgents.map(buildDocumentationRecommendation),
  ];

  return recommendations.sort((left, right) => {
    const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const typeDelta = left.type.localeCompare(right.type, undefined, { sensitivity: "base" });
    if (typeDelta !== 0) {
      return typeDelta;
    }

    return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  });
}

