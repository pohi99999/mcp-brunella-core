import express from 'express';
import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { getBifrostGateway } from '@packages/core-logic/bifrost_gateway.js';
import { getSafeZoneValidator } from '@packages/core-logic/safe_zone_validator.js';
import { getE2BSandboxManager } from '@packages/core-logic/e2b_sandbox_manager.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { MCPFilesystemServer } from '../mcp_server.js';
import { mcpProcessManager, type McpServerReadiness, type ServerStatus } from '../McpProcessManager.js';

/**
 * MCP API Routes
 *
 * Endpoints:
 * - GET /api/mcp/providers - List all LLM providers + health
 * - POST /api/mcp/generate - Generate with Bifrost Gateway
 * - GET /api/mcp/tools - List MCP filesystem tools
 * - GET /api/mcp/servers - List configured MCP server runtime states
 * - GET /api/mcp/manifest - Audit MCP manifest readiness without starting servers
 * - POST /api/mcp/tools/:toolName - Execute MCP tool
 * - GET /api/mcp/audit - Get Safe Zone audit log
 * - GET /api/mcp/safezones - List Safe Zone configs
 * - GET /api/mcp/stats - Get usage statistics
 */

const router = express.Router();

// Initialize services
const bifrost = getBifrostGateway();
const validator = getSafeZoneValidator();
const e2bManager = getE2BSandboxManager();
const mcpServer = new MCPFilesystemServer();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function summarizeServerStatuses(servers: ServerStatus[]) {
  return servers.reduce(
    (summary, server) => {
      summary.total += 1;
      summary[server.status] += 1;
      if (server.autoStart) {
        summary.autoStart += 1;
      }
      return summary;
    },
    {
      total: 0,
      running: 0,
      stopped: 0,
      starting: 0,
      error: 0,
      disabled: 0,
      skipped: 0,
      autoStart: 0,
    },
  );
}

function summarizeReadiness(entries: McpServerReadiness[]) {
  return entries.reduce(
    (summary, entry) => {
      summary.total += 1;
      if (entry.canStart) {
        summary.ready += 1;
      }
      if (entry.readinessState === 'action_required') {
        summary.blocked += 1;
        summary.actionRequired += 1;
      }
      if (entry.readinessState === 'disabled' || entry.readinessState === 'unsupported') {
        summary.inactive += 1;
      }
      if (entry.disabled) {
        summary.disabled += 1;
      }
      if (!entry.platformSupported) {
        summary.unsupportedPlatform += 1;
      }
      if (entry.missingRequiredEnv.length > 0) {
        summary.missingEnv += 1;
      }
      return summary;
    },
    {
      total: 0,
        ready: 0,
        blocked: 0,
        actionRequired: 0,
        inactive: 0,
        disabled: 0,
        unsupportedPlatform: 0,
        missingEnv: 0,
    },
  );
}

function parseToolResult(result: CallToolResult): unknown {
  const textContent = result.content.find((entry): entry is TextContent => entry.type === 'text');
  if (textContent) {
    try {
      return JSON.parse(textContent.text) as unknown;
    } catch {
      // Some MCP tools return human-readable text instead of JSON; keep it visible to callers.
    }
  }

  return {
    success: result.isError !== true,
    content: result.content,
    isError: result.isError ?? false,
  };
}

async function ensureMcpConfigLoaded(): Promise<ServerStatus[]> {
  if (mcpProcessManager.getServersStatus().length === 0) {
    await mcpProcessManager.loadConfig();
  }

  return mcpProcessManager.getServersStatus();
}

async function ensureMcpReadinessLoaded(): Promise<McpServerReadiness[]> {
  if (mcpProcessManager.getServersStatus().length === 0) {
    await mcpProcessManager.loadConfig();
  }

  return mcpProcessManager.getServersReadiness();
}

/**
 * GET /api/mcp/providers
 * List all LLM providers with health status
 */
router.get('/providers', async (req, res) => {
  try {
    const health = await bifrost.checkHealth();
    const enabled = bifrost.getEnabledProviders();
    const stats = bifrost.getStats();

    res.json({
      success: true,
      providers: health,
      enabled_providers: enabled,
      stats
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `GET /providers failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * POST /api/mcp/generate
 * Generate LLM response via Bifrost Gateway
 *
 * Body: { prompt, taskType?, provider?, temperature?, maxTokens? }
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, taskType, provider, temperature, maxTokens, systemPrompt, userId } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'prompt is required and must be a string'
      });
    }

    logInfo('MCP API', `Generate request: ${prompt.slice(0, 50)}... (provider: ${provider || 'auto'})`);

    const result = await bifrost.generate({
      prompt,
      taskType,
      provider,
      temperature,
      maxTokens,
      systemPrompt,
      userId,
    });

    res.json(result);
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `POST /generate failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * GET /api/mcp/tools
 * List all MCP filesystem tools
 */
router.get('/tools', (req, res) => {
  try {
    const tools = mcpServer.getTools();

    res.json({
      success: true,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      })),
      count: tools.length
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `GET /tools failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * GET /api/mcp/servers
 * List configured MCP servers with runtime status from McpProcessManager.
 */
router.get('/servers', async (_req, res) => {
  try {
    const servers = await ensureMcpConfigLoaded();

    res.json({
      success: true,
      servers,
      summary: summarizeServerStatuses(servers),
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `GET /servers failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * GET /api/mcp/manifest
 * Side-effect-free MCP manifest readiness audit. Does not start or stop servers.
 */
router.get('/manifest', async (_req, res) => {
  try {
    const entries = await ensureMcpReadinessLoaded();

    res.json({
      success: true,
      entries,
      summary: summarizeReadiness(entries),
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `GET /manifest failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * POST /api/mcp/servers/:name/start
 * Start one configured MCP server.
 */
router.post('/servers/:name/start', async (req, res) => {
  try {
    const serverName = req.params.name;
    const servers = await ensureMcpConfigLoaded();
    if (!servers.some((server) => server.name === serverName)) {
      return res.status(404).json({ success: false, error: `MCP server not found: ${serverName}` });
    }

    const started = await mcpProcessManager.startServer(serverName);
    const updatedServers = mcpProcessManager.getServersStatus();
    const status = updatedServers.find((server) => server.name === serverName);

    res.status(started ? 200 : 409).json({
      success: started,
      server: status,
      summary: summarizeServerStatuses(updatedServers),
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `POST /servers/${req.params.name}/start failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * POST /api/mcp/servers/:name/stop
 * Stop one configured MCP server.
 */
router.post('/servers/:name/stop', async (req, res) => {
  try {
    const serverName = req.params.name;
    const servers = await ensureMcpConfigLoaded();
    if (!servers.some((server) => server.name === serverName)) {
      return res.status(404).json({ success: false, error: `MCP server not found: ${serverName}` });
    }

    await mcpProcessManager.stopServer(serverName);
    const updatedServers = mcpProcessManager.getServersStatus();

    res.json({
      success: true,
      server: updatedServers.find((server) => server.name === serverName),
      summary: summarizeServerStatuses(updatedServers),
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `POST /servers/${req.params.name}/stop failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * POST /api/mcp/tools/:toolName
 * Execute MCP tool with arguments
 *
 * Body: { args: {...} }
 */
router.post('/tools/:toolName', async (req, res) => {
  try {
    const { toolName } = req.params;
    const body = isRecord(req.body) ? req.body : {};
    const args = body.args;

    if (!isRecord(args)) {
      return res.status(400).json({
        success: false,
        error: 'args is required and must be an object'
      });
    }

    if (!mcpServer.getTools().some((tool) => tool.name === toolName)) {
      return res.status(404).json({
        success: false,
        error: `Tool not found: ${toolName}`
      });
    }

    logInfo('MCP API', `Tool execution: ${toolName} with args: ${JSON.stringify(args).slice(0, 100)}`);

    const result = await mcpServer.executeTool(toolName, args);
    const parsed = parseToolResult(result);

    res.json(parsed);
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `POST /tools/${req.params.toolName} failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * GET /api/mcp/audit
 * Get Safe Zone audit log (recent entries)
 *
 * Query: ?limit=50
 */
router.get('/audit', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const auditLog = validator.getAuditLog(limit);

    res.json({
      success: true,
      audit_log: auditLog,
      count: auditLog.length
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `GET /audit failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * GET /api/mcp/safezones
 * List Safe Zone configurations
 */
router.get('/safezones', (req, res) => {
  try {
    const config = validator.getConfig();

    res.json({
      success: true,
      safe_zones: config.safe_zones.map((zone) => ({
        name: zone.name,
        path: zone.path,
        permissions: zone.permissions,
        max_file_size_mb: zone.max_file_size_mb,
        allowed_extensions: zone.allowed_extensions
      })),
      blacklist: config.blacklist,
      rate_limiting: config.rate_limiting
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `GET /safezones failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * GET /api/mcp/stats
 * Get MCP usage statistics
 */
router.get('/stats', (req, res) => {
  try {
    const bifrostStats = bifrost.getStats();
    const e2bStats = e2bManager.getStats();

    res.json({
      success: true,
      bifrost: bifrostStats,
      e2b: e2bStats,
      timestamp: new Date().toISOString()
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `GET /stats failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

/**
 * POST /api/mcp/e2b/execute
 * Execute Python code in E2B sandbox
 *
 * Body: { code, packages?, timeout_ms? }
 */
router.post('/e2b/execute', async (req, res) => {
  try {
    const { code, packages, timeout_ms } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'code is required and must be a string'
      });
    }

    logInfo('MCP API', `E2B execution: ${code.slice(0, 50)}...`);

    const result = await e2bManager.executeCode(code, {
      packages: packages || [],
      timeout_ms: timeout_ms || 60000,
      export_artifacts: true
    });

    res.json(result);
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('MCP API', `POST /e2b/execute failed: ${error}`);
    res.status(500).json({ success: false, error });
  }
});

export default router;
