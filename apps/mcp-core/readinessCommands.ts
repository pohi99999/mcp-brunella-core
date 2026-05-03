import type { Command } from 'commander';
import chalk from 'chalk';

type StatusBucket = 'ready' | 'partial' | 'blocked' | 'unknown';

interface McpRuntimeStatus {
  name: string;
  status: string;
  transport?: string;
  autoStart?: boolean;
  pid?: number | null;
  error?: string;
}

interface McpServersResponse {
  summary?: Record<string, unknown>;
  servers?: McpRuntimeStatus[];
}

interface McpManifestEntry {
  name: string;
  canStart: boolean;
  readinessState?: 'ready' | 'action_required' | 'disabled' | 'unsupported';
  disabled?: boolean;
  platformSupported?: boolean;
  missingRequiredEnv?: string[];
  blockers?: string[];
  actionableBlockers?: string[];
  inactiveReason?: string;
}

interface McpManifestResponse {
  summary?: {
    total?: number;
    ready?: number;
    blocked?: number;
    actionRequired?: number;
    inactive?: number;
    disabled?: number;
    unsupportedPlatform?: number;
    missingEnv?: number;
  };
  entries?: McpManifestEntry[];
  servers?: McpManifestEntry[];
}

interface LlmReadinessResponse {
  summary?: {
    status?: StatusBucket;
    blockers?: string[];
  };
  primary?: {
    label?: string;
    apiModel?: string;
    configured?: boolean;
    tokenEnv?: string | null;
  };
  fallback?: {
    label?: string;
    model?: string;
    configured?: boolean;
    blockers?: string[];
  };
  anythingllm?: {
    baseUrl?: string;
    apiKeyConfigured?: boolean;
    workspace?: {
      slug?: string;
      available?: boolean;
    };
    blockers?: string[];
  };
}

interface HookReadinessResponse {
  readiness?: {
    status?: StatusBucket;
    blockers?: string[];
    summary?: {
      registrySize?: number;
      enabledHandlers?: number;
      circuitOpenCount?: number;
      dlqCount?: number;
      audit?: {
        total?: number;
        failed?: number;
        failureRate?: number;
      };
    };
  };
}

interface CombinedReadiness {
  mcpRuntime: McpServersResponse;
  mcpManifest: McpManifestResponse;
  llm: LlmReadinessResponse;
  hooks: HookReadinessResponse;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function apiBase(): string {
  return process.env.BRUNELLA_API_URL || process.env.API_BASE || 'http://localhost:3000';
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function statusColor(status: StatusBucket | string | undefined): (value: string) => string {
  if (status === 'ready' || status === 'running' || status === 'online') return chalk.green;
  if (status === 'partial' || status === 'starting') return chalk.yellow;
  if (status === 'blocked' || status === 'error' || status === 'offline') return chalk.red;
  return chalk.gray;
}

function printMcpSummary(runtime: McpServersResponse, manifest: McpManifestResponse): void {
  const runtimeSummary = runtime.summary ?? {};
  const manifestSummary = manifest.summary ?? {};
  const entries = manifest.entries ?? manifest.servers ?? [];
  writeLine(chalk.bold('MCP readiness'));
  writeLine(`  Runtime configured: ${String(runtimeSummary.configured ?? runtime.servers?.length ?? 0)}`);
  writeLine(`  Runtime running:    ${String(runtimeSummary.running ?? 0)}`);
  writeLine(`  Manifest ready:     ${String(manifestSummary.ready ?? 0)}`);
  writeLine(`  Action required:    ${String(manifestSummary.actionRequired ?? manifestSummary.blocked ?? 0)}`);
  writeLine(`  Inactive planned:   ${String(manifestSummary.inactive ?? 0)}`);

  const actionable = entries.filter((server) => (server.actionableBlockers?.length ?? 0) > 0);
  if (actionable.length > 0) {
    writeLine(chalk.yellow('\nMCP action required:'));
    for (const server of actionable.slice(0, 10)) {
      const blockers = server.actionableBlockers?.join('; ') || server.blockers?.join('; ') || 'blocked';
      writeLine(`  - ${server.name}: ${blockers}`);
    }
  }

  const inactive = entries.filter((server) => server.readinessState === 'disabled' || server.readinessState === 'unsupported');
  if (inactive.length > 0) {
    writeLine(chalk.gray('\nMCP intentionally inactive:'));
    for (const server of inactive.slice(0, 10)) {
      writeLine(`  - ${server.name}: ${server.inactiveReason ?? server.blockers?.join('; ') ?? 'inactive'}`);
    }
  }
}

function printLlmSummary(readiness: LlmReadinessResponse): void {
  const status = readiness.summary?.status ?? 'unknown';
  writeLine(chalk.bold('LLM / AnythingLLM readiness'));
  writeLine(`  Status:      ${statusColor(status)(status.toUpperCase())}`);
  writeLine(`  Primary:     ${readiness.primary?.label ?? 'GitHub Models'} (${readiness.primary?.apiModel ?? 'n/a'})`);
  writeLine(`  Primary env: ${readiness.primary?.configured ? readiness.primary.tokenEnv ?? 'configured' : 'missing'}`);
  writeLine(`  Fallback:    ${readiness.fallback?.label ?? 'Ollama'} (${readiness.fallback?.model ?? 'n/a'})`);
  writeLine(`  Workspace:   ${readiness.anythingllm?.workspace?.slug ?? 'brunella_main'} (${readiness.anythingllm?.workspace?.available ? 'ready' : 'missing'})`);

  const blockers = readiness.summary?.blockers ?? [];
  if (blockers.length > 0) {
    writeLine(chalk.yellow('\nLLM blockers:'));
    for (const blocker of blockers.slice(0, 10)) {
      writeLine(`  - ${blocker}`);
    }
  }
}

function printHookSummary(response: HookReadinessResponse): void {
  const readiness = response.readiness;
  const status = readiness?.status ?? 'unknown';
  const summary = readiness?.summary;
  const failureRate = ((summary?.audit?.failureRate ?? 0) * 100).toFixed(1);

  writeLine(chalk.bold('Hook engine readiness'));
  writeLine(`  Status:       ${statusColor(status)(status.toUpperCase())}`);
  writeLine(`  Registry:     ${String(summary?.registrySize ?? 0)} events`);
  writeLine(`  Handlers:     ${String(summary?.enabledHandlers ?? 0)} enabled`);
  writeLine(`  Executions:   ${String(summary?.audit?.total ?? 0)} in window (${failureRate}% failures)`);
  writeLine(`  Open circuits:${String(summary?.circuitOpenCount ?? 0).padStart(5, ' ')}`);
  writeLine(`  DLQ entries:  ${String(summary?.dlqCount ?? 0)}`);

  const blockers = readiness?.blockers ?? [];
  if (blockers.length > 0) {
    writeLine(chalk.yellow('\nHook blockers:'));
    for (const blocker of blockers.slice(0, 10)) {
      writeLine(`  - ${blocker}`);
    }
  }
}

async function fetchMcpReadiness(): Promise<{ runtime: McpServersResponse; manifest: McpManifestResponse }> {
  const [runtime, manifest] = await Promise.all([
    getJson<McpServersResponse>('/api/v1/mcp/servers'),
    getJson<McpManifestResponse>('/api/v1/mcp/manifest'),
  ]);
  return { runtime, manifest };
}

async function fetchCombinedReadiness(): Promise<CombinedReadiness> {
  const [mcp, llm, hooks] = await Promise.all([
    fetchMcpReadiness(),
    getJson<LlmReadinessResponse>('/api/v1/llm/orchestration-readiness'),
    getJson<HookReadinessResponse>('/api/v1/hooks/readiness'),
  ]);
  return {
    mcpRuntime: mcp.runtime,
    mcpManifest: mcp.manifest,
    llm,
    hooks,
  };
}

export function registerReadinessCommands(program: Command): void {
  const readiness = program
    .command('readiness')
    .description('Dashboard/Copilot runtime readiness: MCP manifest/runtime, LLM fallback, AnythingLLM workspace, hook engine');

  readiness
    .command('status')
    .description('Show combined MCP and LLM readiness')
    .option('-j, --json', 'Nyers JSON kimenet')
    .action(async (opts: { json?: boolean }) => {
      try {
        const data = await fetchCombinedReadiness();
        if (opts.json) {
          writeLine(JSON.stringify(data, null, 2));
          return;
        }
        printMcpSummary(data.mcpRuntime, data.mcpManifest);
        writeLine('');
        printLlmSummary(data.llm);
        writeLine('');
        printHookSummary(data.hooks);
      } catch (error: unknown) {
        writeError(`Readiness hiba: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  readiness
    .command('mcp')
    .description('Show MCP runtime and manifest readiness')
    .option('-j, --json', 'Nyers JSON kimenet')
    .action(async (opts: { json?: boolean }) => {
      try {
        const data = await fetchMcpReadiness();
        if (opts.json) {
          writeLine(JSON.stringify(data, null, 2));
          return;
        }
        printMcpSummary(data.runtime, data.manifest);
      } catch (error: unknown) {
        writeError(`MCP readiness hiba: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  readiness
    .command('hooks')
    .alias('hook')
    .description('Show hook engine readiness')
    .option('-j, --json', 'Nyers JSON kimenet')
    .action(async (opts: { json?: boolean }) => {
      try {
        const data = await getJson<HookReadinessResponse>('/api/v1/hooks/readiness');
        if (opts.json) {
          writeLine(JSON.stringify(data, null, 2));
          return;
        }
        printHookSummary(data);
      } catch (error: unknown) {
        writeError(`Hook readiness hiba: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  readiness
    .command('llm')
    .description('Show GitHub Models primary, Ollama fallback, and AnythingLLM workspace readiness')
    .option('-j, --json', 'Nyers JSON kimenet')
    .action(async (opts: { json?: boolean }) => {
      try {
        const data = await getJson<LlmReadinessResponse>('/api/v1/llm/orchestration-readiness');
        if (opts.json) {
          writeLine(JSON.stringify(data, null, 2));
          return;
        }
        printLlmSummary(data);
      } catch (error: unknown) {
        writeError(`LLM readiness hiba: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
