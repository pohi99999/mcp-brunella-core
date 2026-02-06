import { describe, it, expect } from 'vitest';
import DataScientistAgent from '../src/agents/DataScientistAgent.js';

describe('DataScientist Agent', () => {

    it('should analyze data when task contains "analyze"', async () => {
        const agent = new DataScientistAgent();

        const result = await agent.execute("analyze this data", {});

        expect(result).toBeDefined();
        expect(result.status).toBe('success');
        expect(result.data).toBeDefined();
        expect(result.data.summary).toBe('Data analysis complete.');
    });

    it('should reject non-analysis tasks', async () => {
        const agent = new DataScientistAgent();

        const result = await agent.execute("do something else", {});

        expect(result).toBeDefined();
        expect(result.status).toBe('error');
        expect(result.error).toContain('Csak elemzési');
    });

    it('should accept Hungarian "elemz" keyword', async () => {
        const agent = new DataScientistAgent();

        const result = await agent.execute("elemz az adatokat", {});

        expect(result).toBeDefined();
        expect(result.status).toBe('success');
    });
});
