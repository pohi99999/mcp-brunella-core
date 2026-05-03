import { spawn } from 'node:child_process';
import path from 'node:path';
import { BaseAgent } from './BaseAgent.js';
import type { AgentContext, AgentResult } from './BaseAgent.js';
import { ensureError } from '../utils/ensureError.js';
import { logError, logInfo, setAgentStatus } from '../utils/logger.js';

interface DailyAgentReportConfig {
  reportDate: string;
  harvestMode: string;
  configPath: string;
  outputDir: string;
  tempDir: string;
  harvestDir: string;
  reportPrefix: string;
}

interface PipelinePayload {
  success?: boolean;
  message?: string;
  report_date?: string;
  reportDate?: string;
  harvest_path?: string;
  harvestPath?: string;
  agent_news_path?: string;
  agentNewsPath?: string;
  report_path?: string;
  reportPath?: string;
  items_count?: number;
  itemsCount?: number;
  source_count?: number;
  sourceCount?: number;
  status?: string;
  items?: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asDateString(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function readConfig(context: AgentContext): DailyAgentReportConfig {
  const nested = isRecord(context.context) ? context.context : {};
  const today = new Date().toISOString().slice(0, 10);

  return {
    reportDate: asDateString(nested.reportDate ?? context.reportDate, today),
    harvestMode: asString(nested.harvestMode ?? context.harvestMode, 'playwright'),
    configPath: asString(nested.configPath ?? context.configPath, 'myai/config/sources.json'),
    outputDir: asString(nested.outputDir ?? nested.reportOutputDir ?? context.outputDir ?? context.reportOutputDir, 'docs'),
    tempDir: asString(nested.tempDir ?? context.tempDir, 'temp'),
    harvestDir: asString(nested.harvestDir ?? context.harvestDir, 'temp/harvest_results'),
    reportPrefix: asString(nested.reportPrefix ?? context.reportPrefix, '002-Napi-AI-Agent-Jelentes'),
  };
}

function parsePipelinePayload(stdout: string): PipelinePayload {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('Daily agent report pipeline returned no output.');
  }

  return JSON.parse(trimmed) as PipelinePayload;
}

function normalizePipelineResult(payload: PipelinePayload, config: DailyAgentReportConfig): AgentResult {
  const success = payload.success !== false && payload.status !== 'failed';
  const reportDate = asOptionalString(payload.reportDate ?? payload.report_date) ?? config.reportDate;
  const reportPath = asOptionalString(payload.reportPath ?? payload.report_path) ?? '';
  const agentNewsPath = asOptionalString(payload.agentNewsPath ?? payload.agent_news_path) ?? '';
  const harvestPath = asOptionalString(payload.harvestPath ?? payload.harvest_path) ?? '';
  const items = Array.isArray(payload.items) ? payload.items : [];
  const itemsCount = typeof payload.itemsCount === 'number'
    ? payload.itemsCount
    : typeof payload.items_count === 'number'
      ? payload.items_count
      : items.length;
  const sourceCount = typeof payload.sourceCount === 'number'
    ? payload.sourceCount
    : typeof payload.source_count === 'number'
      ? payload.source_count
      : 0;
  const message = typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : success
      ? `Napi AI agent jelentés elkészült: ${reportDate}`
      : 'Napi AI agent jelentés sikertelen.';

  return {
    success,
    status: success ? 'success' : 'error',
    message,
    data: {
      reportDate,
      reportPath,
      markdownPath: reportPath,
      agentNewsPath,
      harvestPath,
      items,
      itemsCount,
      briefingItemsCount: itemsCount,
      sourceCount,
      usedLLM: false,
      dryRun: false,
      pipelineStatus: payload.status ?? (success ? 'success' : 'failed'),
      reportPrefix: config.reportPrefix,
      harvestMode: config.harvestMode,
      outputDir: config.outputDir,
    },
    metadata: {
      agentName: 'DailyAgentBriefing',
      reportType: 'daily_agent_report',
    },
  };
}

async function runPipeline(config: DailyAgentReportConfig): Promise<PipelinePayload> {
  const scriptPath = path.resolve(process.cwd(), 'myai', 'tools', 'daily_agent_report_pipeline.py');

  return await new Promise<PipelinePayload>((resolve, reject) => {
    const child = spawn('python', [
      scriptPath,
      '--date', config.reportDate,
      '--mode', config.harvestMode,
      '--config', config.configPath,
      '--output-dir', config.outputDir,
      '--temp-dir', config.tempDir,
      '--harvest-dir', config.harvestDir,
      '--report-prefix', config.reportPrefix,
    ], {
      cwd: process.cwd(),
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      try {
        if (stdout.trim()) {
          resolve(parsePipelinePayload(stdout));
          return;
        }
        if (code === 0) {
          reject(new Error('Daily agent report pipeline finished without JSON output.'));
          return;
        }
        reject(new Error(stderr.trim() || `Daily agent report pipeline exited with code ${code}`));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export class DailyAgentBriefingAgent extends BaseAgent {
  public readonly name = 'DailyAgentBriefing';
  public readonly role = 'Napi AI Agent Jelentés Orchestrator';
  public readonly description = 'Napi riport-orchestrátor, amely a Tech-Harvester kimenetét agent_news JSON-ná alakítja, majd elkészíti a Brunella napi AI agent jelentést a docs/002-Napi-AI-Agent-Jelentes-YYYY-MM-DD.md útvonalra.';
  public readonly capabilities = ['tech_harvester', 'agent_news', 'markdown_report', 'scheduled_briefing'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const config = readConfig(context);
    setAgentStatus(this.name, 'working', `Napi AI agent jelentés generálás: ${config.reportDate}`);
    logInfo('DailyAgentBriefingAgent', `Starting daily agent report for ${config.reportDate}`);

    try {
      const payload = await runPipeline(config);
      const result = normalizePipelineResult(payload, config);

      logInfo('DailyAgentBriefingAgent', `Report written to: ${(result.data as { reportPath?: string } | undefined)?.reportPath ?? 'unknown'}`);
      return result;
    } catch (error: unknown) {
      const err = ensureError(error);
      logError('DailyAgentBriefingAgent', `Daily agent report failed: ${err.message}`);
      return {
        success: false,
        status: 'error',
        message: `Napi AI agent jelentés hiba: ${err.message}`,
        metadata: {
          agentName: this.name,
          reportType: 'daily_agent_report',
        },
      };
    } finally {
      setAgentStatus(this.name, 'idle', `Riport lezárva: ${config.reportDate}`);
    }
  }
}
