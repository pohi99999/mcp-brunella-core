import { describe, it, expect } from 'vitest';
import { DataScientistAgent } from '../src/agents/DataScientistAgent.js';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';

// Check for python environment
const venvPy = path.resolve(config.workspaceRoot, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const hasPython = fs.existsSync(venvPy);

describe.skipIf(!hasPython)('DataScientist Agent', () => {
    
    it('should refine raw input data', async () => {
        const agent = new DataScientistAgent();
        const rawInput = "<div>  Ez egy nagyon fontos logisztikai adat!  <a href='http://spam.com'>Click me</a> </div>";
        const expectedTopic = "logisztika";

        const result = await agent.execute("refine:test", { content: rawInput, source: 'test_suite' });
        
        expect(result).toBeDefined();
        // Check for error response
        if (result.status === 'error') {
             console.error("Agent error:", result.error);
        }
        expect(result.status).not.toBe('error');

        // Logic verification based on refiner_logic.py behavior
        // 1. Tags removed -> "  Ez egy nagyon fontos logisztikai adat!  Click me "
        // 2. URLs removed -> "  Ez egy nagyon fontos logisztikai adat!  Click me " (link text remains)
        // 3. Whitespace normalized -> "Ez egy nagyon fontos logisztikai adat! Click me"
        
        expect(result.clean_content).toBe("Ez egy nagyon fontos logisztikai adat! Click me");
        expect(result.metadata.detected_topics).toContain(expectedTopic);
        expect(result.metadata.is_actionable).toBe(true);
    });
});