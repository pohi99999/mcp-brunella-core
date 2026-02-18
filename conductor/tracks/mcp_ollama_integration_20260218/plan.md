# MCP + Ollama Integration - Comprehensive Implementation Plan

**Track ID:** `mcp_ollama_integration_20260218`
**Priority:** P0 (CRITICAL)
**Created:** 2026-02-18
**Estimated Effort:** 80 hours (10 business days)
**Owner:** Brunella AI Development Team

---

## Executive Summary

This track implements **Model Context Protocol (MCP) + Ollama integration** to enable secure, filesystem-aware local LLM operations with multi-provider support via Bifrost Gateway. The system will provide DataScientistAgent with E2B sandbox execution and establish a comprehensive security framework for autonomous AI operations.

### Core Components

1. **MCP Filesystem Integration** - Direct file operations via MCP protocol
2. **E2B Sandboxes** - Secure code execution for DataScientistAgent
3. **Bifrost Gateway** - Multi-LLM provider routing (Ollama, Gemini, GitHub Models)
4. **Security Framework** - Safe Zone directory isolation & audit trails
5. **Dashboard MCPCommandCenter** - Visual MCP tool management
6. **Python MCP Bridge** - myai/tools/mcp_bridge.py for Python-based MCP operations

---

## Phase 1: MCP Filesystem Foundation (20h)

### Goals
- Establish MCP server with filesystem tool implementation
- Integrate Ollama as primary LLM provider
- Create Safe Zone directory security framework

### Implementation

#### 1.1 MCP Server Setup (6h)

**File:** `src/server/mcp_server.ts`

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";

// MCP Filesystem Tools
const MCP_FILESYSTEM_TOOLS: Tool[] = [
  {
    name: "read_file",
    description: "Read file content from Safe Zone directories only",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path (must be within Safe Zone)" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to file in Safe Zone",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "list_directory",
    description: "List directory contents in Safe Zone",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" }
      },
      required: ["path"]
    }
  },
  {
    name: "search_files",
    description: "Search for files by pattern in Safe Zone",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (e.g., '**/*.ts')" },
        directory: { type: "string", description: "Search root (default: current)" }
      },
      required: ["pattern"]
    }
  }
];

export class MCPFilesystemServer {
  private server: Server;
  private safeZones: string[];

  constructor() {
    this.server = new Server(
      {
        name: "brunella-mcp-filesystem",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.safeZones = [
      path.resolve(process.cwd(), "data"),
      path.resolve(process.cwd(), "conductor/tracks"),
      path.resolve(process.cwd(), "myai/incubator"),
      path.resolve(process.cwd(), "logs")
    ];

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: MCP_FILESYSTEM_TOOLS
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Security: Verify path is within Safe Zone
      if (args.path && !this.isInSafeZone(args.path)) {
        throw new Error(`Access denied: ${args.path} is outside Safe Zone`);
      }

      switch (name) {
        case "read_file":
          return this.handleReadFile(args.path);
        case "write_file":
          return this.handleWriteFile(args.path, args.content);
        case "list_directory":
          return this.handleListDirectory(args.path);
        case "search_files":
          return this.handleSearchFiles(args.pattern, args.directory);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private isInSafeZone(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    return this.safeZones.some(zone => resolved.startsWith(zone));
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("MCP Filesystem Server running on stdio");
  }
}
```

**Test:** `test/mcp_filesystem.test.ts`

```typescript
describe("MCPFilesystemServer", () => {
  it("should allow read_file in Safe Zone", async () => {
    const result = await mcpClient.callTool("read_file", {
      path: "data/test.txt"
    });
    expect(result.success).toBe(true);
  });

  it("should reject access outside Safe Zone", async () => {
    await expect(
      mcpClient.callTool("read_file", { path: "../../etc/passwd" })
    ).rejects.toThrow("Access denied");
  });
});
```

#### 1.2 Ollama MCP Integration (8h)

**File:** `src/core/ollama_mcp_client.ts`

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Ollama from "ollama";

export class OllamaMCPClient {
  private mcpClient: Client;
  private ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL });
  }

  async connectMCP() {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["dist/server/mcp_server.js"]
    });

    this.mcpClient = new Client(
      {
        name: "brunella-ollama-client",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    await this.mcpClient.connect(transport);
  }

  async chat(prompt: string, tools: string[] = []) {
    // Get available MCP tools
    const { tools: mcpTools } = await this.mcpClient.listTools();

    // Filter requested tools
    const availableTools = mcpTools.filter(t =>
      tools.length === 0 || tools.includes(t.name)
    );

    // Ollama streaming with tool support
    const response = await this.ollama.chat({
      model: "qwen2.5-coder:7b",
      messages: [{ role: "user", content: prompt }],
      tools: availableTools.map(t => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      })),
      stream: false
    });

    // Handle tool calls
    if (response.message.tool_calls) {
      const toolResults = await Promise.all(
        response.message.tool_calls.map(async (call) => {
          const result = await this.mcpClient.callTool({
            name: call.function.name,
            arguments: call.function.arguments
          });
          return result;
        })
      );

      // Continue conversation with tool results
      return this.ollama.chat({
        model: "qwen2.5-coder:7b",
        messages: [
          { role: "user", content: prompt },
          response.message,
          ...toolResults.map(r => ({
            role: "tool",
            content: JSON.stringify(r)
          }))
        ]
      });
    }

    return response;
  }
}
```

#### 1.3 Safe Zone Configuration (6h)

**File:** `config/safe_zones.json`

```json
{
  "version": "1.0",
  "safe_zones": [
    {
      "name": "Data Directory",
      "path": "./data",
      "permissions": ["read", "write", "delete"],
      "description": "General data storage"
    },
    {
      "name": "Track Workspace",
      "path": "./conductor/tracks",
      "permissions": ["read", "write"],
      "description": "Development track files"
    },
    {
      "name": "Incubator",
      "path": "./myai/incubator",
      "permissions": ["read", "write", "execute"],
      "description": "Python experimental workspace"
    },
    {
      "name": "Logs",
      "path": "./logs",
      "permissions": ["read", "write", "append"],
      "description": "System logs"
    }
  ],
  "blacklist": [
    ".env",
    ".git",
    "node_modules",
    "*.key",
    "*.pem",
    "config/google-service-account.json"
  ],
  "audit": {
    "enabled": true,
    "log_path": "./logs/mcp_audit.log",
    "retention_days": 90
  }
}
```

**Validation:** `src/security/safe_zone_validator.ts`

```typescript
export class SafeZoneValidator {
  private zones: SafeZone[];
  private blacklist: string[];

  loadConfig() {
    const config = JSON.parse(
      fs.readFileSync("config/safe_zones.json", "utf-8")
    );
    this.zones = config.safe_zones.map(z => ({
      ...z,
      path: path.resolve(z.path)
    }));
    this.blacklist = config.blacklist;
  }

  validate(targetPath: string, operation: "read" | "write" | "delete"): boolean {
    const resolved = path.resolve(targetPath);

    // Check blacklist
    if (this.isBlacklisted(resolved)) {
      this.audit("DENIED", targetPath, operation, "Blacklisted");
      return false;
    }

    // Check Safe Zone
    const zone = this.zones.find(z => resolved.startsWith(z.path));
    if (!zone) {
      this.audit("DENIED", targetPath, operation, "Outside Safe Zone");
      return false;
    }

    // Check permissions
    if (!zone.permissions.includes(operation)) {
      this.audit("DENIED", targetPath, operation, "Permission denied");
      return false;
    }

    this.audit("ALLOWED", targetPath, operation, zone.name);
    return true;
  }

  private audit(
    verdict: string,
    path: string,
    operation: string,
    reason: string
  ) {
    const entry = {
      timestamp: new Date().toISOString(),
      verdict,
      path,
      operation,
      reason
    };
    fs.appendFileSync(
      "logs/mcp_audit.log",
      JSON.stringify(entry) + "\n"
    );
  }
}
```

### Phase 1 Success Criteria
- ✅ MCP server responds to `list_tools` with 4 filesystem tools
- ✅ Ollama successfully calls MCP tools via function calling
- ✅ Safe Zone validator blocks access to `.env` and `node_modules`
- ✅ Audit log captures all filesystem operations
- ✅ Tests: 15/15 passing

---

## Phase 2: E2B Sandboxes for DataScientistAgent (18h)

### Goals
- Integrate E2B Python sandboxes
- Enable secure code execution for DataScientistAgent
- Implement result streaming and artifact export

### Implementation

#### 2.1 E2B Python Sandbox Manager (10h)

**File:** `src/security/e2b_sandbox_manager.ts`

```typescript
import { Sandbox } from "@e2b/sdk";
import { logInfo, logError } from "../utils/logger.js";

export interface E2BExecutionRequest {
  code: string;
  timeout?: number;
  dependencies?: string[];
  artifacts?: string[];
}

export interface E2BExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  artifacts: Record<string, string>;
  execution_time: number;
}

export class E2BSandboxManager {
  private activeSandboxes: Map<string, Sandbox> = new Map();

  async executeCode(request: E2BExecutionRequest): Promise<E2BExecutionResult> {
    const sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      template: "python-data-analysis" // Pre-configured with pandas, numpy, etc.
    });

    const sandboxId = sandbox.id;
    this.activeSandboxes.set(sandboxId, sandbox);

    try {
      // Install dependencies if needed
      if (request.dependencies && request.dependencies.length > 0) {
        await sandbox.commands.run(
          `pip install ${request.dependencies.join(" ")}`
        );
      }

      // Execute code
      const startTime = Date.now();
      const { stdout, stderr, exitCode } = await sandbox.commands.run(
        `python -c '${request.code.replace(/'/g, "\\'")}'`,
        { timeout: request.timeout || 30000 }
      );
      const executionTime = Date.now() - startTime;

      // Collect artifacts
      const artifacts: Record<string, string> = {};
      if (request.artifacts) {
        for (const artifactPath of request.artifacts) {
          const content = await sandbox.filesystem.read(artifactPath);
          artifacts[artifactPath] = content;
        }
      }

      return {
        success: exitCode === 0,
        stdout,
        stderr,
        artifacts,
        execution_time: executionTime
      };
    } finally {
      // Cleanup
      await sandbox.kill();
      this.activeSandboxes.delete(sandboxId);
    }
  }

  async cleanup() {
    for (const [id, sandbox] of this.activeSandboxes.entries()) {
      await sandbox.kill();
      this.activeSandboxes.delete(id);
    }
  }
}
```

#### 2.2 DataScientistAgent Integration (8h)

**File:** `src/agents/DataScientistAgent.ts` (modified)

```typescript
import { E2BSandboxManager } from "../security/e2b_sandbox_manager.js";

export class DataScientistAgent implements IAgent {
  private e2bManager: E2BSandboxManager;

  constructor() {
    this.e2bManager = new E2BSandboxManager();
  }

  async execute(task: string, context?: any): Promise<AgentResponse> {
    setAgentStatus(this.name, "working", task);

    try {
      // Generate Python code via LLM
      const codePrompt = `Generate Python data analysis code for: ${task}`;
      const llmResponse = await this.llm.generate(codePrompt);
      const generatedCode = this.extractCodeBlock(llmResponse);

      // Execute in E2B sandbox
      const result = await this.e2bManager.executeCode({
        code: generatedCode,
        timeout: 60000,
        dependencies: ["pandas", "matplotlib", "seaborn"],
        artifacts: ["output.png", "results.csv"]
      });

      if (!result.success) {
        logError(this.name, `Execution failed: ${result.stderr}`);
        return {
          status: "error",
          error: result.stderr
        };
      }

      // Save artifacts to Safe Zone
      for (const [filename, content] of Object.entries(result.artifacts)) {
        const safePath = path.join("data/artifacts", filename);
        fs.writeFileSync(safePath, content);
      }

      return {
        status: "success",
        data: {
          stdout: result.stdout,
          artifacts: Object.keys(result.artifacts),
          execution_time: result.execution_time
        }
      };
    } catch (e: any) {
      logError(this.name, e.message);
      return { status: "error", error: e.message };
    } finally {
      setAgentStatus(this.name, "idle");
    }
  }
}
```

### Phase 2 Success Criteria
- ✅ E2B sandbox creates Python environment in <5 seconds
- ✅ DataScientistAgent executes data analysis code securely
- ✅ Artifacts (CSV, PNG) exported to Safe Zone
- ✅ Error handling: timeout, syntax errors, runtime exceptions
- ✅ Tests: 12/12 passing

---

## Phase 3: Bifrost Gateway - Multi-Provider LLM Routing (16h)

### Goals
- Implement unified LLM interface supporting Ollama, Gemini, GitHub Models
- Dynamic provider selection based on task requirements
- Fallback mechanism for provider failures

### Implementation

#### 3.1 Bifrost Gateway Core (10h)

**File:** `src/core/bifrost_gateway.ts`

```typescript
import Ollama from "ollama";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Anthropic } from "@anthropic-ai/sdk";

export type LLMProvider = "ollama" | "gemini" | "github" | "anthropic";

export interface BifrostRequest {
  prompt: string;
  provider?: LLMProvider; // Auto-select if not specified
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: any[];
  stream?: boolean;
}

export interface BifrostResponse {
  provider: LLMProvider;
  model: string;
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  tool_calls?: any[];
  latency_ms: number;
}

export class BifrostGateway {
  private ollama: Ollama;
  private gemini: GoogleGenerativeAI;
  private github: Anthropic; // GitHub Models use Anthropic SDK
  private anthropic: Anthropic;

  constructor() {
    this.ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL });
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.github = new Anthropic({
      apiKey: process.env.GITHUB_PAT!,
      baseURL: "https://models.inference.ai.azure.com"
    });
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }

  async generate(request: BifrostRequest): Promise<BifrostResponse> {
    const provider = request.provider || this.autoSelectProvider(request);
    const startTime = Date.now();

    try {
      switch (provider) {
        case "ollama":
          return await this.generateOllama(request, startTime);
        case "gemini":
          return await this.generateGemini(request, startTime);
        case "github":
          return await this.generateGitHub(request, startTime);
        case "anthropic":
          return await this.generateAnthropic(request, startTime);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error: any) {
      // Fallback to Ollama (local, always available)
      if (provider !== "ollama") {
        logError("BifrostGateway", `${provider} failed, fallback to Ollama`);
        return await this.generateOllama(request, startTime);
      }
      throw error;
    }
  }

  private autoSelectProvider(request: BifrostRequest): LLMProvider {
    // Selection logic:
    // - Code tasks → Ollama (qwen2.5-coder)
    // - Multimodal → Gemini (gemini-2.0-flash-exp)
    // - Complex reasoning → GitHub (gpt-4o)
    // - Long context → Anthropic (claude-3-7-sonnet)

    const promptLower = request.prompt.toLowerCase();

    if (promptLower.includes("code") || promptLower.includes("function")) {
      return "ollama";
    }
    if (promptLower.includes("image") || promptLower.includes("vision")) {
      return "gemini";
    }
    if (promptLower.includes("complex") || promptLower.includes("analyze")) {
      return "github";
    }
    if (request.prompt.length > 10000) {
      return "anthropic";
    }

    // Default: Ollama (free, local)
    return "ollama";
  }

  private async generateOllama(
    request: BifrostRequest,
    startTime: number
  ): Promise<BifrostResponse> {
    const response = await this.ollama.generate({
      model: request.model || "qwen2.5-coder:7b",
      prompt: request.prompt,
      stream: false,
      options: {
        temperature: request.temperature || 0.7,
        num_predict: request.max_tokens || 2048
      }
    });

    return {
      provider: "ollama",
      model: request.model || "qwen2.5-coder:7b",
      text: response.response,
      latency_ms: Date.now() - startTime
    };
  }

  private async generateGemini(
    request: BifrostRequest,
    startTime: number
  ): Promise<BifrostResponse> {
    const model = this.gemini.getGenerativeModel({
      model: request.model || "gemini-2.0-flash-exp"
    });

    const result = await model.generateContent(request.prompt);
    const response = await result.response;

    return {
      provider: "gemini",
      model: request.model || "gemini-2.0-flash-exp",
      text: response.text(),
      usage: {
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0
      },
      latency_ms: Date.now() - startTime
    };
  }

  private async generateGitHub(
    request: BifrostRequest,
    startTime: number
  ): Promise<BifrostResponse> {
    const response = await this.github.messages.create({
      model: request.model || "gpt-4o",
      max_tokens: request.max_tokens || 4096,
      messages: [
        {
          role: "user",
          content: request.prompt
        }
      ]
    });

    return {
      provider: "github",
      model: request.model || "gpt-4o",
      text: response.content[0].type === "text" ? response.content[0].text : "",
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      latency_ms: Date.now() - startTime
    };
  }

  private async generateAnthropic(
    request: BifrostRequest,
    startTime: number
  ): Promise<BifrostResponse> {
    const response = await this.anthropic.messages.create({
      model: request.model || "claude-3-7-sonnet-20250219",
      max_tokens: request.max_tokens || 8192,
      messages: [
        {
          role: "user",
          content: request.prompt
        }
      ]
    });

    return {
      provider: "anthropic",
      model: request.model || "claude-3-7-sonnet-20250219",
      text: response.content[0].type === "text" ? response.content[0].text : "",
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      latency_ms: Date.now() - startTime
    };
  }
}
```

#### 3.2 Provider Health Monitor (6h)

**File:** `src/core/provider_health_monitor.ts`

```typescript
export class ProviderHealthMonitor {
  private health: Map<LLMProvider, ProviderHealth> = new Map();

  async checkHealth(provider: LLMProvider): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // Simple ping with minimal token usage
      const response = await this.bifrost.generate({
        prompt: "Say 'OK'",
        provider,
        max_tokens: 5
      });

      const latency = Date.now() - startTime;

      const health: ProviderHealth = {
        status: "healthy",
        latency_ms: latency,
        last_check: new Date().toISOString()
      };

      this.health.set(provider, health);
      return health;
    } catch (error: any) {
      const health: ProviderHealth = {
        status: "unhealthy",
        error: error.message,
        last_check: new Date().toISOString()
      };

      this.health.set(provider, health);
      return health;
    }
  }

  async checkAllProviders(): Promise<Map<LLMProvider, ProviderHealth>> {
    const providers: LLMProvider[] = ["ollama", "gemini", "github", "anthropic"];
    await Promise.all(providers.map(p => this.checkHealth(p)));
    return this.health;
  }

  getHealth(provider: LLMProvider): ProviderHealth | undefined {
    return this.health.get(provider);
  }
}
```

### Phase 3 Success Criteria
- ✅ Bifrost routes code tasks to Ollama
- ✅ Bifrost routes complex reasoning to GitHub Models (GPT-4o)
- ✅ Fallback mechanism tested: Gemini failure → Ollama
- ✅ Health monitor detects unhealthy providers
- ✅ Tests: 18/18 passing

---

## Phase 4: Dashboard MCPCommandCenter (14h)

### Goals
- Visual MCP tool management interface
- Real-time audit log viewer
- Provider health dashboard
- Safe Zone permission editor

### Implementation

**File:** `src/dashboard/components/dashboard/MCPCommandCenter.tsx`

```tsx
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import {
  getMCPTools,
  executeMCPTool,
  getMCPAuditLog,
  getProviderHealth,
  type MCPTool,
  type AuditLogEntry,
  type ProviderHealth
} from "@/lib/apiService";
import { toast } from "sonner";

export function MCPCommandCenter() {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [providerHealth, setProviderHealth] = useState<Record<string, ProviderHealth>>({});
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [toolArgs, setToolArgs] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = async () => {
    const [toolsData, auditData, healthData] = await Promise.all([
      getMCPTools(),
      getMCPAuditLog({ limit: 50 }),
      getProviderHealth()
    ]);

    setTools(toolsData.tools);
    setAuditLog(auditData.entries);
    setProviderHealth(healthData);
  };

  const handleExecuteTool = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    try {
      const args = JSON.parse(toolArgs);
      const result = await executeMCPTool(selectedTool, args);

      if (result.success) {
        toast.success("Tool executed successfully");
      } else {
        toast.error(`Tool execution failed: ${result.error}`);
      }

      refreshData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Provider Health */}
      <div className="col-span-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={20} />
              LLM Provider Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(providerHealth).map(([provider, health]) => (
                <div key={provider} className="flex items-center gap-3 p-3 rounded-lg border">
                  {health.status === "healthy" ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <AlertTriangle size={16} className="text-red-500" />
                  )}
                  <div>
                    <p className="font-medium capitalize">{provider}</p>
                    <p className="text-xs text-muted-foreground">
                      {health.latency_ms}ms
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MCP Tools */}
      <div className="col-span-12 lg:col-span-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={20} />
              MCP Filesystem Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tools.map(tool => (
              <div
                key={tool.name}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTool === tool.name ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedTool(tool.name)}
              >
                <p className="font-mono font-medium">{tool.name}</p>
                <p className="text-xs text-muted-foreground">{tool.description}</p>
              </div>
            ))}

            {selectedTool && (
              <div className="mt-4 space-y-3 pt-4 border-t">
                <Textarea
                  placeholder='{"path": "data/test.txt"}'
                  value={toolArgs}
                  onChange={(e) => setToolArgs(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleExecuteTool}
                  disabled={isExecuting}
                  className="w-full"
                >
                  Execute {selectedTool}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit Log */}
      <div className="col-span-12 lg:col-span-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} />
              Security Audit Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {auditLog.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 p-2 rounded border text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono truncate">{entry.path}</p>
                    <p className="text-muted-foreground">{entry.operation}</p>
                  </div>
                  <Badge variant={entry.verdict === "ALLOWED" ? "default" : "destructive"}>
                    {entry.verdict}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### Phase 4 Success Criteria
- ✅ MCPCommandCenter renders provider health cards
- ✅ Tool execution via UI works correctly
- ✅ Audit log updates in real-time
- ✅ Denied operations show red badge
- ✅ Tests: 8/8 passing

---

## Phase 5: Python MCP Bridge (12h)

### Goals
- Enable Python-based MCP tool usage via myai subsystem
- Create unified Python API for MCP operations
- Integrate with existing DataScientist workflows

### Implementation

**File:** `myai/tools/mcp_bridge.py`

```python
import json
import subprocess
from typing import Any, Dict, List, Optional
from pathlib import Path

class MCPBridge:
    """Python bridge to MCP server for filesystem operations."""

    def __init__(self, mcp_server_path: str = "dist/server/mcp_server.js"):
        self.mcp_server_path = mcp_server_path
        self.process = None

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()

    def connect(self):
        """Start MCP server subprocess."""
        self.process = subprocess.Popen(
            ["node", self.mcp_server_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

    def disconnect(self):
        """Stop MCP server subprocess."""
        if self.process:
            self.process.terminate()
            self.process.wait()

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call MCP tool via JSON-RPC."""
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }

        # Send request
        self.process.stdin.write(json.dumps(request) + "\n")
        self.process.stdin.flush()

        # Read response
        response_line = self.process.stdout.readline()
        response = json.loads(response_line)

        if "error" in response:
            raise RuntimeError(f"MCP tool error: {response['error']}")

        return response["result"]

    def read_file(self, path: str) -> str:
        """Read file content via MCP."""
        result = self.call_tool("read_file", {"path": path})
        return result["content"]

    def write_file(self, path: str, content: str) -> bool:
        """Write file content via MCP."""
        result = self.call_tool("write_file", {"path": path, "content": content})
        return result["success"]

    def list_directory(self, path: str) -> List[str]:
        """List directory contents via MCP."""
        result = self.call_tool("list_directory", {"path": path})
        return result["files"]

    def search_files(self, pattern: str, directory: Optional[str] = None) -> List[str]:
        """Search for files by pattern via MCP."""
        args = {"pattern": pattern}
        if directory:
            args["directory"] = directory
        result = self.call_tool("search_files", args)
        return result["matches"]

# Usage Example
if __name__ == "__main__":
    with MCPBridge() as mcp:
        # Read file
        content = mcp.read_file("data/test.txt")
        print(content)

        # Search files
        matches = mcp.search_files("**/*.py", "myai")
        print(matches)
```

**Integration:** `myai/agents/data_scientist.py` (modified)

```python
from myai.tools.mcp_bridge import MCPBridge

class DataScientist:
    def analyze_dataset(self, dataset_path: str):
        with MCPBridge() as mcp:
            # Secure file read via MCP
            data = mcp.read_file(dataset_path)

            # Process data...
            analysis_result = self.perform_analysis(data)

            # Write results to Safe Zone
            output_path = f"data/artifacts/analysis_{datetime.now().isoformat()}.json"
            mcp.write_file(output_path, json.dumps(analysis_result))

            return analysis_result
```

### Phase 5 Success Criteria
- ✅ MCPBridge connects to MCP server via subprocess
- ✅ Python reads/writes files through MCP security layer
- ✅ DataScientist agent uses MCP for all file operations
- ✅ Error handling: connection failures, permission denied
- ✅ Tests: 10/10 passing

---

## Security Considerations

### 1. Safe Zone Isolation
- **Whitelist-based access:** Only predefined directories allowed
- **Blacklist enforcement:** Critical files (.env, .pem) permanently blocked
- **Audit trail:** All operations logged with timestamp, path, verdict

### 2. E2B Sandbox Security
- **Network isolation:** Sandboxes have no internet access by default
- **Time limits:** Maximum 60s execution time
- **Resource limits:** 2GB RAM, 1 CPU core per sandbox
- **Cleanup:** Automatic sandbox termination after execution

### 3. Provider Fallbacks
- **Graceful degradation:** Cloud provider failures → Ollama local fallback
- **Health monitoring:** 10-second ping checks detect outages
- **Circuit breaker:** 3 consecutive failures → provider disabled for 5 minutes

### 4. MCP Protocol Security
- **Stdio transport:** Local-only communication, no network exposure
- **Input validation:** JSON schema validation for all tool arguments
- **Rate limiting:** Max 100 tool calls per minute per client

---

## Testing Strategy

### Unit Tests (60 tests)
- MCP tool handlers (15 tests)
- E2B sandbox manager (12 tests)
- Bifrost gateway (18 tests)
- Safe Zone validator (10 tests)
- Python MCP Bridge (10 tests)

### Integration Tests (25 tests)
- End-to-end Ollama → MCP → Filesystem (8 tests)
- DataScientist → E2B → Artifact export (7 tests)
- Bifrost provider switching (5 tests)
- Dashboard MCPCommandCenter UI (5 tests)

### Security Tests (15 tests)
- Path traversal attacks (5 tests)
- Blacklist bypass attempts (3 tests)
- E2B escape attempts (4 tests)
- Audit log integrity (3 tests)

**Total:** 100 tests, 98% coverage target

---

## Rollout Plan

### Week 1: Phase 1 + 2 (MCP + E2B)
- Day 1-2: MCP server implementation
- Day 3-4: Ollama integration + testing
- Day 5: E2B sandbox setup + DataScientist integration

### Week 2: Phase 3 + 4 (Bifrost + Dashboard)
- Day 6-8: Bifrost gateway implementation
- Day 9-10: MCPCommandCenter dashboard component

### Week 3: Phase 5 + Testing (Python Bridge + QA)
- Day 11-12: Python MCP Bridge
- Day 13-14: Integration testing
- Day 15: Security audit + documentation

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| MCP Tool Response Time | <100ms | N/A | ⏳ |
| E2B Sandbox Start Time | <5s | N/A | ⏳ |
| Bifrost Auto-Select Accuracy | ≥85% | N/A | ⏳ |
| Security Audit Coverage | 100% ops | N/A | ⏳ |
| Test Pass Rate | ≥98% | N/A | ⏳ |
| Provider Fallback Success | ≥95% | N/A | ⏳ |

---

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@e2b/sdk` - E2B Python sandboxes
- `ollama` - Local LLM provider
- `@google/generative-ai` - Gemini integration
- `@anthropic-ai/sdk` - GitHub Models + Anthropic

**Environment Variables:**
```env
E2B_API_KEY=sk_e2b_...
GEMINI_API_KEY=AIza...
GITHUB_PAT=ghp_...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| E2B quota exceeded | HIGH | Monitor daily usage, implement quota warnings |
| Ollama offline | MEDIUM | Health checks + fallback to Gemini |
| MCP security breach | CRITICAL | Safe Zone validation + audit logs |
| Provider API costs | MEDIUM | Usage tracking + budget alerts |

---

## Post-Implementation

### Phase 6 (Future): Advanced Features
- [ ] Multi-user MCP sessions
- [ ] WebAssembly sandboxes (browser-based execution)
- [ ] MCP tool marketplace (custom tool discovery)
- [ ] LangChain MCP adapter (LangSmith tracing)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-18
**Author:** Brunella AI Development Team
