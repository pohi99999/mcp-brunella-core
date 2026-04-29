import express from 'express';
import { getBifrostGateway } from '@packages/core-logic/bifrost_gateway.js';
import { getSafeZoneValidator } from '@packages/core-logic/safe_zone_validator.js';
import { getE2BSandboxManager } from '@packages/core-logic/e2b_sandbox_manager.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { MCPFilesystemServer } from '../mcp_server.js';

/**
 * MCP API Routes
 *
 * Endpoints:
 * - GET /api/mcp/providers - List all LLM providers + health
 * - POST /api/mcp/generate - Generate with Bifrost Gateway
 * - GET /api/mcp/tools - List MCP filesystem tools
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
    const tools = (mcpServer as any).getTools();

    res.json({
      success: true,
      tools: tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
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
 * POST /api/mcp/tools/:toolName
 * Execute MCP tool with arguments
 *
 * Body: { args: {...} }
 */
router.post('/tools/:toolName', async (req, res) => {
  try {
    const { toolName } = req.params;
    const { args } = req.body;

    if (!args || typeof args !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'args is required and must be an object'
      });
    }

    logInfo('MCP API', `Tool execution: ${toolName} with args: ${JSON.stringify(args).slice(0, 100)}`);

    // Route to appropriate handler
    let result;
    switch (toolName) {
      case 'read_file':
        result = await (mcpServer as any).handleReadFile(args);
        break;
      case 'write_file':
        result = await (mcpServer as any).handleWriteFile(args);
        break;
      case 'list_directory':
        result = await (mcpServer as any).handleListDirectory(args);
        break;
      case 'search_files':
        result = await (mcpServer as any).handleSearchFiles(args);
        break;
      default:
        return res.status(404).json({
          success: false,
          error: `Tool not found: ${toolName}`
        });
    }

    // Parse result content
    const parsed = JSON.parse(result.content[0].text);

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
