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
import { logInfo, logWarn, logError, setAgentStatus } from '../utils/logger.js';
import { backgroundTaskManager } from '../utils/backgroundTaskManager.js';
import { BrowserCommand } from '../utils/persistentBrowser.js';
import { getRobotkezBrowserEngine } from '../utils/browserEngine.js';
import { generateExecutionPlan, ExecutionPlan, ExecutionStep } from '../utils/llmPlanner.js';
import { socketService } from '../server/SocketService.js';
import { robotkezPro, UIAction } from '../services/RobotkezProService.js';

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
  role = 'Magyar Agentic Browser (Comet Stílus)';
  description = 'Folyékonyan kommunikáló, proaktív böngésző ügynök vizuális visszajelzéssel.';
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

  private chatEndpoint = process.env.BROWSER_CHAT_ENDPOINT || 'http://localhost:8000/browser/chat';
  private screenshotEndpoint = process.env.BROWSER_SCREENSHOT_ENDPOINT || 'http://localhost:8000/browser/screenshot';

  async chat(message: string, sessionId?: string): Promise<string> {
    logInfo(this.name, `Chat request: ${message}`);

    try {
      const importAxios = await import('axios');
      const axios = importAxios.default;
      const response = await axios.post(this.chatEndpoint, {
        message,
        sessionId: sessionId || this.generateSessionId()
      });

      const data = response.data;

      if (data.screenshot) {
        await this.saveScreenshot(sessionId, data.screenshot);
      }

      return data.response;
    } catch (error) {
      logError(this.name, `Chat error: ${error}`);
      return 'Hiba történt a böngésző interakcióban. Kérlek próbáld újra.';
    }
  }

  async takeScreenshot(sessionId?: string): Promise<string> {
    try {
      const importAxios = await import('axios');
      const axios = importAxios.default;
      const response = await axios.get(this.screenshotEndpoint, {
        responseType: 'arraybuffer'
      });

      const screenshot = Buffer.from(response.data, 'binary').toString('base64');
      await this.saveScreenshot(sessionId, screenshot);

      return screenshot;
    } catch (error) {
      logError(this.name, `Screenshot error: ${error}`);
      throw error;
    }
  }

  private async saveScreenshot(sessionId: string | undefined, screenshot: string): Promise<void> {
    const sessionDir = sessionId
      ? `data/screenshots/${sessionId}`
      : `data/screenshots/${Date.now()}`;

    try {
      const fs = await import('fs/promises');
      // Mappa létrehozása (ha nem létezik)
      await fs.mkdir(sessionDir, { recursive: true });

      // Screenshot mentése
      const filename = `screenshot_${Date.now()}.png`;
      await fs.writeFile(
        `${sessionDir}/${filename}`,
        Buffer.from(screenshot, 'base64')
      );

      logInfo(this.name, `Screenshot mentve: ${sessionDir}/${filename}`);
    } catch (err) {
      logError(this.name, `Failed to save screenshot: ${err}`);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Internal execution logic - implements BaseAgent.executeTask
   */
  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task || '').trim();
    setAgentStatus(this.name, 'working', task.slice(0, 50));

    try {
      const browserEngine = getRobotkezBrowserEngine();

      // 1. Simple Intent Parsing (Phase 2 compatibility for tests)
      let plan: ExecutionPlan | null = null;
      
      const taskLower = task.toLowerCase();
      
      if (taskLower.includes('nyisd meg a böngészőt') || taskLower.includes('indítsd el a böngészőt')) {
        plan = {
          plan: [{ action: 'navigate', url: 'about:blank', description: 'Böngésző megnyitása üres lappal' }],
          estimatedDuration: 3000,
          backgroundEligible: false
        };
      } else if (taskLower.includes('navigálj') || taskLower.includes('frissíts')) {
        let url = task.match(/https?:\/\/[^\s]+/)?.[0];
        if (!url && !taskLower.includes('frissíts')) {
           const domainMatch = task.match(/([a-z0-9]+\.)+[a-z]{2,}/i);
           if (domainMatch) url = `https://${domainMatch[0]}`;
        }
        
        if (url || taskLower.includes('frissíts')) {
          plan = {
            plan: [
              { 
                action: url ? 'navigate' : 'screenshot', 
                url: url, 
                description: url ? `Navigálás a(z) ${url} weboldalra` : 'Oldal frissítése és szinkronizálása' 
              }
            ],
            estimatedDuration: 5000,
            backgroundEligible: false
          };
        } else {
          // Fallback to search if "navigálj" but no URL
          const query = task.replace(/navigálj/i, '').trim();
          plan = {
            plan: [{ action: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, description: `Keresés indítása: ${query}` }],
            estimatedDuration: 5000,
            backgroundEligible: false
          };
        }
      } else if (taskLower.includes('keress rá')) {
        const query = task.replace(/keress rá a? /i, '').trim();
        plan = {
          plan: [{ action: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, description: `Google keresés: ${query}` }],
          estimatedDuration: 5000,
          backgroundEligible: false
        };
      } else if (taskLower.includes('kattints')) {
        const selector = task.match(/['"]([^'"]+)['"]/)?.[1] || (taskLower === 'kattints' ? '.primary-button' : null);
        if (selector) {
          plan = {
            plan: [{ action: 'click', selector, description: `Kattintás a(z) '${selector}' elemre` }],
            estimatedDuration: 3000,
            backgroundEligible: false
          };
        }
      } else if (taskLower.includes('írj be') || taskLower.includes('gépelj')) {
        const text = task.match(/['"]([^'"]+)['"]/)?.[1] || 'Hello World';
        const selector = task.match(/a '([^']+)' mezőbe/)?.[1] || 'input';
        plan = {
          plan: [{ action: 'type', selector, text, description: `Szöveg beírása a(z) '${selector}' mezőbe: "${text}"` }],
          estimatedDuration: 4000,
          backgroundEligible: false
        };
      } else if (taskLower.includes('képernyőkép')) {
        plan = {
          plan: [{ action: 'screenshot', description: 'Pillanatkép készítése a jelenlegi oldalról' }],
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
             const stateResponse = await browserEngine.sendCommand({ action: 'state' });
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
        } catch {
          // Final fallback
          plan = {
            plan: [{ action: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(task)}`, description: 'Általános keresés indítása' }],
            estimatedDuration: 5000,
            backgroundEligible: false
          };
        }
      }

      // EMIT PLAN to Dashboard (Comet-style)
      socketService.emit('robotkez:plan', { taskId: `rk-${Date.now()}`, plan });

      // 3. Background Delegation (Phase 4.4)
      if (context.backgroundEligible || plan.estimatedDuration > 30000 || plan.backgroundEligible) {
        const taskId = await backgroundTaskManager.startTask(task, plan);
        return {
          success: true,
          message: `Rendben, elindítottam a feladatot a háttérben. A folyamatot a "Background Tasks" panelen követheted nyomon. (Task ID: ${taskId})`,
          data: { taskId, background: true }
        };
      }

      // 4. Sequential execution via selected browser engine
      logInfo(this.name, `Executing plan: ${plan.plan.length} steps`);
      const completedSteps: unknown[] = [];

      for (let i = 0; i < plan.plan.length; i++) {
        const step = plan.plan[i];
        logInfo(this.name, `Step: ${step.description} (${step.action})`);
        
        // EMIT STEP START
        socketService.emit('robotkez:step', { index: i, status: 'working', description: step.description });

        try {
          // VISION ACTION: If action is explicitly vision-click
          if (step.action === 'vision-click') {
            const visionRes = await robotkezPro.executeAction(step as unknown as UIAction);
            completedSteps.push({ ...step, status: 'completed', result: visionRes });
            socketService.emit('robotkez:step', { 
                index: i, 
                status: 'completed', 
                description: step.description,
                coords: (visionRes as any).coords 
            });
            continue;
          }

          // DYNAMIC SELECTOR: If selector is missing but description exists
          if (['click', 'type', 'wait', 'extract'].includes(step.action) && !step.selector && step.description) {
            logInfo(this.name, `Dynamic vision query for: ${step.description}`);
            const queryResp = await browserEngine.sendCommand({
                action: 'query',
                description: step.description
            } as any);
            
            if (queryResp.status === 'success') {
                const queryData = queryResp.data as Record<string, unknown>;
                if (queryData.selector) {
                    step.selector = String(queryData.selector);
                    logInfo(this.name, `Resolved selector: ${step.selector}`);
                } else {
                    throw new Error(`Nem találtam meg a következő elemet: "${step.description}"`);
                }
            } else {
                throw new Error(`Nem találtam meg a következő elemet: "${step.description}"`);
            }
          }

          // Strip description and other non-command properties for browser compatibility
           
          const { description: _desc, ...command } = step as unknown as Record<string, unknown>;
          const browserCommand = command as unknown as BrowserCommand;
          let response = await browserEngine.sendCommand(browserCommand);
          
          // SELF-HEALING: If standard action failed, try Vision fallback
          if (response.status === 'error' && ['click', 'type'].includes(step.action)) {
            logWarn(this.name, `Step failed, attempting self-healing with Vision for: ${step.description}`);
            socketService.emit('robotkez:vision_thought', { message: "Hiba történt, megpróbálom vizuálisan azonosítani az elemet..." });
            
            const visionStep: UIAction = {
                action: 'vision-click',
                target: step.description,
                description: `Self-healing: ${step.description}`
            };
            const visionRes = await robotkezPro.executeAction(visionStep) as Record<string, unknown>;
            if (visionRes['status'] === 'success') {
                response = visionRes as any;
            }
          }

          completedSteps.push({
            ...step,
            status: response.status === 'success' ? 'completed' : 'error',
            result: response
          });

          // EMIT STEP SUCCESS/RESULT
          socketService.emit('robotkez:step', { 
            index: i, 
            status: response.status === 'success' ? 'completed' : 'error', 
            screenshot: response.screenshot,
            coords: (response as any).coords
          });

          if (response.status === 'error') {
            throw new Error(response.message || 'Browser action failed');
          }

        } catch (stepError: unknown) {
          const msg = stepError instanceof Error ? stepError.message : String(stepError);
          const action = step.action;
          logError(this.name, `Step failed: ${step.description} - ${msg}`);
          
          // Stop on critical error
          if (['navigate', 'click', 'type'].includes(action)) {
             return {
               success: false,
               message: `Sajnos nem sikerült végrehajtani a következő lépést: "${step.description}". Hibaüzenet: ${msg}`
             };
          }
        }
      }

      // 5. Auto-Screenshot (Phase 2 expectation)
      let screenshotResult;
      try {
        screenshotResult = await browserEngine.sendCommand({ action: 'screenshot' });
      } catch {
        // Ignored
      }

      const isScreenshotTask = taskLower.includes('képernyőkép');
      const baseMessage = isScreenshotTask
        ? 'Elkészítettem a kért képernyőképet.'
        : `Sikeresen végrehajtottam a feladatot: "${task}".`;

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
        message: `Hiba történt a végrehajtás során: ${msg}`
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // Phase 4.4 Background Task Methods
  async executeInBackground(task: string): Promise<{ taskId: string; plan?: ExecutionPlan }> {
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
