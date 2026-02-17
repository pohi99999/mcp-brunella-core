/**
 * RobotkezV2Agent - Hybrid Browser Automation (Playwright + Browser-Use)
 *
 * Bridge between TypeScript (MCP agent) and Python hybrid engine
 * (myai/agents/robotkez_v2_hybrid.py)
 *
 * Modes:
 * - auto: Complexity analyzer decides (keyword-based)
 * - playwright: Fast, fixed selectors (screenshot, PDF, navigate)
 * - browser-use: AI-powered, flexible (Gemini 2.0 Flash)
 *
 * @author Claude Code + Pohánka Péter
 * @track robotkezv2-hybrid-20260217
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface RobotkezV2Options {
  mode?: 'auto' | 'playwright' | 'browser-use';
  headless?: boolean;
  screenshot_path?: string;
  pdf_path?: string;
  selector?: string;
  timeout?: number;
  url?: string;
}

export class RobotkezV2Agent implements IAgent {
  name = 'RobotkezV2';
  role = 'Hybrid Browser Automation Agent';
  description = 'Playwright (fast) + Browser-Use (AI) hybrid browser automation';
  capabilities = [
    'browser_automation',
    'screenshot',
    'pdf_generation',
    'web_scraping',
    'ai_browsing',
    'multi_step_workflow'
  ];

  /**
   * Execute browser automation task using Python hybrid engine
   *
   * @param task - Natural language instruction (e.g., "screenshot github.com")
   * @param context - Optional parameters (mode, url, selector, etc.)
   * @returns AgentResponse with success status and result data
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));

    try {
      // Parse context
      const options: RobotkezV2Options = typeof context === 'object' && context !== null
        ? (context as RobotkezV2Options)
        : {};

      const mode = options.mode || 'auto';
      const headless = options.headless !== undefined ? options.headless : true;

      logInfo(this.name, `Executing: "${task}" (mode=${mode}, headless=${headless})`);

      // Build Python path
      const pythonPath = process.platform === 'win32'
        ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
        : path.join(process.cwd(), '.venv', 'bin', 'python');

      const scriptPath = path.join(process.cwd(), 'myai', 'agents', 'robotkez_v2_hybrid.py');

      // Build command arguments
      const args: string[] = [
        task,
        `--mode=${mode}`,
        `--headless=${headless ? 'true' : 'false'}`
      ];

      if (options.url) args.push(`--url=${options.url}`);
      if (options.screenshot_path) args.push(`--screenshot=${options.screenshot_path}`);
      if (options.pdf_path) args.push(`--pdf=${options.pdf_path}`);
      if (options.selector) args.push(`--selector=${options.selector}`);

      const cmd = `"${pythonPath}" "${scriptPath}" ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`;

      logInfo(this.name, `Python command: ${cmd}`);

      // Execute Python script via child_process
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: process.cwd(),
        timeout: options.timeout || 60000,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      // Check stderr for errors (but Python may still succeed with warnings)
      if (stderr && !stderr.includes('[INFO]') && !stderr.includes('[WARN]')) {
        logError(this.name, `Python stderr: ${stderr}`);
      }

      const output = stdout;

      // Parse JSON output
      let result: {
        success: boolean;
        mode: string;
        result: unknown;
        duration_ms: number;
        error?: string;
        screenshot_path?: string;
      };

      try {
        // Find JSON in output (may have logs before/after)
        const jsonMatch = output.match(/\{[\s\S]*"success"[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error(`No valid JSON found in Python output: ${output.slice(0, 200)}`);
        }
        result = JSON.parse(jsonMatch[0]);
      } catch (parseError: unknown) {
        const error = parseError instanceof Error ? parseError.message : String(parseError);
        logError(this.name, `Failed to parse Python output: ${error}`);
        logError(this.name, `Raw output: ${output.slice(0, 500)}`);
        throw new Error(`Python output parsing failed: ${error}`);
      }

      // Check success
      if (!result.success) {
        return {
          status: 'error',
          error: result.error || 'Unknown error from Python hybrid engine'
        };
      }

      logInfo(this.name, `✅ Success (mode=${result.mode}, duration=${result.duration_ms}ms)`);

      return {
        status: 'success',
        data: {
          mode: result.mode,
          result: result.result,
          duration_ms: result.duration_ms,
          screenshot_path: result.screenshot_path
        },
        message: `Executed via ${result.mode} mode in ${result.duration_ms}ms`
      };

    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Execution failed: ${error}`);

      return {
        status: 'error',
        error: `RobotkezV2 hybrid execution failed: ${error}`
      };

    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Execute with explicit mode (convenience method)
   *
   * @param task - Instruction
   * @param mode - Execution mode
   * @param options - Additional options
   */
  async executeWithMode(
    task: string,
    mode: 'auto' | 'playwright' | 'browser-use',
    options?: Partial<RobotkezV2Options>
  ): Promise<AgentResponse> {
    return this.execute(task, { ...options, mode });
  }

  /**
   * Screenshot convenience method
   *
   * @param url - Target URL
   * @param screenshotPath - Output path (default: screenshot.png)
   */
  async screenshot(url: string, screenshotPath?: string): Promise<AgentResponse> {
    return this.execute(`screenshot ${url}`, {
      mode: 'playwright', // Force Playwright (fast)
      url,
      screenshot_path: screenshotPath || 'screenshot.png'
    });
  }

  /**
   * PDF generation convenience method
   *
   * @param url - Target URL
   * @param pdfPath - Output path (default: page.pdf)
   */
  async generatePdf(url: string, pdfPath?: string): Promise<AgentResponse> {
    return this.execute(`pdf ${url}`, {
      mode: 'playwright', // Force Playwright (fast)
      url,
      pdf_path: pdfPath || 'page.pdf'
    });
  }

  /**
   * AI-powered complex task (force Browser-Use)
   *
   * @param instruction - Natural language instruction
   */
  async aiTask(instruction: string): Promise<AgentResponse> {
    return this.execute(instruction, {
      mode: 'browser-use' // Force AI mode
    });
  }
}

export default RobotkezV2Agent;
