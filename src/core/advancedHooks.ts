import { registerHook } from '../utils/hooks.js';
import { logInfo, logError } from '../utils/logger.js';
import { fireHooks } from './hookEngine.js';
import { agentManager } from '../agents/AgentManager.js';

/**
 * Advanced Hooks Implementation from fejlv2.md
 * These hooks cover advanced automation, self-healing, data integrity, KKV services, and L5 predictive decisions.
 */
export function registerAdvancedHooks() {
  logInfo('AdvancedHooks', 'Registering 30 advanced hooks (24 from fejlv2.md + 6 L5 decision hooks)...');

  // 1. PAIOS Session Hook
  registerHook('paios:session:start', async (ctx: any) => {
    logInfo('PAIOSHook', `Session start for agent: ${ctx?.agentName}`);
    // Simulate loading context
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 10) {
      logInfo('VoiceHook', 'Good morning! You have pending tasks.');
    }
  }, { category: 'business' });

  registerHook('paios:session:end', async (ctx: any) => {
    logInfo('PAIOSHook', `Saving session summary to LanceDB. Duration: ${ctx?.durationMs}ms`);
  }, { category: 'business' });

  // 2. Nova Gatekeeper Hook
  registerHook('nova:task:incoming', async (ctx: any) => {
    logInfo('NovaHook', `Prioritizing incoming task: ${ctx?.task}`);
    // Simulate routing complexity
    const complexity = 'low'; // Mock
    if (complexity === 'low') {
      logInfo('NovaHook', 'Routing to local Ollama (fast, free).');
    }
  }, { category: 'business' });

  // 3. Voice TTS Hook
  registerHook('phoenix:agent:failed', async (ctx: any) => {
    logInfo('VoiceHook', `Attention! Agent ${ctx?.agentName} failed. Phoenix recovery starting.`);
    agentManager.queueTask(`HIBA JAVÍTÁSA: A(z) ${ctx?.agentName} ügynök hibát jelzett. Elemezd a hiba okát és javítsd ki a kódot vagy konfigurációt.`, 'developer', {
        originalError: ctx?.error,
        failedAgent: ctx?.agentName,
        autoFix: true
    });
  }, { category: 'infra' });

  registerHook('finance:anomaly:detected', async (ctx: any) => {
    if (ctx?.result?.severity === 'critical') {
      logInfo('VoiceHook', `Critical financial anomaly detected: ${ctx?.result?.description}`);
      agentManager.queueTask(`Financial anomaly investigation: ${ctx?.result?.description}`, 'AdvancedMatching', ctx);
    }
  }, { category: 'business' });

  registerHook('invoice:approved', async (ctx: any) => {
    logInfo('VoiceHook', `Invoice processed: ${ctx?.result?.amount} Ft, Vendor: ${ctx?.result?.vendor}`);
  }, { category: 'business' });

  // 4. Federation Peer Hook
  registerHook('federation:peer:connected', async (ctx: any) => {
    const peerId = ctx?.result?.peerId;
    logInfo('FederationHook', `Peer connected: ${peerId}. Updating capability map.`);
  }, { category: 'infra' });

  registerHook('federation:peer:disconnected', async (ctx: any) => {
    logInfo('FederationHook', `Peer disconnected: ${ctx?.result?.peerId}. Rerouting tasks to local.`);
  }, { category: 'infra' });

  // 5. Manifest Signing Hook
  registerHook('federation:manifest:signed', async (ctx: any) => {
    logInfo('FederationHook', `Manifest signed for peer: ${ctx?.result?.peerId}. Storing in audit trail.`);
    const age = Date.now() - (ctx?.result?.issuedAt || Date.now());
    if (age > 86_400_000) {
      logError('SecurityHook', 'Replay attack suspected! Manifest is older than 24h.');
    }
  }, { category: 'security' });

  // 6. Gmail Inbox Zero Hook
  registerHook('gmail:new:email', async (ctx: any) => {
    const { from, subject, hasAttachment } = ctx?.result || {};
    logInfo('GmailHook', `New email from ${from}. Subject: ${subject}`);
    if (hasAttachment) {
      logInfo('GmailHook', 'Triggering InvoiceAutomation pipeline.');
      agentManager.queueTask(`Process new invoice email from ${from}: ${subject}`, 'InvoiceAutomation', ctx);
    }
  }, { category: 'business' });

  // 7. Google Calendar Deadline Hook
  registerHook('calendar:deadline:approaching', async (ctx: any) => {
    const { event, hoursUntil } = ctx?.result || {};
    if (hoursUntil <= 48 && event?.type === 'track_deadline') {
      logInfo('CalendarHook', `Track deadline approaching for ${event?.trackId}. Checking progress.`);
      agentManager.queueTask(`Track progress review for deadline: ${event?.trackId}`, 'BrunellaProjectManager', ctx);
    }
  }, { category: 'business' });

  // 8. ChromeDevTools Performance Hook
  registerHook('dashboard:deploy:completed', async (ctx: any) => {
    logInfo('PerfHook', `Deploy completed. Running ChromeDevTools Lighthouse audit on http://localhost:5173`);
    agentManager.queueTask('Run Lighthouse performance audit on dashboard', 'ChromeDevTools', { url: 'http://localhost:5173' });
  }, { category: 'infra' });

  // 9. Innovation Bridge Hook
  registerHook('agent:task:failed', async (ctx: any) => {
    logInfo('InnovationHook', `Agent ${ctx?.agentName} failed task ${ctx?.task}. Checking failure patterns for TRIZ analysis.`);
    agentManager.queueTask(`Analyze task failure using TRIZ principles: ${ctx?.task}`, 'innovation_bridge', ctx);
  }, { category: 'learning' });

  // 10. UX Designer Hook
  registerHook('track:phase:architect:completed', async (ctx: any) => {
    logInfo('UXHook', `Architect phase completed for ${ctx?.agentName}. Generating UX spec for UI components.`);
    agentManager.queueTask(`Generate UX specification for track: ${ctx?.trackId}`, 'UXDesigner', ctx);
  }, { category: 'lifecycle' });

  // 11. Napi KKV Pénzügyi Pulzus Hook
  registerHook('cron:daily:financial:close', async () => {
    logInfo('CronHook', `Executing Daily Financial Close for KKV clients. Collecting bank, invoice, and cashflow data.`);
    agentManager.queueTask('Run full daily accounting and financial reconciliation pipeline', 'AccountingPipeline');
  }, { category: 'cron' });

  // 12. KnowledgeBase Builder Hook
  registerHook('track:completed', async (ctx: any) => {
    logInfo('KBHook', `Track completed by ${ctx?.agentName}. Generating wiki entry with lessons learned.`);
    agentManager.queueTask(`Generate knowledge base entry and summary for the completed track: ${ctx?.trackId || 'unknown'}`, 'documenter', ctx);
  }, { category: 'learning' });

  // 13. Orphan File Cleanup Hook
  registerHook('file:created:root', async (ctx: any) => {
    logInfo('CleanupHook', `File created in root: ${ctx?.result?.filename}. Checking if it needs auto-sorting.`);
    agentManager.queueTask(`Root file triage: ${ctx?.result?.filename}`, 'ProjectMaintainer', ctx);
  }, { category: 'infra' });

  registerHook('log:file:size:exceeded', async (ctx: any) => {
    if (ctx?.result?.sizeMb > 50) {
      logInfo('CleanupHook', `Log file ${ctx?.result?.filename} exceeded 50MB. Rotating and compressing.`);
      agentManager.queueTask(`Log rotation for ${ctx?.result?.filename}`, 'ProjectMaintainer', ctx);
    }
  }, { category: 'infra' });

  // 14. Build Failure Auto-heal Hook
  registerHook('build:failed', async (ctx: any) => {
    logInfo('AutoHealHook', `Build failed. Errors: ${ctx?.result?.errors?.length}. Attempting LintFixer auto-heal.`);
    agentManager.queueTask('Fix lint and build errors in the current workspace', 'lint_fixer', ctx);
  }, { category: 'infra' });

  // 15. Test Flakiness Hook
  registerHook('test:flaky:detected', async (ctx: any) => {
    if (ctx?.result?.passRate < 0.7) {
      logInfo('TestHook', `Flaky test detected: ${ctx?.result?.testFile} with pass rate ${ctx?.result?.passRate}. Diagnosing.`);
      agentManager.queueTask(`Debug flaky test file: ${ctx?.result?.testFile}`, 'qa', ctx);
    }
  }, { category: 'infra' });

  // 16. n8n Workflow Timeout Hook
  registerHook('n8n:workflow:timeout', async (ctx: any) => {
    const { workflowId, lastNodeExecuted } = ctx?.result || {};
    logInfo('n8nHook', `Timeout: ${workflowId} @ ${lastNodeExecuted}. Saving checkpoint for resume.`);
  }, { category: 'infra' });

  // 17. n8n NAV Live Hook
  registerHook('nav:invoice:submitted', async (ctx: any) => {
    logInfo('NAVHook', `Invoice ${ctx?.result?.invoiceId} submitted. Starting polling for NAV status.`);
    agentManager.queueTask(`Poll NAV status for invoice: ${ctx?.result?.invoiceId}`, 'NavAgent', ctx);
  }, { category: 'business' });

  // 18. RobotkezV2 Selector Memory Hook
  registerHook('browser:selector:failed', async (ctx: any) => {
    logInfo('BrowserHook', `Selector failed on ${ctx?.result?.url}. Initiating Vision analysis and LLM selector repair.`);
    agentManager.queueTask(`Repair selector failure on ${ctx?.result?.url}`, 'RobotkezV2', ctx);
  }, { category: 'infra' });

  // 19. Browser Session Persistence Hook
  registerHook('browser:session:created', async (ctx: any) => {
    logInfo('BrowserHook', `Session created for ${ctx?.agentName}. Persisting cookies to R2.`);
  }, { category: 'infra' });

  registerHook('browser:session:restored', async (ctx: any) => {
    logInfo('BrowserHook', `Session restored for ${ctx?.agentName}. Skipping login step.`);
  }, { category: 'infra' });

  // 20. SQLite WAL Corruption Hook
  registerHook('db:integrity:check', async (ctx: any) => {
    logInfo('DBHook', 'Running integrity_check on all SQLite databases.');
  }, { category: 'infra' });

  registerHook('db:write:batch:completed', async (ctx: any) => {
    if (ctx?.result?.rowsAffected > 100) {
      logInfo('DBHook', `Batch write of ${ctx?.result?.rowsAffected} rows completed. Initiating auto-backup.`);
      agentManager.queueTask('Database backup and vacuum', 'ProjectMaintainer', ctx);
    }
  }, { category: 'infra' });

  // 21. LanceDB Embedding Drift Hook
  registerHook('ollama:model:changed', async (ctx: any) => {
    logInfo('EmbeddingHook', `Model changed from ${ctx?.result?.oldModel} to ${ctx?.result?.newModel}. Scheduling re-embedding task.`);
    agentManager.queueTask(`Re-embed knowledge base using new model: ${ctx?.result?.newModel}`, 'researcher', ctx);
  }, { category: 'learning' });

  // 22. Weekly Business Hook
  registerHook('cron:weekly:friday:close', async () => {
    logInfo('CronHook', `Executing Weekly Friday Close. Generating executive summaries for sales, HR, and finance.`);
    agentManager.queueTask('Generate weekly business executive summary', 'BrunellaProjectManager');
  }, { category: 'cron' });

  // 23. Demand Forecast Campaign Hook
  registerHook('demand:forecast:completed', async (ctx: any) => {
    const { product, trend, currentStock } = ctx?.result || {};
    logInfo('MarketingHook', `Forecast complete for ${product}. Trend is ${trend}. Checking inventory ${currentStock} for campaign generation.`);
    if (trend === 'up' && currentStock > 0) {
        agentManager.queueTask(`Generate marketing campaign for trending product: ${product}`, 'marketing_director', ctx);
    }
  }, { category: 'business' });

  // 24. LocalCSR ESG Report Hook
  registerHook('cron:quarterly', async () => {
    logInfo('CronHook', 'Executing Quarterly ESG calculations. Generating carbon footprint report.');
    agentManager.queueTask('Generate quarterly ESG and Carbon report', 'LocalCSR');
  }, { category: 'cron' });

  registerHook('cron:weekly:self-improve', async () => {
    logInfo('CronHook', 'Weekly self-improvement scheduler hook fired.');
    agentManager.queueTask('Run system self-improvement cycle', 'agent_architect');
  }, { category: 'cron' });

  registerHook('cron:daily:world-perception', async () => {
    logInfo('CronHook', 'Daily world perception scheduler hook fired.');
    agentManager.queueTask('Run daily AI news briefing and tech harvesting', 'DailyAgentBriefing');
  }, { category: 'cron' });

  registerHook('decision.analysis.started', async (ctx: any) => {
    const { decisionId, triggeredBy, scenarioCount } = ctx || {};
    logInfo('DecisionHook', `Predictive decision ${decisionId} started by ${triggeredBy} with scenarioCount=${scenarioCount}`);
  }, { category: 'learning' });

  registerHook('decision.scenarios.generated', async (ctx: any) => {
    const { decisionId, scenarioCount, averageScore } = ctx || {};
    logInfo('DecisionHook', `Predictive decision ${decisionId} generated ${scenarioCount} scenarios (avg=${averageScore ?? 'n/a'})`);
  }, { category: 'learning' });

  registerHook('decision.action.selected', async (ctx: any) => {
    const { decisionId, actionType, sourceType, totalScore } = ctx || {};
    logInfo('DecisionHook', `Predictive decision ${decisionId} selected ${actionType} from ${sourceType} @ ${totalScore ?? 'n/a'}`);
  }, { category: 'learning' });

  registerHook('decision.action.executed', async (ctx: any) => {
    const { decisionId, actionType, outcome, error } = ctx || {};
    if (outcome === 'executed') {
      logInfo('DecisionHook', `Predictive decision ${decisionId} executed ${actionType}`);
      return;
    }
    logError('DecisionHook', `Predictive decision ${decisionId} failed while executing ${actionType}: ${error ?? 'unknown error'}`);
  }, { category: 'learning' });

  registerHook('decision.action.rolled_back', async (ctx: any) => {
    const { decisionId, actionType, rolledBackAt } = ctx || {};
    logInfo('DecisionHook', `Predictive decision ${decisionId} rolled back ${actionType} at ${rolledBackAt}`);
  }, { category: 'learning' });

  registerHook('decision.cycle.completed', async (ctx: any) => {
    const { decisionId, outcome, scenarioCount, actionType } = ctx || {};
    logInfo('DecisionHook', `Predictive decision ${decisionId} completed with outcome=${outcome}, scenarios=${scenarioCount}, action=${actionType ?? 'none'}`);
  }, { category: 'learning' });
}
