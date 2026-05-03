import { z } from "zod";
import {
  type AgentConfig,
  type RegistryConfig,
  normalizeRegistryConfig,
} from "./registryStandard.js";
import { logWarn } from "../utils/logger.js";

export interface RegistryValidationReport {
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
}

export interface RegistryValidationResult {
  registry: RegistryConfig;
  report: RegistryValidationReport;
}

const rawAgentSchema = z.object({
  name: z.string(),
  class: z.string(),
  module: z.string(),
  description: z.string().optional().default(""),
  capabilities: z.array(z.string()).optional().default([]),
  priority: z.number().optional().default(0),
  autoStart: z.boolean().optional().default(false),
  systemPrompt: z.string().optional(),
  triggers: z.array(z.string()).optional().default([]),
  config: z.record(z.string(), z.unknown()).optional(),
  role: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["active", "disabled", "experimental"]).optional(),
  tags: z.array(z.string()).optional().default([]),
  tools: z.array(z.string()).optional().default([]),
}).passthrough();

const rawRegistrySchema = z.object({
  version: z.union([z.string(), z.number()]).transform((value) => String(value)).optional().default("1.0.0"),
  agents: z.array(rawAgentSchema).optional().default([]),
  defaultAgent: z.string().optional().default("orchestrator"),
  routingRules: z.array(
    z.object({
      pattern: z.string(),
      agent: z.string(),
    }),
  ).optional().default([]),
}).passthrough();

function collectDuplicateNames(agents: AgentConfig[]): string[] {
  const seen = new Map<string, number>();
  for (const agent of agents) {
    seen.set(agent.name, (seen.get(agent.name) ?? 0) + 1);
  }

  return Array.from(seen.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
}

export function validateAndNormalizeRegistry(raw: unknown): RegistryValidationResult {
  const checkedAt = new Date().toISOString();
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = rawRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "registry"}: ${issue.message}`);
    logWarn('RegistryValidation', `Registry schema parse failed — falling back to empty registry. Issues: ${issues.join('; ')}`);
    const fallbackRegistry = normalizeRegistryConfig({});
    return {
      registry: fallbackRegistry,
      report: {
        valid: false,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "registry"}: ${issue.message}`),
        warnings: [],
        checkedAt,
        summary: {
          totalAgents: 0,
          activeAgents: 0,
          invalidAgents: 1,
          defaultAgent: fallbackRegistry.defaultAgent,
        },
      },
    };
  }

  const registry = normalizeRegistryConfig(parsed.data);
  const duplicateNames = collectDuplicateNames(registry.agents);
  for (const duplicateName of duplicateNames) {
    errors.push(`Duplicate agent name in registry: ${duplicateName}`);
  }

  for (const agent of registry.agents) {
    if (!agent.name) errors.push("Registry agent is missing 'name'");
    if (!agent.class) errors.push(`Agent '${agent.name || "<unknown>"}' is missing 'class'`);
    if (!agent.module) errors.push(`Agent '${agent.name || "<unknown>"}' is missing 'module'`);

    if (agent.metadataStandard?.status === "disabled") {
      warnings.push(`Agent '${agent.name}' is disabled and will be ignored by score-based routing.`);
    }

    if ((agent.capabilities?.length ?? 0) === 0 && (agent.triggers?.length ?? 0) === 0) {
      warnings.push(`Agent '${agent.name}' has no capabilities and no triggers; routing quality may degrade.`);
    }
  }

  const agentNames = new Set(registry.agents.map((agent) => agent.name));
  if (!agentNames.has(registry.defaultAgent)) {
    warnings.push(`Default agent '${registry.defaultAgent}' is not present in registry agents.`);
  }

  for (const rule of registry.routingRules) {
    if (!agentNames.has(rule.agent)) {
      warnings.push(`Routing rule '${rule.pattern}' points to missing agent '${rule.agent}'.`);
    }
  }

  return {
    registry,
    report: {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedAt,
      summary: {
        totalAgents: registry.agents.length,
        activeAgents: registry.agents.filter((agent) => agent.metadataStandard?.status !== "disabled").length,
        invalidAgents: errors.length,
        defaultAgent: registry.defaultAgent,
      },
    },
  };
}
