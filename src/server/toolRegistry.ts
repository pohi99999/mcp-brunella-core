/**
 * Tool Registry — central store for tool definitions and handlers.
 * GitHubModelsAgent and other agents can query available tools from here.
 * registry.ts re-exports from this module for compatibility.
 */

import type { ToolDefinition } from "../agents/types.js";
export type { ToolDefinition };

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

export async function executeLocalTool(name: string, args: unknown): Promise<unknown> {
  const handler = toolHandlers.get(name);
  if (!handler) {
    throw new Error(`Tool handler not registered: ${name}`);
  }
  return handler(args);
}

export function getAllToolDefinitions(): ToolDefinition[] {
  return registeredToolDefinitions;
}

export async function getRegisteredToolsList(): Promise<RegisteredToolInfo[]> {
  const { getRegisteredToolsList: regList } = await import("./registry.js");
  return regList();
}
