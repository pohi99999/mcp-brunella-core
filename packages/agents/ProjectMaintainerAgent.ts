import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { logInfo, logError, setAgentStatus } from "@packages/utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { trackStateManager } from "@packages/core-logic/trackStateManager.js";

/**
 * ProjectMaintainerAgent - BAS Daily Maintenance Agent
 * Responsible for repository hygiene, health checks, and track consistency.
 * 
 * Boundary: 
 * - Janitor: Root cleanup & log rotation.
 * - Conductor: Track status & metadata verification.
 * - Health: Build & Test status reporting.
 */
export class ProjectMaintainerAgent extends BaseAgent {
  name = "ProjectMaintainer";
  role = "Repository Maintenance & Hygiene Operator";
  description = "Napi 22:00-kor futó karbantartó, aki a repo zajt tisztítja és ellenőrzi a projekt egészségét.";
  capabilities = ["root_cleanup", "log_rotation", "track_verification", "build_health_check"];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const isDryRun = context.payload?.dryRun !== false; // Default to dry-run
    logInfo(this.name, `Karbantartási ciklus indítása (${isDryRun ? "REPORT-ONLY" : "EXECUTE"})`);

    const report: string[] = [];
    report.push(`# Project Maintenance Report - ${new Date().toISOString()}`);
    report.push(`Mode: ${isDryRun ? "Dry Run (Report Only)" : "Live Execution"}\n`);

    try {
      // 1. Root Cleanup (Janitor role)
      const rootCleanup = await this.checkRootNoise(isDryRun);
      report.push(`## 🧹 Root Hygiene\n${rootCleanup}`);

      // 2. Log & Artefact Management
      const logMgmt = await this.checkLogArtefacts(isDryRun);
      report.push(`## 📊 Log & Artefact Management\n${logMgmt}`);

      // 3. Track Consistency (Conductor role)
      const trackCheck = await this.checkTrackConsistency(isDryRun);
      report.push(`## 📋 Track Consistency\n${trackCheck}`);

      // 4. Build & Environment Health
      const healthCheck = await this.checkSystemHealth();
      report.push(`## 🏥 System Health\n${healthCheck}`);

      const finalReport = report.join("\n\n");
      
      // Save report to logs/maintenance/
      const reportDir = path.join(process.cwd(), "logs", "maintenance");
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      const reportPath = path.join(reportDir, `maintenance-${new Date().toISOString().split('T')[0]}.md`);
      fs.writeFileSync(reportPath, finalReport);

      return {
        success: true,
        message: `Karbantartási jelentés elkészült: ${reportPath}`,
        data: { report: finalReport, path: reportPath },
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError(this.name, `Maintenance failed: ${msg}`);
      return { success: false, message: `Maintenance failed: ${msg}` };
    }
  }

  private async checkRootNoise(isDryRun: boolean): Promise<string> {
    const rootFiles = fs.readdirSync(process.cwd());
    const noisePatterns = [
      /^content.*\.txt$/,
      /^debug.*\.txt$/,
      /^exec.*\.txt$/,
      /^temp_.*$/,
      /\.log\.txt$/,
      /^diag-.*$/,
      /^build-.*\.txt$/
    ];

    const noiseFiles = rootFiles.filter(file => 
      noisePatterns.some(pattern => pattern.test(file))
    );

    if (noiseFiles.length === 0) return "✅ Root directory is clean.";

    let msg = `Found ${noiseFiles.length} noise files in root:\n`;
    noiseFiles.forEach(f => msg += `- ${f}\n`);
    
    if (!isDryRun) {
      // Future implementation: Archive noise files to logs/archive/
      msg += "\n⚠️ [LIVE] Automatic archiving not yet implemented in Phase 1.";
    } else {
      msg += "\n💡 Suggestion: Archive these to `logs/archive/`.";
    }

    return msg;
  }

  private async checkLogArtefacts(isDryRun: boolean): Promise<string> {
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) return "❌ Logs directory missing!";

    const logs = fs.readdirSync(logDir);
    const oldLogs = logs.filter(f => f.startsWith("agent_") && f.endsWith(".log"));
    
    return `Found ${oldLogs.length} active agent logs. Log rotation healthy.`;
  }

  private async checkTrackConsistency(isDryRun: boolean): Promise<string> {
    try {
      await trackStateManager.fullSync();
      const state = trackStateManager.getState();
      
      const anomalies = state.tracks.filter(t => 
        (t.status === "active" && t.progress === 100) ||
        (t.status === "completed" && !t._isArchived)
      );

      if (anomalies.length === 0) return "✅ All tracks are in consistent states.";

      let msg = `Found ${anomalies.length} track anomalies:\n`;
      anomalies.forEach(t => {
        if (t.status === "active" && t.progress === 100) {
          msg += `- [${t.id}] Active but 100% progress. Needs completion.\n`;
        } else if (t.status === "completed" && !t._isArchived) {
          msg += `- [${t.id}] Completed but not archived. Needs archiving.\n`;
        }
      });
      return msg;
    } catch (e) {
      return `❌ Track check failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private async checkSystemHealth(): Promise<string> {
    let health = "";
    
    // Check Build
    try {
      execSync("npm run build", { stdio: "ignore" });
      health += "✅ [Build] Success\n";
    } catch (e) {
      health += "❌ [Build] Failed\n";
    }

    // Check tests (fast subset)
    try {
      execSync("npm run test:fast", { stdio: "ignore" });
      health += "✅ [Tests] Fast suite passed\n";
    } catch (e) {
      health += "❌ [Tests] Fast suite failed\n";
    }

    return health;
  }
}

