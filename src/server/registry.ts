import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logWarn } from "../utils/logger.js";
import { wrapToolHandler } from "../core/toolRunCapture.js";
import { buildAgentRegistryGovernanceSnapshot } from "./agentRegistryGovernance.js";
import { buildDocsConfigSotSnapshot } from "../tools/docsConfigSot.js";
import { buildDocsUnifierReport } from "../tools/docUnifier.js";
import { buildConfigGuardianReport } from "../tools/configGuardian.js";
import {
  registerToolHandler,
  registerToolDefinition,
  getAllToolDefinitions,
  executeLocalTool,
  getRegisteredToolsList
} from "./toolRegistry.js";
import { ensureError } from "../utils/ensureError.js";

// Re-export for compatibility
export { getAllToolDefinitions, executeLocalTool, getRegisteredToolsList };

let agentManager: any = null;
let registerAgentsPromise: Promise<void> | null = null;

function isZodSchemaLike(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { safeParse?: unknown }).safeParse === "function",
  );
}

function isJsonSchemaLike(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (
        typeof (value as { type?: unknown }).type === "string" ||
        "properties" in (value as Record<string, unknown>) ||
        "$schema" in (value as Record<string, unknown>)
      ),
  );
}

function isPlainZodShape(value: unknown): value is Record<string, z.ZodTypeAny> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entries = Object.values(value);
  return entries.length === 0 || entries.every((entry) => isZodSchemaLike(entry));
}

function unwrapZodType(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrapZodType(schema.unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    return unwrapZodType(schema._def.innerType);
  }

  if (schema instanceof z.ZodEffects) {
    return unwrapZodType(schema._def.schema);
  }

  return schema;
}

function basicObjectJsonSchema(
  shape: Record<string, z.ZodTypeAny>,
): { type: string; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean } {
  const properties = Object.fromEntries(
    Object.entries(shape).map(([key, value]) => {
      const unwrapped = unwrapZodType(value);
      const description =
        typeof unwrapped.description === "string" && unwrapped.description.length > 0
          ? { description: unwrapped.description }
          : {};

      let schema: Record<string, unknown>;
      if (unwrapped instanceof z.ZodString) {
        schema = { type: "string", ...description };
      } else if (unwrapped instanceof z.ZodNumber) {
        schema = { type: "number", ...description };
      } else if (unwrapped instanceof z.ZodBoolean) {
        schema = { type: "boolean", ...description };
      } else if (unwrapped instanceof z.ZodArray) {
        schema = { type: "array", ...description };
      } else {
        schema = { type: "string", ...description };
      }

      return [key, schema];
    }),
  );
  const required = Object.entries(shape)
    .filter(([, value]) => !(typeof value.isOptional === "function" && value.isOptional()))
    .map(([key]) => key);

  return sanitizeJsonSchema({
    type: "object",
    properties,
    required,
    additionalProperties: false,
  });
}

function sanitizeJsonSchema(schema: Record<string, unknown> | undefined): {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
} {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {}, additionalProperties: false };
  }

  const sanitized: Record<string, unknown> = { ...schema };
  delete sanitized.$schema;
  delete sanitized.$ref;
  delete sanitized.definitions;

  if (sanitized.type !== "object") {
    sanitized.type = "object";
  }

  if (
    !sanitized.properties ||
    typeof sanitized.properties !== "object" ||
    Array.isArray(sanitized.properties)
  ) {
    sanitized.properties = {};
  }

  if (!Array.isArray(sanitized.required)) {
    delete sanitized.required;
  }

  if (typeof sanitized.additionalProperties !== "boolean") {
    sanitized.additionalProperties = false;
  }

  return sanitized as {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export function normalizeToolInputSchema(
  parameters: unknown,
  zodToJsonSchema?: (
    schema: z.ZodTypeAny,
    options?: Record<string, unknown>,
  ) => Record<string, unknown>,
): { type: string; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean } {
  if (isJsonSchemaLike(parameters)) {
    return sanitizeJsonSchema(parameters as Record<string, unknown>);
  }

  if (zodToJsonSchema && isZodSchemaLike(parameters)) {
    return sanitizeJsonSchema(
      zodToJsonSchema(parameters as z.ZodTypeAny, {
        target: "openApi3",
        $refStrategy: "none",
      }),
    );
  }

  if (parameters instanceof z.ZodObject) {
    return basicObjectJsonSchema(parameters.shape);
  }

  if (zodToJsonSchema && isPlainZodShape(parameters)) {
    return sanitizeJsonSchema(
      zodToJsonSchema(z.object(parameters), {
        target: "openApi3",
        $refStrategy: "none",
      }),
    );
  }

  if (isPlainZodShape(parameters)) {
    return basicObjectJsonSchema(parameters);
  }

  return sanitizeJsonSchema(undefined);
}

export async function registerAgents() {
  if (!registerAgentsPromise) {
    registerAgentsPromise = (async () => {
      if (!agentManager) {
        agentManager = (await import("../agents/AgentManager.js")).agentManager;
      }

      // Initialize AgentManager - this loads all agents from registry.json
      await agentManager.initialize();

      // Initialize Dynamic Agents (not in registry.json)
      try {
        const { DynamicAgent } = await import("../agents/DynamicAgent.js");
        const path = await import("path");
        const agentsDir = path.default.join(process.cwd(), "myai/agents");
        agentManager.registerAgent(
          new DynamicAgent(path.default.join(agentsDir, "project_organizer.toml")),
        );
        agentManager.registerAgent(
          new DynamicAgent(path.default.join(agentsDir, "agent_architect.toml")),
        );
      } catch (error: unknown) {
        const err = ensureError(error);
        logWarn("System", `Could not load dynamic agents: ${err.message}`);
      }
    })().catch((error) => {
      registerAgentsPromise = null;
      throw error;
    });
  }

  await registerAgentsPromise;
}

export async function registerAllTools(server: McpServer) {
  // Dynamically import Node.js-specific modules only in Node environment
  const isNode = typeof process !== "undefined" && process.versions?.node;

  // Monkey patch server.tool to capture tool definitions and handlers
  let zodToJsonSchema: any;
  if (isNode) {
    try {
        const mod = await import("zod-to-json-schema");
        zodToJsonSchema = mod.zodToJsonSchema;
    } catch (e) {
        logWarn("Registry", "Could not load zod-to-json-schema");
    }
  }

  const originalTool = server.tool.bind(server);
  // @ts-expect-error patching server.tool for tool registration tracking
  server.tool = (name: string, description: string, parameters: any, handler: any) => {
    const wrappedHandler = wrapToolHandler(name, handler as (...args: any[]) => any) as typeof handler;

    // 1. Store handler for local execution
    registerToolHandler(name, wrappedHandler);

    // 2. Convert schema and store definition for agents
    try {
      const jsonSchema = normalizeToolInputSchema(parameters, zodToJsonSchema);

      registerToolDefinition({
        name,
        description,
        inputSchema: jsonSchema
      });
    } catch (e) {
      logWarn("Registry", `Failed to convert schema for tool ${name}: ${e}`);
      registerToolDefinition({
        name,
        description,
        inputSchema: { type: "object", properties: {} }
      });
    }

    return originalTool(name, description, parameters, wrappedHandler);
  };

  if (isNode) {
    await registerAgents();

    // Dynamically import tools to avoid top-level imports of Node-specific modules (like child_process)
    const {
        testSchedulerRunDefinition,
        testSchedulerStatusDefinition,
        testSchedulerRunHandler,
        testSchedulerStatusHandler,
    } = await import("../tools/testSchedulerTool.js");

    const {
        getSzamlazzInvoicesTool,
        getSzamlazzInvoicesHandler,
    } = await import("../tools/getSzamlazzInvoices.js");

    const {
        writeSheetsInvoicesTool,
        writeSheetsInvoicesHandler,
    } = await import("../tools/writeSheetsInvoices.js");


    // Register Node-specific tools
    const { registerWorkspaceTools } = await import("../tools/workspace.js");
    const { registerKnowledgeTools } = await import("../tools/knowledge.js");
    const { registerSystemTools } = await import("../tools/system.js");
    const { registerBrowserTools } = await import("../tools/browser.js");
    const { registerPersistentBrowserTools } = await import("../tools/persistentBrowserTools.js");
    const { registerInterpreterTools } =
      await import("../tools/interpreter.js");
    const { registerCopilotCliTool } =
      await import("../tools/copilotCliTool.js");
    const { registerJulesCliTool } = await import("../tools/julesCliTool.js");
    const { registerOllamaTool } = await import("../tools/ollamaTool.js");
    const { registerClaudeTool } = await import("../tools/claudeTool.js");
    const { registerPipelineTools } =
      await import("../pipeline/llmPipeline.js");
    const { registerGoogleWorkspaceTools } =
      await import("../tools/googleWorkspace.js");
    const { registerAnythingLLMTools } =
      await import("../tools/anythingllm.js");
    const { registerMonitorTools } = await import("../tools/monitor.js");
    const { registerSwarmTools } = await import("../tools/swarmTools.js");
    const { registerGithubModelsTool } =
      await import("../tools/githubModelsTool.js");
    const { registerGeminiTool } = await import("../tools/geminiTool.js");
    const { registerEvHunterTools } = await import("../tools/evHunterTool.js");

    registerWorkspaceTools(server);
    registerKnowledgeTools(server);
    registerSystemTools(server);
    registerBrowserTools(server);
    registerPersistentBrowserTools(server);
    registerInterpreterTools(server);
    registerCopilotCliTool(server);
    registerJulesCliTool(server);
    registerOllamaTool(server);
    registerClaudeTool(server);
    registerPipelineTools(server);
    registerGoogleWorkspaceTools(server);
    registerAnythingLLMTools(server);
    registerMonitorTools(server);
    registerSwarmTools(server);
    registerGithubModelsTool(server);
    registerGeminiTool(server);
    registerEvHunterTools(server);

    // AI Recommendation tool (Track: ai_recommendation_system_20260216)
    const { registerAiRecommendationTool } = await import("../tools/getAiRecommendation.js");
    registerAiRecommendationTool(server);

    // Register Agent Tools with double-registration (server + internal map)
    const agentListHandler = async () => {
      const agents = agentManager.listAgentDefinitions();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(agents, null, 2) },
        ],
      };
    };
    server.tool(
      "agent_list",
      "Lists all available active agents.",
      {},
      agentListHandler,
    );

    const agentRegistryHandler = async () => {
      const agents = agentManager.listRegistryDefinitions();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(agents, null, 2) },
        ],
      };
    };
    server.tool(
      "agent_registry",
      "Lists all agent definitions.",
      {},
      agentRegistryHandler,
    );

    const agentRegistryGovernanceHandler = async () => {
      const snapshot = await buildAgentRegistryGovernanceSnapshot();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(snapshot, null, 2) },
        ],
      };
    };
    server.tool(
      "agent_registry_audit",
      "Returns the canonical read-only agent registry governance audit snapshot.",
      {},
      agentRegistryGovernanceHandler,
    );

    const agentRegistryRecommendationsHandler = async () => {
      const snapshot = await buildAgentRegistryGovernanceSnapshot();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                checkedAt: snapshot.checkedAt,
                recommendations: snapshot.recommendations,
              },
              null,
              2,
            ),
          },
        ],
      };
    };
    server.tool(
      "agent_registry_recommendations",
      "Returns read-only agent registry governance recommendations.",
      {},
      agentRegistryRecommendationsHandler,
    );

    const docsConfigSnapshotHandler = async () => {
      const snapshot = buildDocsConfigSotSnapshot();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(snapshot, null, 2) },
        ],
      };
    };
    server.tool(
      "docs_config_snapshot",
      "Returns the canonical docs/config SOT snapshot.",
      {},
      docsConfigSnapshotHandler,
    );

    const docsConfigHealthHandler = async () => {
      const snapshot = buildDocsConfigSotSnapshot();
      const docs = buildDocsUnifierReport(snapshot);
      const config = buildConfigGuardianReport(snapshot);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ snapshot, docs, config }, null, 2),
          },
        ],
      };
    };
    server.tool(
      "docs_config_health",
      "Returns the combined docs/config health report.",
      {},
      docsConfigHealthHandler,
    );

    const agentDelegateHandler = async ({ agent_name, task }: any) => {
      try {
        const result = await agentManager.delegate(agent_name, task);
        const text =
          typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return { content: [{ type: "text" as const, text: text }] };
      } catch (error: unknown) {
        const err = ensureError(error);
        return {
          isError: true,
          content: [
            { type: "text" as const, text: `Agent Error: ${err.message}` },
          ],
        };
      }
    };
    server.tool(
      "agent_delegate",
      "Delegates a task to an agent.",
      {
        agent_name: z.string(),
        task: z.string(),
      },
      agentDelegateHandler,
    );

    // CLI compatibility: src/cli.ts expects an MCP tool called `agent_execute`
    // with params { agentName, task, context?: string }
    const agentExecuteHandler = async ({ agentName, task, context }: any) => {
      try {
        let parsedContext: Record<string, unknown> | undefined = undefined;

        if (typeof context === "string" && context.trim().length > 0) {
          try {
            parsedContext = JSON.parse(context) as Record<string, unknown>;
          } catch (error: unknown) {
            const err = ensureError(error);
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: `Invalid JSON in context: ${err.message}`,
                },
              ],
            };
          }
        }

        const result = await agentManager.delegate(
          agentName,
          task,
          parsedContext,
        );
        const text =
          typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return { content: [{ type: "text" as const, text }] };
      } catch (error: unknown) {
        const err = ensureError(error);
        return {
          isError: true,
          content: [
            { type: "text" as const, text: `Agent Error: ${err.message}` },
          ],
        };
      }
    };

    server.tool(
      "agent_execute",
      "Executes an agent with optional JSON context (CLI compatibility).",
      {
        agentName: z.string(),
        task: z.string(),
        context: z.string().optional(),
      },
      agentExecuteHandler,
    );

    // Register Test Scheduler Tools
    const testSchedulerRunMcpHandler = async (args: any) => {
      const result = await testSchedulerRunHandler(args);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    };
    server.tool(
      "test-scheduler-run",
      testSchedulerRunDefinition.description,
      {
        triggerReason: z.string().optional(),
      },
      testSchedulerRunMcpHandler,
    );

    const testSchedulerStatusMcpHandler = async (args: any) => {
      const result = await testSchedulerStatusHandler(args);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    };
    server.tool(
      "test-scheduler-status",
      testSchedulerStatusDefinition.description,
      {
        includeDetails: z.boolean().optional(),
      },
      testSchedulerStatusMcpHandler,
    );

    // Register Szamlazz.hu Invoice Fetcher Tool
    const getSzamlazzInvoicesMcpHandler = async (args: any) => {
      const result = await getSzamlazzInvoicesHandler(args);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    };
    server.tool(
      "get_szamlazz_invoices",
      getSzamlazzInvoicesTool.description,
      {
        since_date: z.string().optional(),
        limit: z.number().optional(),
        force_refresh: z.boolean().optional(),
        include_unpaid_only: z.boolean().optional(),
        get_overdue: z.boolean().optional(),
      },
      getSzamlazzInvoicesMcpHandler,
    );

    // Register Google Sheets Invoice Writer Tool
    const writeSheetsInvoicesMcpHandler = async (args: any) => {
      const result = await writeSheetsInvoicesHandler(args);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    };
    server.tool(
      "write_sheets_invoices",
      writeSheetsInvoicesTool.description,
      {
        invoices: z.array(z.record(z.any())).optional(),
        append: z.boolean().optional(),
        include_line_items: z.boolean().optional(),
        clear_first: z.boolean().optional(),
        skip_duplicates: z.boolean().optional(),
        batch_size: z.number().optional(),
      },
      writeSheetsInvoicesMcpHandler,
    );
  }

  // Always register ping tool (works in any environment)
  const pingHandler = async () => ({
    content: [
      { type: "text" as const, text: "Pong! MCP Brunella Core is active." },
    ],
  });
  server.tool("ping", "A simple ping tool.", {}, pingHandler);
}
