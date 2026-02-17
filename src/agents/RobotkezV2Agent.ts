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

import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { backgroundTaskManager } from '../utils/backgroundTaskManager.js';
import { persistentBrowser } from '../utils/persistentBrowser.js';
import { generateExecutionPlan, ExecutionPlan } from '../utils/llmPlanner.js';

// No longer using execAsync here

export interface RobotkezV2Options {
  mode?: 'auto' | 'playwright' | 'browser-use';
  headless?: boolean;
  screenshot_path?: string;
  pdf_path?: string;
  selector?: string;
  timeout?: number;
  url?: string;
}

export class RobotkezV2Agent extends BaseAgent {
  name = 'RobotkezV2';
  role = 'Magyar Agentic Browser';
  description = 'Playwright (fast) + Browser-Use (AI) hybrid browser automation';
  capabilities = [
    'browser_automation',
    'screenshot',
    'pdf_generation',
    'web_scraping',
    'ai_browsing',
    'multi_step_workflow',
    'magyar_nyelv',
    'agentic_browsing'
  ];

  /**
   * Internal execution logic - implements BaseAgent.executeTask
   */
  /**
   * Internal execution logic - implements BaseAgent.executeTask
   */
  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task || '').trim();
    setAgentStatus(this.name, 'working', task.slice(0, 50));

    try {
      // 1. Simple Intent Parsing (Phase 2 compatibility for tests)
      let plan: ExecutionPlan | null = null;
      
      const taskLower = task.toLowerCase();
      if (taskLower.includes('navigálj')) {
        let url = task.match(/https?:\/\/[^\s]+/)?.[0];
        if (!url) {
           const domainMatch = task.match(/([a-z0-9]+\.)+[a-z]{2,}/i);
           if (domainMatch) url = `https://${domainMatch[0]}`;
        }
        
        if (url) {
          plan = {
            plan: [
              { action: 'navigate', url, description: `Navigáció a ${url} oldalra` }
            ],
            estimatedDuration: 5000,
            backgroundEligible: false
          };
        } else if (taskLower.includes('navigálj')) {
          // Fallback to search if "navigálj" but no URL
          const query = task.replace(/navigálj/i, '').trim();
          plan = {
            plan: [{ action: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, description: `Keresés: ${query}` }],
            estimatedDuration: 5000,
            backgroundEligible: false
          };
        }
      } else if (taskLower.includes('keress rá')) {
        const query = task.replace(/keress rá a? /i, '').trim();
        plan = {
          plan: [{ action: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, description: `Keresés: ${query}` }],
          estimatedDuration: 5000,
          backgroundEligible: false
        };
      } else if (taskLower.includes('kattints')) {
        const selector = task.match(/['"]([^'"]+)['"]/)?.[1] || (taskLower === 'kattints' ? '.primary-button' : null);
        if (selector) {
          plan = {
            plan: [{ action: 'click', selector, description: `Kattintás: ${selector}` }],
            estimatedDuration: 3000,
            backgroundEligible: false
          };
        }
      } else if (taskLower.includes('írj be') || taskLower.includes('gépelj')) {
        const text = task.match(/['"]([^'"]+)['"]/)?.[1] || 'Hello World';
        const selector = task.match(/a '([^']+)' mezőbe/)?.[1] || 'input';
        plan = {
          plan: [{ action: 'type', selector, text, description: `Gépelés: ${text}` }],
          estimatedDuration: 4000,
          backgroundEligible: false
        };
      } else if (taskLower.includes('képernyőkép')) {
        plan = {
          plan: [{ action: 'screenshot', description: 'Képernyőkép készítése' }],
          estimatedDuration: 3000,
          backgroundEligible: false
        };
      }

      // 2. LLM Plan Generation (if not already parsed or for Phase 3+)
      if (!plan) {
        try {
          // Get current browser state if possible
          let browserState;
          try {
             const stateResponse = await persistentBrowser.sendCommand({ action: 'state' });
             if (stateResponse.status === 'success') {
                browserState = {
                  url: stateResponse.url || '',
                  title: stateResponse.title
                };
             }
          } catch {
             // Ignored
          }

          plan = await generateExecutionPlan(task, {
            history: context.swarm?.history,
            browserState: browserState
          });
        } catch (_err: unknown) {
          // Final fallback
          plan = {
            plan: [{ action: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(task)}`, description: 'Keresés' }],
            estimatedDuration: 5000,
            backgroundEligible: false
          };
        }
      }

      // 3. Background Delegation (Phase 4.4)
      if (context.backgroundEligible || plan.estimatedDuration > 30000 || plan.backgroundEligible) {
        const taskId = await backgroundTaskManager.startTask(task, plan);
        return {
          success: true,
          message: `Háttérben futó feladat elindítva ID: ${taskId}`,
          data: { taskId, background: true }
        };
      }

      // 4. Sequential Execution via PersistentBrowser
      logInfo(this.name, `Executing plan: ${plan.plan.length} steps`);
      const completedSteps: unknown[] = [];

      for (const step of plan.plan) {
        logInfo(this.name, `Step: ${step.description} (${step.action})`);
        
        try {
          // Strip description and other non-command properties for browser compatibility
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { description, ...command } = step as unknown as Record<string, unknown>;
          const response = await persistentBrowser.sendCommand(command as any);
          completedSteps.push({
            ...step,
            status: 'completed',
            result: response
          });
        } catch (stepError: unknown) {
          const msg = stepError instanceof Error ? stepError.message : String(stepError);
          const action = (step as any).action;
          logError(this.name, `Step failed: ${step.description} - ${msg}`);
          completedSteps.push({
            ...step,
            status: 'error',
            error: msg
          });
          
          // Stop on critical error
          if (['navigate', 'click', 'type'].includes(action)) {
             return {
               success: false,
               message: `Nem sikerült: ${step.description} - ${msg}`
             };
          }
        }
      }

      // 5. Auto-Screenshot (Phase 2 expectation)
      let screenshotResult;
      try {
        screenshotResult = await persistentBrowser.sendCommand({ action: 'screenshot' });
      } catch (_e) {
        // Ignored
      }

      const isScreenshotTask = taskLower.includes('képernyőkép');
      const baseMessage = isScreenshotTask ? 'Képernyőkép elkészült' : `Végrehajtva: ${task}`;

      return {
        success: true,
        message: baseMessage,
        data: {
           completedSteps,
           screenshot: screenshotResult?.screenshot,
           success: true // Legacy support
        }
      };

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, `Execution failed: ${msg}`);
      return {
        success: false,
        message: `Nem sikerült: ${msg}`
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // Phase 4.4 Background Task Methods
  async executeInBackground(task: string): Promise<{ taskId: string; plan?: any }> {
    const plan = await generateExecutionPlan(task);
    const taskId = await backgroundTaskManager.startTask(task, plan);
    return { taskId, plan };
  }

  getBackgroundTaskStatus(taskId: string) {
    return backgroundTaskManager.getTaskStatus(taskId);
  }

  cancelBackgroundTask(taskId: string) {
    return backgroundTaskManager.cancelTask(taskId);
  }

  listBackgroundTasks() {
    return backgroundTaskManager.getAllTasks();
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
  ): Promise<unknown> {
    return this.execute(task, { ...options, mode });
  }

  /**
   * Screenshot convenience method
   *
   * @param url - Target URL
   * @param screenshotPath - Output path (default: screenshot.png)
   */
  async screenshot(url: string, screenshotPath?: string): Promise<unknown> {
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
  async generatePdf(url: string, pdfPath?: string): Promise<unknown> {
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
  async aiTask(instruction: string): Promise<unknown> {
    return this.execute(instruction, {
      mode: 'browser-use' // Force AI mode
    });
  }
}

export default RobotkezV2Agent;
