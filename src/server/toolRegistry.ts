import { ToolDefinition } from "../agents/types.js";

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
const registeredToolDefinitions: ToolDefinition[] = [];

export function registerToolHandler(name: string, handler: (args: any) => Promise<any>) {
  toolHandlers.set(name, handler);
}

export function registerToolDefinition(def: ToolDefinition) {
  registeredToolDefinitions.push(def);
}

export async function executeLocalTool(name: string, args: any) {
  const handler = toolHandlers.get(name);
  if (handler) {
    return await handler(args);
  }
  throw new Error(`Tool ${name} not found or not executable directly.`);
}

export function getAllToolDefinitions(): ToolDefinition[] {
  return registeredToolDefinitions;
}

export function getRegisteredToolsList(): RegisteredToolInfo[] {
  return registeredToolsList;
}
