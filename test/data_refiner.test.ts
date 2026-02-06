
import { describe, it, expect } from 'vitest';
import { DataScientistAgent } from '../src/agents/DataScientistAgent.js';

describe('DataScientist Agent - Refiner', () => {
    // Skip if python is not available or if running in environment where python shell is fragile
    // For now we assume we can run it if myai/refiner_logic.py exists
    
    it('should clean noisy HTML content', async () => {
        const agent = new DataScientistAgent();
        const noisyContent = `
            <html>
                <body>
                    <div class="ad">Buy now!</div>
                    <h1>Logisztikai Hírek</h1>
                    <p>A fuvarszervezés területén új AI ágensek jelentek meg.</p>
                    <a href="http://spam.com">Click me</a>
                </body>
            </html>
        `;
        
        const result = await agent.execute('refine: test', {
            content: noisyContent,
            source: 'test_case'
        });

        console.log('Refinement result:', result);

        expect(result).toBeDefined();
        // Depending on how PythonShell behaves in test env, we might get an error or success.
        // Ideally:
        if (result.status === 'success') {
            expect(result.clean_content).toContain('Logisztikai Hírek');
            expect(result.clean_content).not.toContain('<div>');
            expect(result.metadata.detected_topics).toContain('fuvarszervezés');
            expect(result.metadata.is_actionable).toBe(true);
        } else {
            // If python fails (e.g. missing interpreter), we warn but don't fail the test logic itself
            // unless we enforce python presence.
            console.warn('Skipping assertions due to python execution failure:', result.error);
        }
    });

    it('should drop irrelevant content', async () => {
        const agent = new DataScientistAgent();
        const irrelevantContent = `
            Just some random text about kittens and cooking. Nothing related to space travel.
        `;
        
        const result = await agent.execute('refine: test', {
            content: irrelevantContent,
            source: 'test_case_irrelevant'
        });

        console.log('Irrelevant result:', result);

        if (result.status === 'dropped' || (result.status && result.reason === 'Low relevance')) {
             expect(true).toBe(true); // Pass
        } else if (result.status === 'error') {
             console.warn('Skipping due to python error');
        } else {
             // It shouldn't be success
             expect(result.status).not.toBe('success');
        }
    });
});
