import { NavAgent } from '@packages/agents/NavAgent.js';
import { BankAgent } from '@packages/agents/BankAgent.js';
import { MatchingAgent } from '@packages/agents/MatchingAgent.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { initDB } from '@packages/utils/bookkeeping_db.js';
import { AgentResponse } from '@packages/agents/types.js';
import { writeLine } from '@packages/utils/cliOutput.js';

async function runBookkeepingDemo() {
  const SESSION_NAME = 'Bookkeeping_Demo_v1';
  logInfo(SESSION_NAME, 'Starting E2E bookkeeping automation demonstration...');

  try {
    // 0. Initialize fresh state
    initDB();

    // 1. Run Data Ingestors
    const nav = new NavAgent();
    const bank = new BankAgent();
    
    logInfo(SESSION_NAME, 'Phase 1: Ingesting sample data (NAV XML + Bank CSV)...');
    
    const navResult = await nav.execute('Process NAV invoices from conductor track samples') as AgentResponse;
    const bankResult = await bank.execute('Process bank transactions from conductor track samples') as AgentResponse;

    writeLine(`NAV Status: ${navResult.status}, Invoices found: ${Array.isArray(navResult.data) ? navResult.data.length : 0}`);
    writeLine(`Bank Status: ${bankResult.status}, Transactions found: ${Array.isArray(bankResult.data) ? bankResult.data.length : 0}`);

    // 2. Run Matcher Agent
    const matcher = new MatchingAgent();
    logInfo(SESSION_NAME, 'Phase 2: Running MatchingAgent to align transactions with invoices...');
    
    const matchingResult = await matcher.execute('Match all PENDING bank transactions') as AgentResponse;
    
    writeLine(`Matcher Status: ${matchingResult.status}`);
    if (matchingResult.data) {
      const data = matchingResult.data as { total: number; matched: number; manual: number };
      writeLine('--- Matching Summary ---');
      writeLine(`Total Handled: ${data.total}`);
      writeLine(`Auto-Completed: ${data.matched}`);
      writeLine(`Manual Review: ${data.manual}`);
      writeLine('-------------------------');
    }

    // 3. Final Verification

    const matchedCount = (matchingResult.data as { matched?: number } | undefined)?.matched ?? 0;
    logInfo(SESSION_NAME, `✅ DEMO COMPLETE: ${matchedCount} matches reconciled.`);

  } catch (e) {
    logError(SESSION_NAME, `Demo failed: ${String(e)}`);
    process.exit(1);
  }
}

runBookkeepingDemo();
