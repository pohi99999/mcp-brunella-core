/**
 * D1 Adapter Test Script
 * 
 * Purpose: Verify D1 Adapter can query Cloudflare D1 from Node.js
 * 
 * Usage:
 *   node build/test/testD1Adapter.js
 * 
 * Environment variables required:
 *   CLOUDFLARE_WORKER_URL - Worker endpoint
 *   CEAN_API_KEY - API key for authentication
 */

import { D1Adapter } from '../src/utils/d1Adapter.js';
import { logInfo, logError } from '../src/utils/logger.js';

async function testD1Adapter() {
  logInfo('D1 Test', '========== D1 Adapter Test ==========');

  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
  const apiKey = process.env.CEAN_API_KEY;

  if (!workerUrl || !apiKey) {
    logError(
      'D1 Test',
      'Missing environment variables: CLOUDFLARE_WORKER_URL or CEAN_API_KEY',
    );
    process.exit(1);
  }

  logInfo('D1 Test', `Worker URL: ${workerUrl}`);

  const d1 = new D1Adapter({ workerUrl, apiKey });

  // Test 1: List all tables
  logInfo('D1 Test', '\n--- Test 1: List all tables ---');
  const tablesResult = await d1.query(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );

  if (tablesResult.status === 'success') {
    logInfo('D1 Test', `✅ Found ${tablesResult.results?.length || 0} tables`);
    console.log(tablesResult.results);
  } else {
    logError('D1 Test', `❌ Failed: ${tablesResult.error}`);
  }

  // Test 2: Check Phase 1 tables
  logInfo('D1 Test', '\n--- Test 2: Check Phase 1 tables ---');
  const phase1Result = await d1.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('enterprise_events', 'agent_tasks', 'golden_samples')",
  );

  if (phase1Result.status === 'success' && phase1Result.results?.length === 3) {
    logInfo('D1 Test', '✅ All 3 Phase 1 tables exist');
    console.log(phase1Result.results);
  } else {
    logError('D1 Test', `❌ Phase 1 tables missing: ${phase1Result.error || 'Unknown'}`);
  }

  // Test 3: Insert enterprise event
  logInfo('D1 Test', '\n--- Test 3: Insert enterprise event ---');
  const insertResult = await d1.insertEnterpriseEvent({
    id: `test-${Date.now()}`,
    type: 'TEST_EVENT',
    payload: { message: 'Hello from Node.js!', timestamp: new Date().toISOString() },
    source_module: 'D1 Adapter Test',
    priority: 'LOW',
  });

  if (insertResult.status === 'success') {
    logInfo('D1 Test', '✅ Event inserted successfully');
  } else {
    logError('D1 Test', `❌ Insert failed: ${insertResult.error}`);
  }

  // Test 4: Query enterprise events
  logInfo('D1 Test', '\n--- Test 4: Query enterprise events ---');
  const eventsResult = await d1.getEnterpriseEventsByType('TEST_EVENT', 5);

  if (eventsResult.status === 'success') {
    logInfo('D1 Test', `✅ Found ${eventsResult.results?.length || 0} test events`);
    console.log(eventsResult.results);
  } else {
    logError('D1 Test', `❌ Query failed: ${eventsResult.error}`);
  }

  // Test 5: Insert agent task
  logInfo('D1 Test', '\n--- Test 5: Insert agent task ---');
  const taskResult = await d1.insertAgentTask({
    id: `task-${Date.now()}`,
    agent_name: 'TestAgent',
    task: 'Verify D1 integration works',
    status: 'completed',
  });

  if (taskResult.status === 'success') {
    logInfo('D1 Test', '✅ Agent task inserted successfully');
  } else {
    logError('D1 Test', `❌ Task insert failed: ${taskResult.error}`);
  }

  // Test 6: Insert golden sample
  logInfo('D1 Test', '\n--- Test 6: Insert golden sample ---');
  const sampleResult = await d1.insertGoldenSample({
    id: `sample-${Date.now()}`,
    instruction: 'Test D1 adapter integration',
    output: 'D1 adapter query successful',
    source: 'manual-test',
    agent_name: 'D1Adapter',
  });

  if (sampleResult.status === 'success') {
    logInfo('D1 Test', '✅ Golden sample inserted successfully');
  } else {
    logError('D1 Test', `❌ Sample insert failed: ${sampleResult.error}`);
  }

  // Test 7: Query all golden samples
  logInfo('D1 Test', '\n--- Test 7: Query all golden samples ---');
  const samplesResult = await d1.getAllGoldenSamples(5);

  if (samplesResult.status === 'success') {
    logInfo('D1 Test', `✅ Found ${samplesResult.results?.length || 0} golden samples`);
    console.log(samplesResult.results);
  } else {
    logError('D1 Test', `❌ Query failed: ${samplesResult.error}`);
  }

  logInfo('D1 Test', '\n========== Test Complete ==========');
}

testD1Adapter().catch((error) => {
  logError('D1 Test', `Unexpected error: ${error.message}`);
  process.exit(1);
});
