export type AgentLifecycleStatus = "active" | "disabled" | "experimental";
export type AgentExecutionMode = "local" | "cloud" | "hybrid";
export type AgentCostTier = "low" | "medium" | "high";
export type AgentRuntimeCompatibility = "node" | "python" | "hybrid";

export interface AgentMetadataStandard {
  category: string;
  status: AgentLifecycleStatus;
  tags: string[];
  tools: string[];
  triggers: string[];
  capabilities: string[];
  priority: number;
  autoStart: boolean;
  executionMode: AgentExecutionMode;
  costTier: AgentCostTier;
  runtimeCompatibility: AgentRuntimeCompatibility;
}

export interface AgentConfig {
  name: string;
  title?: string;
  class: string;
  module: string;
  description: string;
  capabilities: string[];
  priority: number;
  autoStart: boolean;
  systemPrompt?: string;
  triggers?: string[];
  config?: Record<string, unknown>;
  role?: string;
  category?: string;
  status?: AgentLifecycleStatus;
  tags?: string[];
  tools?: string[];
  metadataStandard?: AgentMetadataStandard;
}

export interface RoutingRule {
  pattern: string;
  agent: string;
}

export interface RegistryConfig {
  version: string;
  agents: AgentConfig[];
  defaultAgent: string;
  routingRules: RoutingRule[];
}

function uniqueStrings(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function inferExecutionMode(agent: Pick<AgentConfig, "module" | "class" | "name">): AgentExecutionMode {
  const fingerprint = `${agent.name} ${agent.class} ${agent.module}`.toLowerCase();
  if (fingerprint.includes("edge") || fingerprint.includes("cloudflare")) return "cloud";
  if (fingerprint.includes("python") || fingerprint.includes("browser") || fingerprint.includes("voice")) return "hybrid";
  if (fingerprint.includes("gemini") || fingerprint.includes("anthropic") || fingerprint.includes("github")) return "cloud";
  return "local";
}

function inferCostTier(agent: Pick<AgentConfig, "module" | "class" | "name">): AgentCostTier {
  const fingerprint = `${agent.name} ${agent.class} ${agent.module}`.toLowerCase();
  if (fingerprint.includes("gemini") || fingerprint.includes("anthropic") || fingerprint.includes("github")) return "high";
  if (fingerprint.includes("edge") || fingerprint.includes("python") || fingerprint.includes("browser") || fingerprint.includes("voice")) return "medium";
  return "low";
}

function inferRuntimeCompatibility(agent: Pick<AgentConfig, "module" | "class" | "name">): AgentRuntimeCompatibility {
  const fingerprint = `${agent.name} ${agent.class} ${agent.module}`.toLowerCase();
  if (fingerprint.includes("python")) return "hybrid";
  if (fingerprint.includes("browser") || fingerprint.includes("voice")) return "hybrid";
  return "node";
}

function inferCategory(agent: Pick<AgentConfig, "name" | "class" | "module" | "capabilities">): string {
  const fingerprint = `${agent.name} ${agent.class} ${agent.module} ${agent.capabilities.join(" ")}`.toLowerCase();
  if (fingerprint.includes("research")) return "research";
  if (fingerprint.includes("developer") || fingerprint.includes("code") || fingerprint.includes("lint")) return "engineering";
  if (fingerprint.includes("sales") || fingerprint.includes("lead") || fingerprint.includes("marketing")) return "business";
  if (fingerprint.includes("finance") || fingerprint.includes("invoice")) return "finance";
  if (fingerprint.includes("swarm") || fingerprint.includes("orchestrator") || fingerprint.includes("task")) return "orchestration";
  return "general";
}

export function buildMetadataStandard(agent: AgentConfig): AgentMetadataStandard {
  const capabilities = uniqueStrings(agent.capabilities);
  const triggers = uniqueStrings(agent.triggers);
  const tags = uniqueStrings(agent.tags);
  const tools = uniqueStrings(agent.tools);

  return {
    category: agent.category?.trim() || inferCategory({
      name: agent.name,
      class: agent.class,
      module: agent.module,
      capabilities,
    }),
    status: agent.status ?? "active",
    tags,
    tools,
    triggers,
    capabilities,
    priority: Number.isFinite(agent.priority) ? agent.priority : 0,
    autoStart: Boolean(agent.autoStart),
    executionMode: inferExecutionMode(agent),
    costTier: inferCostTier(agent),
    runtimeCompatibility: inferRuntimeCompatibility(agent),
  };
}

export function normalizeAgentConfig(agent: Partial<AgentConfig>): AgentConfig {
  const normalized: AgentConfig = {
    name: typeof agent.name === "string" ? agent.name.trim() : "",
    title: typeof agent.title === "string" ? agent.title.trim() : undefined,
    class: typeof agent.class === "string" ? agent.class.trim() : "",
    module: typeof agent.module === "string" ? agent.module.trim() : "",
    description: typeof agent.description === "string" ? agent.description.trim() : "",
    capabilities: uniqueStrings(agent.capabilities),
    priority: typeof agent.priority === "number" && Number.isFinite(agent.priority) ? agent.priority : 0,
    autoStart: Boolean(agent.autoStart),
    systemPrompt: typeof agent.systemPrompt === "string" ? agent.systemPrompt : undefined,
    triggers: uniqueStrings(agent.triggers),
    config: typeof agent.config === "object" && agent.config !== null ? agent.config : undefined,
    role: typeof agent.role === "string" ? agent.role : undefined,
    category: typeof agent.category === "string" ? agent.category.trim() : undefined,
    status: agent.status,
    tags: uniqueStrings(agent.tags),
    tools: uniqueStrings(agent.tools),
  };

  normalized.metadataStandard = buildMetadataStandard(normalized);
  return normalized;
}

export function normalizeRegistryConfig(partial: Partial<RegistryConfig>): RegistryConfig {
  const agents = Array.isArray(partial.agents)
    ? partial.agents.map((agent) => normalizeAgentConfig(agent))
    : [];

  const routingRules = Array.isArray(partial.routingRules)
    ? partial.routingRules
        .filter((rule): rule is RoutingRule => Boolean(rule && typeof rule.pattern === "string" && typeof rule.agent === "string"))
        .map((rule) => ({ pattern: rule.pattern.trim(), agent: rule.agent.trim() }))
    : [];

  const requestedDefaultAgent = typeof partial.defaultAgent === "string" && partial.defaultAgent.trim()
    ? partial.defaultAgent.trim()
    : "orchestrator";

  const matchedDefaultAgent = agents.find(
    (agent) => agent.name.toLowerCase() === requestedDefaultAgent.toLowerCase(),
  )?.name;

  return {
    version: typeof partial.version === "string" ? partial.version : "1.0.0",
    agents,
    defaultAgent: matchedDefaultAgent ?? requestedDefaultAgent,
    routingRules,
  };
}
