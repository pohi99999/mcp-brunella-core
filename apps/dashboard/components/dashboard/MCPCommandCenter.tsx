import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import {
  Activity,
  Zap,
  Shield,
  FileText,
  Play,
  Server,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  CloudCog
} from 'lucide-react';

/**
 * MCPCommandCenter - Dashboard for MCP + Bifrost Gateway
 *
 * Features:
 * - Provider health status (Ollama, Gemini, GitHub, Anthropic)
 * - MCP tool list + execution
 * - Safe Zone audit log viewer
 * - E2B sandbox stats
 * - Bifrost usage statistics
 */

interface Provider {
  provider: string;
  available: boolean;
  last_check: string;
  response_time_ms?: number;
  error?: string;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
  default?: JsonValue;
  enum?: JsonValue[];
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

type MCPServerRuntimeStatus = 'running' | 'stopped' | 'starting' | 'error' | 'disabled' | 'skipped';

interface MCPServerStatus {
  name: string;
  status: MCPServerRuntimeStatus;
  transport: 'self' | 'stdio' | 'http';
  autoStart: boolean;
  pid: number | null;
  description?: string;
  error?: string;
}

interface MCPServerSummary {
  total: number;
  running: number;
  stopped: number;
  starting: number;
  error: number;
  disabled: number;
  skipped: number;
  autoStart: number;
}

interface MCPManifestEntry {
  name: string;
  canStart: boolean;
  readinessState: 'ready' | 'action_required' | 'disabled' | 'unsupported';
  disabled: boolean;
  platformSupported: boolean;
  required: boolean;
  requiredEnv: string[];
  missingRequiredEnv: string[];
  blockers: string[];
  actionableBlockers: string[];
  inactiveReason?: string;
}

interface MCPManifestSummary {
  total: number;
  ready: number;
  blocked: number;
  actionRequired: number;
  inactive: number;
  disabled: number;
  unsupportedPlatform: number;
  missingEnv: number;
}

interface AuditEntry {
  timestamp: string;
  verdict: 'ALLOWED' | 'DENIED';
  path: string;
  operation: string;
  reason?: string;
  zone?: string;
}

interface Stats {
  bifrost: {
    total_requests: number;
    by_provider: Record<string, number>;
    enabled_providers: string[];
  };
  e2b: {
    total_executions: number;
    active_sandboxes: number;
    avg_duration_ms: number;
  };
}

function getServerStatusIcon(status: MCPServerRuntimeStatus) {
  if (status === 'running') {
    return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  }

  if (status === 'starting') {
    return <Activity className="w-4 h-4 text-blue-400 animate-spin" />;
  }

  if (status === 'error') {
    return <XCircle className="w-4 h-4 text-red-400" />;
  }

  return <Clock className="w-4 h-4 text-zinc-500" />;
}

function getManifestBadgeLabel(readiness: MCPManifestEntry): string {
  if (readiness.readinessState === 'ready') return 'manifest ready';
  if (readiness.readinessState === 'action_required') return 'action required';
  if (readiness.readinessState === 'disabled') return 'disabled by manifest';
  return 'unsupported platform';
}

function getManifestBadgeVariant(readiness: MCPManifestEntry): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (readiness.readinessState === 'ready') return 'default';
  if (readiness.readinessState === 'action_required') return 'destructive';
  return 'outline';
}

function defaultValueForSchema(property: JsonSchemaProperty): JsonValue {
  if (property.default !== undefined) return property.default;
  const schemaType = Array.isArray(property.type) ? property.type[0] : property.type;
  if (schemaType === 'boolean') return false;
  if (schemaType === 'number' || schemaType === 'integer') return 0;
  if (schemaType === 'array') return [];
  if (schemaType === 'object') return {};
  return '';
}

function buildDefaultToolArgs(schema: JsonSchema): Record<string, JsonValue> {
  const defaults: Record<string, JsonValue> = {};
  const required = new Set(schema.required ?? []);
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    if (required.has(key)) {
      defaults[key] = defaultValueForSchema(property);
    }
  }
  return defaults;
}

function parseToolArgsJson(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object.');
  }

  return parsed as Record<string, unknown>;
}

export function MCPCommandCenter() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServerStatus[]>([]);
  const [mcpServerSummary, setMcpServerSummary] = useState<MCPServerSummary | null>(null);
  const [mcpManifest, setMcpManifest] = useState<MCPManifestEntry[]>([]);
  const [mcpManifestSummary, setMcpManifestSummary] = useState<MCPManifestSummary | null>(null);
  const [serverAction, setServerAction] = useState<string | null>(null);
  const [serverActionError, setServerActionError] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState('{}');
  const [toolResult, setToolResult] = useState<unknown | null>(null);
  const [executing, setExecuting] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      // Fetch providers
      const providersRes = await fetch('/api/v1/mcp/providers');
      const providersData = await providersRes.json();
      if (providersData.success) {
        setProviders(providersData.providers);
      }

      // Fetch tools
      const toolsRes = await fetch('/api/v1/mcp/tools');
      const toolsData = await toolsRes.json();
      if (toolsData.success) {
        setTools(toolsData.tools);
      }

      // Fetch configured MCP server runtime state
      const serversRes = await fetch('/api/v1/mcp/servers');
      const serversData = await serversRes.json();
      if (serversData.success) {
        setMcpServers(Array.isArray(serversData.servers) ? serversData.servers : []);
        setMcpServerSummary(serversData.summary ?? null);
      }

      const manifestRes = await fetch('/api/v1/mcp/manifest');
      const manifestData = await manifestRes.json();
      if (manifestData.success) {
        setMcpManifest(Array.isArray(manifestData.entries) ? manifestData.entries : []);
        setMcpManifestSummary(manifestData.summary ?? null);
      }

      // Fetch audit log
      const auditRes = await fetch('/api/v1/mcp/audit?limit=20');
      const auditData = await auditRes.json();
      if (auditData.success) {
        setAuditLog(auditData.audit_log);
      }

      // Fetch stats
      const statsRes = await fetch('/api/v1/mcp/stats');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData);
      }

      setLoading(false);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('Failed to fetch MCP data:', error);
      setLoading(false);
    }
  }

  async function executeTool() {
    if (!selectedTool) return;

    setExecuting(true);
    setToolResult(null);

    try {
      const args = parseToolArgsJson(toolArgs);

      const response = await fetch(`/api/v1/mcp/tools/${selectedTool.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });

      const result = await response.json();
      setToolResult(result);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      setToolResult({ success: false, error });
    } finally {
      setExecuting(false);
    }
  }

  async function controlMcpServer(server: MCPServerStatus, action: 'start' | 'stop') {
    const actionKey = `${server.name}:${action}`;
    setServerAction(actionKey);
    setServerActionError(null);

    try {
      const response = await fetch(`/api/v1/mcp/servers/${encodeURIComponent(server.name)}/${action}`, {
        method: 'POST'
      });
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.error ?? `MCP server ${action} failed`);
      }

      await fetchData();
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      setServerActionError(error);
    } finally {
      setServerAction(null);
    }
  }

  if (loading) {
    return (
      <Card className="glass-card border-white/[0.04]">
        <CardContent className="py-8 flex items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="w-4 h-4 animate-spin" />
            <span>Loading MCP Command Center...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const readinessByName = new Map(mcpManifest.map((entry) => [entry.name, entry]));

  return (
    <Card className="glass-card border-white/[0.04]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <CloudCog className="w-5 h-5 text-blue-400" />
              MCP Command Center
            </CardTitle>
            <CardDescription>
              Multi-Provider LLM Gateway + Safe Zone Management
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="text-xs"
          >
            <Activity className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-zinc-900/50">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="servers">MCP Servers</TabsTrigger>
            <TabsTrigger value="tools">MCP Tools</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          {/* Providers Tab */}
          <TabsContent value="providers" className="space-y-3">
            <div className="grid gap-3">
              {providers.map((provider) => (
                <Card key={provider.provider} className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {provider.available ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                          <div className="font-mono text-sm capitalize">
                            {provider.provider}
                          </div>
                          {provider.error && (
                            <div className="text-xs text-red-400 mt-1">
                              {provider.error.slice(0, 60)}...
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {provider.response_time_ms && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {provider.response_time_ms}ms
                          </Badge>
                        )}
                        <Badge
                          variant={provider.available ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {provider.available ? 'Available' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* MCP Servers Tab */}
          <TabsContent value="servers" className="space-y-3">
            {serverActionError && (
              <Card className="bg-red-950/20 border-red-500/30 rounded-lg">
                <CardContent className="py-3 px-4 text-sm text-red-300">
                  {serverActionError}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                <CardContent className="py-3 px-4">
                  <div className="text-xs text-zinc-500">Manifest ready</div>
                  <div className="text-lg font-mono text-zinc-100">{mcpManifestSummary?.ready ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                <CardContent className="py-3 px-4">
                  <div className="text-xs text-zinc-500">Running</div>
                  <div className="text-lg font-mono text-green-400">{mcpServerSummary?.running ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                <CardContent className="py-3 px-4">
                  <div className="text-xs text-zinc-500">Errors</div>
                  <div className="text-lg font-mono text-red-400">{mcpServerSummary?.error ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                <CardContent className="py-3 px-4">
                  <div className="text-xs text-zinc-500">Action required</div>
                  <div className="text-lg font-mono text-amber-400">{mcpManifestSummary?.actionRequired ?? mcpManifestSummary?.blocked ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                <CardContent className="py-3 px-4">
                  <div className="text-xs text-zinc-500">Intentional inactive</div>
                  <div className="text-lg font-mono text-zinc-300">{mcpManifestSummary?.inactive ?? 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3">
              {mcpServers.map((server) => {
                const readiness = readinessByName.get(server.name);
                const startBlockedByManifest = server.status !== 'running' && readiness?.canStart === false;
                const nextAction = server.status === 'running' ? 'stop' : 'start';

                return (
                <Card key={server.name} className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <Server className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-mono text-sm text-zinc-100 flex items-center gap-2">
                            {server.name}
                            {getServerStatusIcon(server.status)}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {server.description ?? `${server.transport} MCP server`}
                          </div>
                          {server.error && (
                            <div className="text-xs text-red-400 mt-1">
                              {server.error}
                            </div>
                          )}
                          {readiness && (readiness.actionableBlockers.length > 0 || readiness.inactiveReason) && (
                            <div className="text-xs text-amber-300 mt-1">
                              {(readiness.actionableBlockers.length > 0
                                ? readiness.actionableBlockers
                                : [readiness.inactiveReason]
                              ).filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2 shrink-0">
                        <Badge
                          variant={server.status === 'running' ? 'default' : server.status === 'error' ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {server.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {server.transport}
                        </Badge>
                        {server.autoStart && (
                          <Badge variant="secondary" className="text-xs">
                            auto
                          </Badge>
                        )}
                        {readiness?.required && (
                          <Badge variant="outline" className="text-xs">
                            required
                          </Badge>
                        )}
                        {readiness && (
                          <Badge
                            variant={getManifestBadgeVariant(readiness)}
                            className="text-xs"
                          >
                            {getManifestBadgeLabel(readiness)}
                          </Badge>
                        )}
                        {server.pid !== null && (
                          <Badge variant="outline" className="text-xs">
                            pid {server.pid}
                          </Badge>
                        )}
                        {server.transport === 'self' ? (
                          <Badge variant="secondary" className="text-xs">
                            kernel
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={
                              serverAction !== null ||
                              server.status === 'disabled' ||
                              server.status === 'skipped' ||
                              server.status === 'starting' ||
                              startBlockedByManifest
                            }
                            onClick={() => {
                              void controlMcpServer(server, nextAction);
                            }}
                          >
                            {serverAction === `${server.name}:${nextAction}` ? (
                              <Activity className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3 mr-1" />
                            )}
                            {server.status === 'running' ? 'Stop' : 'Start'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              })}
              {mcpServers.length === 0 && (
                <Card className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                  <CardContent className="py-6 text-center text-sm text-zinc-500">
                    No MCP servers reported by the runtime.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* MCP Tools Tab */}
          <TabsContent value="tools" className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              {/* Tool List */}
              <div className="space-y-2">
                <div className="text-xs font-mono text-zinc-400 mb-2">
                  Available Tools ({tools.length})
                </div>
                {tools.map((tool) => (
                  <Card
                    key={tool.name}
                    className={`bg-zinc-900/30 border-white/[0.04]/50 cursor-pointer hover:border-blue-500/50 transition-colors ${
                      selectedTool?.name === tool.name ? 'border-blue-500/50 bg-blue-900/10' : ''
                    }`}
                    onClick={() => {
                      setSelectedTool(tool);
                      setToolResult(null);
                      const defaultArgs = buildDefaultToolArgs(tool.inputSchema);
                      setToolArgs(JSON.stringify(defaultArgs, null, 2));
                    }}
                  >
                    <CardContent className="py-2 px-3">
                      <div className="font-mono text-sm text-blue-400">
                        {tool.name}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        {tool.description}
                      </div>
                      {tool.inputSchema.required?.length ? (
                        <div className="text-[11px] text-zinc-500 mt-2">
                          Required: {tool.inputSchema.required.join(', ')}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Tool Execution */}
              <div className="space-y-2">
                {selectedTool ? (
                  <>
                    <div className="text-xs font-mono text-zinc-400 mb-2">
                      Execute: {selectedTool.name}
                    </div>
                    <textarea
                      className="w-full h-32 bg-zinc-900/50 border border-white/[0.04] rounded-md p-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-blue-500/50"
                      placeholder="Tool arguments (JSON)"
                      value={toolArgs}
                      onChange={(e) => setToolArgs(e.target.value)}
                    />
                    <Button
                      onClick={executeTool}
                      disabled={executing}
                      className="w-full"
                      size="sm"
                    >
                      {executing ? (
                        <>
                          <Activity className="w-3 h-3 mr-1 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Execute Tool
                        </>
                      )}
                    </Button>

                    {toolResult && (
                      <Card className="bg-zinc-900/50 border-white/[0.04]/50 mt-2">
                        <CardContent className="py-2 px-3">
                          <div className="text-xs font-mono text-zinc-400 mb-1">Result:</div>
                          <pre className="text-xs text-zinc-300 overflow-auto max-h-48">
                            {JSON.stringify(toolResult, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-zinc-500 text-center py-8">
                    Select a tool to execute
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <ScrollArea className="h-72">
              <div className="space-y-2">
                {auditLog.map((entry, idx) => (
                  <Card
                    key={idx}
                    className={`bg-zinc-900/30 ${
                      entry.verdict === 'ALLOWED'
                        ? 'border-green-500/30'
                        : 'border-red-500/30'
                    }`}
                  >
                    <CardContent className="py-2 px-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={entry.verdict === 'ALLOWED' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {entry.verdict}
                            </Badge>
                            <span className="text-xs text-zinc-400 font-mono">
                              {entry.operation}
                            </span>
                            {entry.zone && (
                              <Badge variant="outline" className="text-xs">
                                {entry.zone}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-zinc-300 font-mono truncate">
                            {entry.path}
                          </div>
                          {entry.reason && (
                            <div className="text-xs text-zinc-500 mt-1">
                              {entry.reason}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            {stats && (
              <>
                {/* Bifrost Stats */}
                <Card className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Bifrost Gateway
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Total Requests:</span>
                      <span className="font-mono text-zinc-200">
                        {stats.bifrost.total_requests}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-zinc-500">By Provider:</div>
                      {Object.entries(stats.bifrost.by_provider).map(([provider, count]) => (
                        <div key={provider} className="flex justify-between text-xs">
                          <span className="text-zinc-400 capitalize">{provider}:</span>
                          <span className="font-mono text-zinc-300">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* E2B Stats */}
                <Card className="bg-white/[0.02] border-white/[0.04] rounded-lg">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <Database className="w-4 h-4 text-purple-400" />
                      E2B Sandboxes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Total Executions:</span>
                      <span className="font-mono text-zinc-200">
                        {stats.e2b.total_executions}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Active Sandboxes:</span>
                      <span className="font-mono text-zinc-200">
                        {stats.e2b.active_sandboxes}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Avg Duration:</span>
                      <span className="font-mono text-zinc-200">
                        {stats.e2b.avg_duration_ms}ms
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
