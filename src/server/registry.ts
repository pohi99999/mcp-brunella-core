import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logWarn } from "../utils/logger.js";
import {
  testSchedulerRunDefinition,
  testSchedulerStatusDefinition,
  testSchedulerRunHandler,
  testSchedulerStatusHandler,
} from "../tools/testSchedulerTool.js";
import { agentManager } from "../agents/AgentManager.js";
import {
  getSzamlazzInvoicesTool,
  getSzamlazzInvoicesHandler,
} from "../tools/getSzamlazzInvoices.js";
import {
  writeSheetsInvoicesTool,
  writeSheetsInvoicesHandler,
} from "../tools/writeSheetsInvoices.js";
import {
  crawl4aiCrawlHandler,
  crawl4aiBatchHandler,
} from "../tools/crawl4aiTool.js";
import {
  memoryStoreHandler,
  memoryQueryHandler,
  memoryContextHandler,
  memoryDeleteHandler,
  memoryPurgeHandler,
} from "../tools/memoryTool.js";

import { gmailInvoiceFetcherDefinition, gmailInvoiceFetcherHandler } from "../tools/gmailInvoiceFetcher.js";
// Tool list for dashboard display
export interface RegisteredToolInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "server" | "monitoring" | "configuration" | "custom";
  parameters: { name: string; type: string; required: boolean }[];
}

const registeredToolsList: RegisteredToolInfo[] = [
  {
    id: "ping",
    name: "ping",
    description: "Ellenőrzi a szerver elérhetőségét",
    enabled: true,
    category: "server",
    parameters: [],
  },
  {
    id: "agent_list",
    name: "agent_list",
    description: "Aktív ágensek listázása",
    enabled: true,
    category: "server",
    parameters: [],
  },
  {
    id: "agent_registry",
    name: "agent_registry",
    description: "Összes ágens definíció listázása",
    enabled: true,
    category: "server",
    parameters: [],
  },
  {
    id: "agent_delegate",
    name: "agent_delegate",
    description: "Feladat delegálása ágensnek",
    enabled: true,
    category: "server",
    parameters: [
      { name: "agent_name", type: "string", required: true },
      { name: "task", type: "string", required: true },
    ],
  },
  {
    id: "agent_execute",
    name: "agent_execute",
    description:
      "Execute an agent with optional JSON context (CLI compatibility)",
    enabled: true,
    category: "server",
    parameters: [
      { name: "agentName", type: "string", required: true },
      { name: "task", type: "string", required: true },
      { name: "context", type: "string", required: false },
    ],
  },
  {
    id: "test-scheduler-run",
    name: "test-scheduler-run",
    description: "Trigger a manual test run immediately",
    enabled: true,
    category: "monitoring",
    parameters: [
      { name: "triggerReason", type: "string", required: false },
    ],
  },
  {
    id: "test-scheduler-status",
    name: "test-scheduler-status",
    description: "Get the current test scheduler status and recent test statistics",
    enabled: true,
    category: "monitoring",
    parameters: [
      { name: "includeDetails", type: "boolean", required: false },
    ],
  },
  {
    id: "get_szamlazz_invoices",
    name: "get_szamlazz_invoices",
    description: "Lekéri a számlákat a Számlázz.hu API-ból InvoiceData formátumban",
    enabled: true,
    category: "custom",
    parameters: [
      { name: "since_date", type: "string", required: false },
      { name: "limit", type: "integer", required: false },
      { name: "force_refresh", type: "boolean", required: false },
      { name: "include_unpaid_only", type: "boolean", required: false },
      { name: "get_overdue", type: "boolean", required: false },
    ],
  },
  {
    id: "write_sheets_invoices",
    name: "write_sheets_invoices",
    description: "Invoice adatok írása Google Sheets-be (batch mode)",
    enabled: true,
    category: "custom",
    parameters: [
      { name: "invoices", type: "array", required: true },
      { name: "append", type: "boolean", required: false },
      { name: "include_line_items", type: "boolean", required: false },
      { name: "clear_first", type: "boolean", required: false },
      { name: "skip_duplicates", type: "boolean", required: false },
      { name: "batch_size", type: "number", required: false },
    ],
  },
  {
    id: "get_ai_recommendation",
    name: "get_ai_recommendation",
    description: "AI-alapú ajánlásokat ad vissza LanceDB RAG keresés segítségével",
    enabled: true,
    category: "custom",
    parameters: [
      { name: "query", type: "string", required: true },
      { name: "limit", type: "number", required: false },
      { name: "context", type: "string", required: false },
    ],
  },
];

// Internal tool handler map
const toolHandlers = new Map<string, (args: any) => Promise<any>>();
let dynamicAgentsRegistered = false;

export async function registerAgents() {
  // AgentManager is now directly imported and always available
  // No need for conditional import here

  // Initialize AgentManager - this loads all agents from registry.json
  await agentManager.initialize();

  // Initialize Dynamic Agents (not in registry.json)
  if (dynamicAgentsRegistered) {
    return;
  }

  try {
    const { DynamicAgent } = await import("../agents/DynamicAgent.js");
    const { UXDesignerAgent } = await import("../agents/UXDesignerAgent.js");
    const path = await import("path");
    const agentsDir = path.default.join(process.cwd(), "myai/agents");
    if (!agentManager.getAgent("project_organizer")) {
      agentManager.registerAgent(
        new DynamicAgent(path.default.join(agentsDir, "project_organizer.toml")),
      );
    }
    if (!agentManager.getAgent("agent_architect")) {
      agentManager.registerAgent(
        new DynamicAgent(path.default.join(agentsDir, "agent_architect.toml")),
      );
    }
    if (!agentManager.getAgent("UXDesigner")) {
      agentManager.registerAgent(new UXDesignerAgent());
    }
    dynamicAgentsRegistered = true;
  } catch (e: any) {
    logWarn("System", `Could not load dynamic agents: ${e.message}`);
  }
}

export async function registerAllTools(server: McpServer) {
  // Register Gmail Invoice Fetcher Tool
  server.tool(
    "gmail_invoice_fetcher",
    "Letölti a Gmail-ből a PDF számlákat és elmenti az invoices mappába.",
    {
      query: z.string().optional().describe('Gmail keresési lekérdezés, pl. "has:attachment filename:pdf"'),
      saveDir: z.string().optional().describe('Mentési könyvtár, alapértelmezett: invoices')
    },
    async (args) => gmailInvoiceFetcherHandler(args, {})
  );
  // Dynamically import Node.js-specific modules only in Node environment
  const isNode = typeof process !== "undefined" && process.versions?.node;

  if (isNode) {
    await registerAgents();

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
    const { registerEphemeralAgentTools } = await import("../tools/ephemeralAgentControl.js");

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
    registerEphemeralAgentTools(server);

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
    toolHandlers.set("agent_list", agentListHandler);

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
    toolHandlers.set("agent_registry", agentRegistryHandler);

    const agentDelegateHandler = async ({ agent_name, task }: any) => {
      try {
        const result = await agentManager.delegate(agent_name, task);
        const text =
          typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return { content: [{ type: "text" as const, text: text }] };
      } catch (e: any) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: `Agent Error: ${e.message}` },
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
    toolHandlers.set("agent_delegate", agentDelegateHandler);

    // CLI compatibility: src/cli.ts expects an MCP tool called `agent_execute`
    // with params { agentName, task, context?: string }
    const agentExecuteHandler = async ({ agentName, task, context }: any) => {
      try {
        let parsedContext: Record<string, unknown> | undefined = undefined;

        if (typeof context === "string" && context.trim().length > 0) {
          try {
            parsedContext = JSON.parse(context) as Record<string, unknown>;
          } catch (e: any) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: `Invalid JSON in context: ${e?.message ?? String(e)}`,
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
      } catch (e: any) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: `Agent Error: ${e.message}` },
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
    toolHandlers.set("agent_execute", agentExecuteHandler);

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
    toolHandlers.set("test-scheduler-run", testSchedulerRunMcpHandler);

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
    toolHandlers.set("test-scheduler-status", testSchedulerStatusMcpHandler);

    // Register Számlázz.hu Invoice Fetcher Tool
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
    toolHandlers.set("get_szamlazz_invoices", getSzamlazzInvoicesMcpHandler);

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
    toolHandlers.set("write_sheets_invoices", writeSheetsInvoicesMcpHandler);
  }

  // Always register ping tool (works in any environment)
  const pingHandler = async () => ({
    content: [
      { type: "text" as const, text: "Pong! MCP Brunella Core is active." },
    ],
  });
  server.tool("ping", "A simple ping tool.", {}, pingHandler);
  toolHandlers.set("ping", pingHandler);

  // ─── Crawl4AI Tools ──────────────────────────────────────────────────
  const crawl4aiCrawlMcp = async (args: { url: string; extract_schema?: string; wait_for_selector?: string }) => {
    const result = await crawl4aiCrawlHandler(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  };
  server.tool(
    "crawl4ai_crawl",
    "Web crawling Crawl4AI-vel: stealth böngésző, Markdown kimenet, opcionális séma-alapú adatkinyerés",
    {
      url: z.string().describe("A crawlolandó URL"),
      extract_schema: z.string().optional().describe("JSON séma a struktúrált adatkinyeréshez"),
      wait_for_selector: z.string().optional().describe("CSS selector amire várni kell betöltéskor"),
    },
    crawl4aiCrawlMcp,
  );
  toolHandlers.set("crawl4ai_crawl", crawl4aiCrawlMcp);

  const crawl4aiBatchMcp = async (args: { urls: string[]; extract_schema?: string }) => {
    const result = await crawl4aiBatchHandler(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  };
  server.tool(
    "crawl4ai_batch",
    "Több URL párhuzamos crawlolása Crawl4AI-vel",
    {
      urls: z.array(z.string()).describe("Crawlolandó URL-ek listája"),
      extract_schema: z.string().optional().describe("JSON séma az adatkinyeréshez"),
    },
    crawl4aiBatchMcp,
  );
  toolHandlers.set("crawl4ai_batch", crawl4aiBatchMcp);

  // ─── Memory / User Preferences Tools ─────────────────────────────────
  const memStoreMcp = async (args: { user_id: string; key: string; value: string; memory_type?: string; ttl_days?: number }) => {
    const result = await memoryStoreHandler(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  };
  server.tool(
    "memory_store_preference",
    "Felhasználói preferencia mentése (episodic/semantic/procedural memória típusok)",
    {
      user_id: z.string().describe("Felhasználó azonosító"),
      key: z.string().describe("Preferencia kulcs (pl. 'language', 'theme')"),
      value: z.string().describe("Preferencia értéke"),
      memory_type: z.string().optional().describe("Memória típus: episodic | semantic | procedural (alapértelmezett: semantic)"),
      ttl_days: z.number().optional().describe("Lejárati idő napokban (alapértelmezett: nincs lejárat)"),
    },
    memStoreMcp,
  );
  toolHandlers.set("memory_store_preference", memStoreMcp);

  const memQueryMcp = async (args: { user_id: string; memory_type?: string; key_pattern?: string; limit?: number }) => {
    const result = await memoryQueryHandler(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  };
  server.tool(
    "memory_query_preferences",
    "Felhasználói preferenciák lekérdezése szűrőkkel",
    {
      user_id: z.string().describe("Felhasználó azonosító"),
      memory_type: z.string().optional().describe("Szűrés memória típusra"),
      key_pattern: z.string().optional().describe("LIKE minta a kulcsra (pl. 'lang%')"),
      limit: z.number().optional().describe("Max visszaadott rekordok száma"),
    },
    memQueryMcp,
  );
  toolHandlers.set("memory_query_preferences", memQueryMcp);

  const memContextMcp = async (args: { user_id: string }) => {
    const result = await memoryContextHandler(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  };
  server.tool(
    "memory_get_context",
    "Felhasználó teljes preferencia kontextusának lekérdezése prompt injection-höz",
    {
      user_id: z.string().describe("Felhasználó azonosító"),
    },
    memContextMcp,
  );
  toolHandlers.set("memory_get_context", memContextMcp);

  const memDeleteMcp = async (args: { user_id: string; key: string; memory_type?: string }) => {
    const result = await memoryDeleteHandler(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  };
  server.tool(
    "memory_delete_preference",
    "Felhasználói preferencia törlése",
    {
      user_id: z.string().describe("Felhasználó azonosító"),
      key: z.string().describe("Törlendő preferencia kulcs"),
      memory_type: z.string().optional().describe("Memória típus (ha nincs megadva, mindegyikből törli)"),
    },
    memDeleteMcp,
  );
  toolHandlers.set("memory_delete_preference", memDeleteMcp);
}

export async function executeLocalTool(name: string, args: any) {
  const handler = toolHandlers.get(name);
  if (handler) {
    return await handler(args);
  }
  throw new Error(`Tool ${name} not found or not executable directly.`);
}

export function getRegisteredToolsList(): RegisteredToolInfo[] {
  return registeredToolsList;
}
