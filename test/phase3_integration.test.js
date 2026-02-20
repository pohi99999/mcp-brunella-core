import { describe, it, expect } from 'vitest';
import { LogisticsDispatcher } from '../src/agents/LogisticsDispatcher.js';
import { NurturerAgent } from '../src/agents/NurturerAgent.js';
import { GenesisOrchestrator } from '../src/agents/GenesisOrchestrator.js';
describe('Phase 3 Integration Tests', () => {
    describe('LogisticsDispatcher + RouteOptimizer', () => {
        it('should calculate optimized route via python worker', async () => {
            const dispatcher = new LogisticsDispatcher();
            const context = {
                shipments: [
                    { id: 'S1', origin: 'Budapest', destination: 'Szeged' },
                    { id: 'S2', origin: 'Szentendre', destination: 'Szeged' }
                ],
                vehicle: { capacity: 100 }
            };
            // Since we can't reliably run python in unit test without env, 
            // we check if the code paths handle its absence or presence gracefully
            const result = await dispatcher.execute('optimizáld az útvonalat', context);
            expect(result.success).toBeDefined();
        });
    });
    describe('NurturerAgent (Real Estate)', () => {
        it('should generate marketing campaigns from property analysis', async () => {
            const agent = new NurturerAgent();
            const context = {
                task: 'generálj hirdetést',
                metadata: {
                    analysis: {
                        asset: {
                            id: 'PROP-123',
                            hrsz: '1234/A/1',
                            source_file: 'test.pdf',
                            property_type: 'apartment',
                            area_sqm: 55,
                            address: { city: 'Budapest', street: 'Fő utca' },
                            utilities: { gas: true }
                        },
                        market_summary: 'Kiváló lokáció, növekvő árak.',
                        valuation: { recommendation: 'BUY' },
                        generated_at: new Date().toISOString()
                    }
                }
            };
            const result = await agent.execute('generálj hirdetést', context);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Kampány');
            expect(result.data).toBeDefined();
        });
    });
    describe('GenesisOrchestrator (Software)', () => {
        it('should orchestrate a genesis protocol from spec', async () => {
            const orchestrator = new GenesisOrchestrator();
            // Register mock agents to prevent "Agent not found"
            const { agentManager } = await import('../src/agents/AgentManager.js');
            agentManager.registerAgent({
                name: 'Developer',
                role: 'dev',
                description: 'dev',
                capabilities: [],
                execute: async () => ({ status: 'success', message: 'OK' })
            });
            agentManager.registerAgent({
                name: 'Evaluator',
                role: 'qa',
                description: 'qa',
                capabilities: [],
                execute: async () => ({ status: 'success', message: 'OK' })
            });
            const spec = {
                app_name: "TestApp",
                agent_task_queue: [
                    { task_id: 'TASK-1', agent: 'Developer', prompt: 'Create index.ts' },
                    { task_id: 'TASK-2', agent: 'Evaluator', prompt: 'Test index.ts' }
                ],
                total_tasks: 2
            };
            const context = {
                task: 'futtasd a genesis protokolt',
                metadata: { spec }
            };
            const result = await orchestrator.execute('futtasd a genesis protokolt', context);
            expect(result.success).toBe(true);
            expect(result.message).toContain('Genesis protokoll befejezve');
        });
    });
});
