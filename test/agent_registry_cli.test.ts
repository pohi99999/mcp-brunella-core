import fs from 'fs';
import path from 'path';
import os from 'os';
import assert from 'assert';
import { agentCommand } from '../src/cli/commands/agent.ts';

const originalCwd = process.cwd();

function loadRegistry(tmpDir: string) {
  const regPath = path.join(tmpDir, 'src', 'agents', 'registry.json');
  return JSON.parse(fs.readFileSync(regPath, 'utf-8'));
}

async function runAgentCmd(tmpDir: string, args: string[]) {
  process.chdir(tmpDir);
  await agentCommand.parseAsync(['node', 'agent', ...args], { from: 'user' });
}

try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-registry-'));
  const agentsDir = path.join(tmp, 'src', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  const regPath = path.join(agentsDir, 'registry.json');
  fs.writeFileSync(regPath, JSON.stringify({
    agents: [
      { name: 'orchestrator', title: 'Orchestrator', status: 'active', category: 'core', tags: ['Karmester'] }
    ]
  }, null, 2));

  // add
  await runAgentCmd(tmp, ['registry', 'add', 'qa', '--title', 'QA Agent', '--status', 'active', '--tags', 'testing,qa', '--capabilities', 'test_execution,validation']);
  let reg = loadRegistry(tmp);
  const qa = reg.agents.find((a: any) => a.name === 'qa');
  assert.ok(qa, 'QA agent should be added');
  assert.equal(qa.title, 'QA Agent');
  assert.equal(qa.status, 'active');
  assert.deepEqual(qa.tags, ['testing', 'qa']);
  assert.deepEqual(qa.capabilities, ['test_execution', 'validation']);

  // update
  await runAgentCmd(tmp, ['registry', 'update', 'qa', '--status', 'planned', '--tags', 'qa']);
  reg = loadRegistry(tmp);
  const qaUpdated = reg.agents.find((a: any) => a.name === 'qa');
  assert.ok(qaUpdated, 'QA agent should exist after update');
  assert.equal(qaUpdated.status, 'planned');
  assert.deepEqual(qaUpdated.tags, ['qa']);

  // remove
  await runAgentCmd(tmp, ['registry', 'remove', 'qa']);
  reg = loadRegistry(tmp);
  assert.ok(!reg.agents.find((a: any) => a.name === 'qa'), 'QA agent should be removed');
  assert.ok(reg.agents.find((a: any) => a.name === 'orchestrator'), 'Original agent should stay');

  console.log('agent registry CLI tests passed.');
} catch (e) {
  console.error('agent registry CLI tests failed:', e);
  process.exit(1);
} finally {
  process.chdir(originalCwd);
}
