import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, logWarn, setAgentStatus } from '../utils/logger.js';
import { chromium, Browser, Page, CDPSession } from 'playwright';

/**
 * NetworkRequest - Hálózati kérés adat
 */
export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  duration: number;
  resourceType?: string;
}

/**
 * ConsoleMessage - Konzol üzenet
 */
export interface ConsoleMessage {
  type: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  line?: number;
}

/**
 * PerformanceMetrics - Teljesítmény metrikák
 */
export interface PerformanceMetrics {
  domLoadTime: number;
  firstContentfulPaint: number;
  totalBlockingTime: number;
  resourceCount: number;
  pageLoadTime: number;
}

/**
 * DebugReport - Teljes debug riport
 */
export interface DebugReport {
  url: string;
  timestamp: string;
  network: {
    totalRequests: number;
    failedRequests: number;
    requests: NetworkRequest[];
    failedRequestsList: Array<{ url: string; error: string }>;
  };
  console: {
    errors: ConsoleMessage[];
    warnings: ConsoleMessage[];
  };
  performance: PerformanceMetrics;
  summary: string;
}

/**
 * ChromeDevToolsAgent - Web Debug & Performance Analyst
 * 
 * Chrome DevTools Protocol (CDP) alapú debug agent Playwright CDP mode-dal.
 * Hálózati kérések, JS hibák és performance metrikák gyűjtése.
 */
export class ChromeDevToolsAgent implements IAgent {
  name = 'ChromeDevTools';
  role = 'Web Debug & Performance Analyst';
  description = 'Chrome DevTools Protocol-alapú web debug: hálózati kérések, JS hibák, performance metrics';
  capabilities = ['network_capture', 'console_errors', 'performance_metrics', 'debug_report'];

  /**
   * captureNetworkRequests - Hálózati kérések rögzítése
   */
  async captureNetworkRequests(
    url: string,
    durationMs = 5000
  ): Promise<{
    requests: NetworkRequest[];
    failedRequests: Array<{ url: string; error: string }>;
  }> {
    logInfo(this.name, `Hálózati kérések rögzítése: ${url} (${durationMs}ms)`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const requests: NetworkRequest[] = [];
    const failedRequests: Array<{ url: string; error: string }> = [];

    // Network request event listener
    page.on('request', (request) => {
      const startTime = Date.now();
      request.response().then((response) => {
        if (response) {
          requests.push({
            url: request.url(),
            method: request.method(),
            status: response.status(),
            duration: Date.now() - startTime,
            resourceType: request.resourceType(),
          });
        }
      }).catch(() => {
        // Ha nincs response (pl. timeout)
      });
    });

    // Failed request listener
    page.on('requestfailed', (request) => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || 'Unknown error',
      });
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: durationMs });
      
      // Várunk még egy kicsit, hogy az aszinkron kérések is beérkezzenek
      await page.waitForTimeout(Math.min(durationMs, 2000));

      logInfo(this.name, `Rögzítve: ${requests.length} kérés, ${failedRequests.length} hiba`);
    } catch (error) {
      logError(this.name, `Network capture hiba: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browser.close();
    }

    return { requests, failedRequests };
  }

  /**
   * captureConsoleErrors - Konzol hibák és warningok rögzítése
   */
  async captureConsoleErrors(
    url: string,
    durationMs = 5000
  ): Promise<{
    errors: ConsoleMessage[];
    warnings: ConsoleMessage[];
  }> {
    logInfo(this.name, `Konzol hibák rögzítése: ${url}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const errors: ConsoleMessage[] = [];
    const warnings: ConsoleMessage[] = [];

    // Console message listener
    page.on('console', (msg) => {
      const type = msg.type();
      const message: ConsoleMessage = {
        type: type as 'error' | 'warning' | 'info',
        message: msg.text(),
        source: msg.location().url,
        line: msg.location().lineNumber,
      };

      if (type === 'error') {
        errors.push(message);
      } else if (type === 'warning') {
        warnings.push(message);
      }
    });

    // Page error listener (uncaught exceptions)
    page.on('pageerror', (error) => {
      errors.push({
        type: 'error',
        message: error.message,
        source: 'uncaught exception',
      });
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: durationMs });
      await page.waitForTimeout(Math.min(durationMs, 2000));

      logInfo(this.name, `Rögzítve: ${errors.length} hiba, ${warnings.length} warning`);
    } catch (error) {
      logError(this.name, `Console capture hiba: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browser.close();
    }

    return { errors, warnings };
  }

  /**
   * getPerformanceMetrics - Teljesítmény metrikák gyűjtése
   */
  async getPerformanceMetrics(url: string): Promise<PerformanceMetrics> {
    logInfo(this.name, `Performance metrikák gyűjtése: ${url}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let metrics: PerformanceMetrics = {
      domLoadTime: 0,
      firstContentfulPaint: 0,
      totalBlockingTime: 0,
      resourceCount: 0,
      pageLoadTime: 0,
    };

    try {
      const startTime = Date.now();
      await page.goto(url, { waitUntil: 'load' });
      const pageLoadTime = Date.now() - startTime;

      // Performance API metrikák kinyerése
      const performanceData = await page.evaluate(() => {
        const perfEntries = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');

        return {
          domLoadTime: perfEntries?.domContentLoadedEventEnd - perfEntries?.domContentLoadedEventStart || 0,
          firstContentfulPaint: fcp?.startTime || 0,
          resourceCount: performance.getEntriesByType('resource').length,
        };
      });

      metrics = {
        ...performanceData,
        totalBlockingTime: 0, // TBT complex kiszámítás - később
        pageLoadTime,
      };

      logInfo(this.name, `Performance: DOM Load ${metrics.domLoadTime.toFixed(0)}ms, FCP ${metrics.firstContentfulPaint.toFixed(0)}ms`);
    } catch (error) {
      logError(this.name, `Performance metrics hiba: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browser.close();
    }

    return metrics;
  }

  /**
   * generateDebugReport - Teljes debug riport markdown formátumban
   */
  async generateDebugReport(url: string): Promise<DebugReport> {
    logInfo(this.name, `Debug riport generálása: ${url}`);

    // Parallel execution az összes metrikára
    const [networkData, consoleData, performanceData] = await Promise.all([
      this.captureNetworkRequests(url, 8000),
      this.captureConsoleErrors(url, 8000),
      this.getPerformanceMetrics(url),
    ]);

    const report: DebugReport = {
      url,
      timestamp: new Date().toISOString(),
      network: {
        totalRequests: networkData.requests.length,
        failedRequests: networkData.failedRequests.length,
        requests: networkData.requests,
        failedRequestsList: networkData.failedRequests,
      },
      console: {
        errors: consoleData.errors,
        warnings: consoleData.warnings,
      },
      performance: performanceData,
      summary: this.generateSummary(networkData, consoleData, performanceData),
    };

    return report;
  }

  /**
   * generateSummary - Összefoglaló szöveg generálása
   */
  private generateSummary(
    networkData: { requests: NetworkRequest[]; failedRequests: Array<{ url: string; error: string }> },
    consoleData: { errors: ConsoleMessage[]; warnings: ConsoleMessage[] },
    performanceData: PerformanceMetrics
  ): string {
    const issues: string[] = [];

    // Network issues
    if (networkData.failedRequests.length > 0) {
      issues.push(`❌ ${networkData.failedRequests.length} hálózati hiba található`);
    }

    // Console errors
    if (consoleData.errors.length > 0) {
      issues.push(`❌ ${consoleData.errors.length} JavaScript hiba`);
    }

    // Performance issues
    if (performanceData.pageLoadTime > 3000) {
      issues.push(`⚠️ Lassú oldalbetöltés: ${performanceData.pageLoadTime}ms (cél: <3000ms)`);
    }

    if (performanceData.firstContentfulPaint > 1800) {
      issues.push(`⚠️ Lassú FCP: ${performanceData.firstContentfulPaint.toFixed(0)}ms (cél: <1800ms)`);
    }

    if (issues.length === 0) {
      return '✅ Nincsenek jelentős problémák - az oldal megfelelően működik';
    }

    return `**Talált problémák (${issues.length}):**\n${issues.map((i) => `  - ${i}`).join('\n')}`;
  }

  /**
   * formatReportMarkdown - Markdown riport generálása
   */
  private formatReportMarkdown(report: DebugReport): string {
    let md = `# 🔍 Chrome DevTools Debug Report\n\n`;
    md += `**URL:** ${report.url}\n`;
    md += `**Időpont:** ${new Date(report.timestamp).toLocaleString('hu-HU')}\n\n`;
    md += `---\n\n`;

    // Summary
    md += `## 📊 Összefoglaló\n\n${report.summary}\n\n`;

    // Performance
    md += `## ⚡ Performance Metrikák\n\n`;
    md += `| Metrika | Érték |\n`;
    md += `|---------|-------|\n`;
    md += `| Oldalbetöltés | ${report.performance.pageLoadTime.toFixed(0)}ms |\n`;
    md += `| DOM Load | ${report.performance.domLoadTime.toFixed(0)}ms |\n`;
    md += `| First Contentful Paint | ${report.performance.firstContentfulPaint.toFixed(0)}ms |\n`;
    md += `| Resource Count | ${report.performance.resourceCount} |\n\n`;

    // Network
    md += `## 🌐 Hálózati Kérések\n\n`;
    md += `**Összes kérés:** ${report.network.totalRequests}\n`;
    md += `**Sikertelen kérések:** ${report.network.failedRequests}\n\n`;

    if (report.network.failedRequestsList.length > 0) {
      md += `### ❌ Sikertelen Kérések\n\n`;
      report.network.failedRequestsList.forEach((req) => {
        md += `- **${req.url}**\n  - Hiba: ${req.error}\n`;
      });
      md += `\n`;
    }

    // Top slowest requests
    const slowestRequests = report.network.requests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    if (slowestRequests.length > 0) {
      md += `### 🐌 Leglassabb Kérések (Top 5)\n\n`;
      md += `| URL | Metodus | Státusz | Idő |\n`;
      md += `|-----|---------|---------|------|\n`;
      slowestRequests.forEach((req) => {
        const shortUrl = req.url.length > 50 ? req.url.substring(0, 47) + '...' : req.url;
        md += `| ${shortUrl} | ${req.method} | ${req.status} | ${req.duration.toFixed(0)}ms |\n`;
      });
      md += `\n`;
    }

    // Console Errors
    if (report.console.errors.length > 0) {
      md += `## ❌ JavaScript Hibák (${report.console.errors.length})\n\n`;
      report.console.errors.forEach((err, idx) => {
        md += `### ${idx + 1}. ${err.message}\n`;
        if (err.source) md += `**Forrás:** ${err.source}${err.line ? `:${err.line}` : ''}\n`;
        md += `\n`;
      });
    }

    // Console Warnings
    if (report.console.warnings.length > 0) {
      md += `## ⚠️ Figyelmeztetések (${report.console.warnings.length})\n\n`;
      report.console.warnings.slice(0, 5).forEach((warn) => {
        md += `- ${warn.message}\n`;
      });
      if (report.console.warnings.length > 5) {
        md += `\n_(és még ${report.console.warnings.length - 5} további...)_\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
    md += `*Generálta: ChromeDevToolsAgent | BAS Core*\n`;

    return md;
  }

  /**
   * execute - IAgent standard interfész
   * 
   * Task parsing:
   * - "Debug <url>" → generateDebugReport
   * - "Network <url>" → captureNetworkRequests
   * - "Console <url>" → captureConsoleErrors
   * - "Performance <url>" → getPerformanceMetrics
   * 
   * Context:
   * - url: string (required)
   * - timeout: number (optional, default 10000)
   * - capability: 'network' | 'console' | 'performance' | 'report' (optional)
   */
  async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));

    try {
      // URL extraction
      let url = (context?.url as string) || '';
      
      if (!url) {
        // URL regex keresés a task stringben
        const urlMatch = task.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          url = urlMatch[1];
        } else if (task.includes('localhost')) {
          // localhost detection
          const localhostMatch = task.match(/localhost:(\d+)/);
          url = localhostMatch ? `http://localhost:${localhostMatch[1]}` : 'http://localhost:5173';
        }
      }

      if (!url) {
        return {
          status: 'error',
          error: 'URL megadása szükséges - használd a context.url mezőt vagy adj meg URL-t a taskban',
        };
      }

      logInfo(this.name, `Debug kezdése: ${url}`);

      const capability = (context?.capability as string) || 'report';
      const taskLower = task.toLowerCase();

      let result: unknown;
      let resultType: string;

      // Capability routing
      if (capability === 'network' || taskLower.includes('network') || taskLower.includes('hálózat')) {
        const timeout = (context?.timeout as number) || 10000;
        result = await this.captureNetworkRequests(url, timeout);
        resultType = 'network_capture';
      } else if (capability === 'console' || taskLower.includes('console') || taskLower.includes('konzol')) {
        const timeout = (context?.timeout as number) || 10000;
        result = await this.captureConsoleErrors(url, timeout);
        resultType = 'console_errors';
      } else if (capability === 'performance' || taskLower.includes('performance') || taskLower.includes('teljesítmény')) {
        result = await this.getPerformanceMetrics(url);
        resultType = 'performance_metrics';
      } else {
        // Default: Full debug report
        const report = await this.generateDebugReport(url);
        const markdown = this.formatReportMarkdown(report);
        
        result = { report, markdown };
        resultType = 'debug_report';
      }

      logInfo(this.name, `Debug kész: ${resultType}`);

      return {
        status: 'success',
        data: result,
        metadata: {
          type: resultType,
          url,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(this.name, errorMsg);

      return {
        status: 'error',
        error: errorMsg,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}

export default ChromeDevToolsAgent;
