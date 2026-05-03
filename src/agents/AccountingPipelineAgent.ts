import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { agentManager } from './AgentManager.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';
import { AgentStateMachine, type StateNode, type Transition } from '../core/agentStateMachine.js';

export type AccountingPipelineState = 
  | 'IDLE' 
  | 'INGESTING_NAV' 
  | 'INGESTING_BANK' 
  | 'MATCHING' 
  | 'HANDLING_EXCEPTIONS' 
  | 'SYNCING' 
  | 'DONE' 
  | 'ERROR';

const STATES: StateNode<AccountingPipelineState>[] = [
  { name: 'IDLE' },
  { name: 'INGESTING_NAV' },
  { name: 'INGESTING_BANK' },
  { name: 'MATCHING' },
  { name: 'HANDLING_EXCEPTIONS' },
  { name: 'SYNCING' },
  { name: 'DONE' },
  { name: 'ERROR' },
];

const TRANSITIONS: Transition<AccountingPipelineState>[] = [
  { from: 'IDLE', to: 'INGESTING_NAV', event: 'start' },
  { from: 'INGESTING_NAV', to: 'INGESTING_BANK', event: 'navDone' },
  { from: 'INGESTING_BANK', to: 'MATCHING', event: 'bankDone' },
  { from: 'MATCHING', to: 'HANDLING_EXCEPTIONS', event: 'matchDone' },
  { from: 'HANDLING_EXCEPTIONS', to: 'SYNCING', event: 'exceptionsDone' },
  { from: 'SYNCING', to: 'DONE', event: 'syncDone' },
  { from: 'INGESTING_NAV', to: 'ERROR', event: 'error' },
  { from: 'INGESTING_BANK', to: 'ERROR', event: 'error' },
  { from: 'MATCHING', to: 'ERROR', event: 'error' },
  { from: 'HANDLING_EXCEPTIONS', to: 'ERROR', event: 'error' },
  { from: 'SYNCING', to: 'ERROR', event: 'error' },
];

/**
 * AccountingPipelineAgent - Koordinálja a teljes könyvelési automatizációs folyamatot.
 * NAV adatok -> Banki adatok -> Párosítás -> Kivételkezelés -> Sheets szinkron.
 */
export class AccountingPipelineAgent extends BaseAgent {
  name = 'AccountingPipeline';
  role = 'Könyvelési folyamat koordinátor';
  description = 'Végigvezeti a rendszert a teljes könyvelési munkafolyamaton az adatgyűjtéstől a szinkronizálásig.';
  capabilities = ['accounting-workflow-orchestration', 'pipeline-management'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = typeof context.task === 'string' ? context.task : 'Run full accounting pipeline';
    const taskId = `acc-pipe-${Date.now()}`;
    logInfo(this.name, `Starting accounting pipeline: ${taskId}`);

    const machine = new AgentStateMachine<AccountingPipelineState>(
      STATES,
      TRANSITIONS,
      'IDLE',
      taskId
    );

    try {
      // 1. NAV Ingestion
      await machine.transition('start');
      logInfo(this.name, 'Step 1: Fetching NAV data...');
      const navResult = await agentManager.delegate('NavAgent', 'Fetch latest invoices from NAV') as AgentResult;
      if (!navResult.success) throw new Error(`NAV Ingestion failed: ${navResult.message}`);

      // 2. Bank Ingestion
      await machine.transition('navDone');
      logInfo(this.name, 'Step 2: Processing bank statements...');
      const bankResult = await agentManager.delegate('BankAgent', 'Process bank transactions') as AgentResult;
      if (!bankResult.success) throw new Error(`Bank Ingestion failed: ${bankResult.message}`);

      // 3. Matching
      await machine.transition('bankDone');
      logInfo(this.name, 'Step 3: Matching transactions with invoices...');
      const matchResult = await agentManager.delegate('MatchingAgent', 'Run reconciliation matching') as AgentResult;
      if (!matchResult.success) throw new Error(`Matching failed: ${matchResult.message}`);

      // 4. Exception Handling
      await machine.transition('matchDone');
      logInfo(this.name, 'Step 4: Analyzing unmatched items...');
      const exceptionResult = await agentManager.delegate('ReconciliationException', 'Analyze reconciliation exceptions') as AgentResult;
      // Non-critical if it fails or finds nothing
      logInfo(this.name, `Exceptions processed: ${exceptionResult.message}`);

      // 5. Sheets Sync
      await machine.transition('exceptionsDone');
      logInfo(this.name, 'Step 5: Syncing results to Google Sheets...');
      const syncResult = await agentManager.delegate('SheetsSyncAgent', 'Sync transaction states to Google Sheets') as AgentResult;
      if (!syncResult.success) logWarn(this.name, `Sheets Sync failed: ${syncResult.message}`);

      await machine.transition('syncDone');
      return {
        success: true,
        message: 'A teljes könyvelési pipeline sikeresen lefutott.',
        data: {
          nav: navResult.data,
          bank: bankResult.data,
          matching: matchResult.data,
          sync: syncResult.data
        }
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Pipeline error: ${err.message}`);
      try { await machine.transition('error'); } catch {
        // Silently ignore state transition errors during error handling
      }
      return { success: false, message: `Pipeline hiba: ${err.message}` };
    }
  }
}
