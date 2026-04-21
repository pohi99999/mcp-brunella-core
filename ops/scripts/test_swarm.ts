
import { AgentManager } from '../src/agents/AgentManager.js';
import ResearcherAgent from '../src/agents/ResearcherAgent.js';
import DataScientistAgent from '../src/agents/DataScientistAgent.js';

// Mock routing rules until registry.json is updated
const mockRegistry: any = {
    version: '1.0.0',
    agents: [
        { name: 'Researcher', autoStart: false },
        { name: 'DataScientist', autoStart: false }
    ],
    defaultAgent: 'Researcher',
    routingRules: [
        { pattern: 'keress|search', agent: 'Researcher' },
        { pattern: 'elemz|analyze', agent: 'DataScientist' }
    ]
};

async function testSwarm() {
    console.log('🚀 Starting Swarm Test...');

    const manager = new AgentManager();
    // Inject mock registry and agents manually for test isolation
    (manager as any).registry = mockRegistry;

    // Register agents manually
    manager.registerAgent(new ResearcherAgent() as any);
    manager.registerAgent(new DataScientistAgent() as any);

    console.log('✅ Agents registered.');

    const taskDescription = 'Keress információt az "Apple Stock" árfolyamáról, majd elemezd az eredményeket.';
    console.log(`\n📋 Task: "${taskDescription}"`);

    const result = await manager.delegateTask({
        id: 'test-task-1',
        instruction: taskDescription,
        createdAt: new Date().toISOString()
    });

    console.log('\n🏁 Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.executedBy === 'DataScientist') {
        console.log('\n✨ TEST PASSED: Successful handoff and execution chain!');
    } else {
        console.error('\n❌ TEST FAILED: Chain did not complete as expected.');
    }
}

testSwarm().catch(console.error);
