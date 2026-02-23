// test/agents/LeadMiningAgent.test.ts
import { describe, it, expect } from 'vitest';
import { LeadMiningAgent } from '../../src/agents/LeadMiningAgent.js';

describe('LeadMiningAgent', () => {
    it('should be defined', () => {
        const agent = new LeadMiningAgent();
        expect(agent.name).toBe('lead_mining');
    });
});
