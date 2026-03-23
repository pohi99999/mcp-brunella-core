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

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
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

export function MCPCommandCenter() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState('{}');
  const [toolResult, setToolResult] = useState<any>(null);
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
      const args = JSON.parse(toolArgs);

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
          <TabsList className="grid w-full grid-cols-4 bg-zinc-900/50">
            <TabsTrigger value="providers">Providers</TabsTrigger>
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
                      // Set default args based on schema
                      const defaultArgs: any = {};
                      if (tool.inputSchema?.properties) {
                        Object.keys(tool.inputSchema.properties).forEach(key => {
                          if (tool.inputSchema.required?.includes(key)) {
                            defaultArgs[key] = '';
                          }
                        });
                      }
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
