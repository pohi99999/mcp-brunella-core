import { NavAgent } from './agents/NavAgent.js';
import { BankAgent } from './agents/BankAgent.js';
import { MatchingAgent } from './agents/MatchingAgent.js';
import { logInfo, logError } from './utils/logger.js';
import { initDB } from './data/bookkeeping_db.js';
import { AgentResponse } from './agents/types.js';

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

    console.log(`NAV Status: ${navResult.status}, Invoices found: ${Array.isArray(navResult.data) ? navResult.data.length : 0}`);
    console.log(`Bank Status: ${bankResult.status}, Transactions found: ${Array.isArray(bankResult.data) ? bankResult.data.length : 0}`);

    // 2. Run Matcher Agent
    const matcher = new MatchingAgent();
    logInfo(SESSION_NAME, 'Phase 2: Running MatchingAgent to align transactions with invoices...');
    
    const matchingResult = await matcher.execute('Match all PENDING bank transactions') as AgentResponse;
    
    console.log(`Matcher Status: ${matchingResult.status}`);
    if (matchingResult.data) {
      const data = matchingResult.data as { total: number; matched: number; manual: number };
      console.log('--- Matching Summary ---');
      console.log(`Total Handled: ${data.total}`);
      console.log(`Auto-Completed: ${data.matched}`);
      console.log(`Manual Review: ${data.manual}`);
      console.log('-------------------------');
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
