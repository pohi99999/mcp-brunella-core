/**
 * Tool Registry — central store for tool definitions and handlers.
 * GitHubModelsAgent and other agents can query available tools from here.
 * registry.ts re-exports from this module for compatibility.
 */

import type { ToolDefinition } from "../agents/types.js";
import {
  checkToolPermission,
  type ToolExecutionContext,
} from "../tools/toolPermissions.js";
export type { ToolDefinition };
export type { ToolExecutionContext };

// Tool list for dashboard display
export interface RegisteredToolInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "server" | "monitoring" | "configuration" | "custom";
  parameters: { name: string; type: string; required: boolean }[];
}

// Internal stores
const toolHandlers = new Map<string, (args: unknown) => Promise<unknown>>();
const registeredToolDefinitions: ToolDefinition[] = [];

export function registerToolHandler(name: string, handler: (args: unknown) => Promise<unknown>) {
  toolHandlers.set(name, handler);
}

export function registerToolDefinition(def: ToolDefinition) {
  if (!registeredToolDefinitions.find(d => d.name === def.name)) {
    registeredToolDefinitions.push(def);
  }
}

export async function executeLocalTool(
  name: string,
  args: unknown,
  context: ToolExecutionContext = {},
): Promise<unknown> {
  const permissionCheck = checkToolPermission(name, context);
  if (!permissionCheck.allowed) {
    throw new Error(permissionCheck.reason || `Tool execution denied: ${name}`);
  }

  const handler = toolHandlers.get(name);
  if (!handler) {
    throw new Error(`Tool handler not registered: ${name}`);
  }
  return handler(args);
}

export function getAllToolDefinitions(): ToolDefinition[] {
  return registeredToolDefinitions;
}

function getParameterType(schema: unknown): string {
  if (typeof schema !== "object" || schema === null) {
    return "unknown";
  }

  const schemaRecord = schema as Record<string, unknown>;
  return typeof schemaRecord.type === "string" ? schemaRecord.type : "unknown";
}

function getToolCategory(definition: ToolDefinition): RegisteredToolInfo["category"] {
  const normalized = `${definition.name} ${definition.description}`.toLowerCase();

  if (
    normalized.includes("health") ||
    normalized.includes("metric") ||
    normalized.includes("monitor")
  ) {
    return "monitoring";
  }

  if (
    normalized.includes("config") ||
    normalized.includes("setting") ||
    normalized.includes("env")
  ) {
    return "configuration";
  }

  if (
    normalized.includes("server") ||
    normalized.includes("agent") ||
    normalized.includes("mcp")
  ) {
    return "server";
  }

  return "custom";
}

export function getRegisteredToolsList(): RegisteredToolInfo[] {
  return registeredToolDefinitions.map((definition) => {
    const properties = definition.inputSchema?.properties ?? {};
    const required = new Set(definition.inputSchema?.required ?? []);

    return {
      id: definition.name,
      name: definition.name,
      description: definition.description,
      enabled: true,
      category: getToolCategory(definition),
      parameters: Object.entries(properties).map(([name, schema]) => ({
        name,
        type: getParameterType(schema),
        required: required.has(name),
      })),
    };
  });
}
