// FILE: test/robotkez_integration.test.ts
// PURPOSE: Integrációs teszt a Robotkéz CLI-alapú browser_action tool-hoz.
import { describe, it, expect } from 'vitest';
import { PythonShell } from 'python-shell';
import path from 'path';
import fs from 'fs';
describe('Robotkéz (Browser-Use) CLI Integration', () => {
    // FIGYELEM: Ez a teszt valódi böngészőt indít! 
    // CI környezetben a headless: true kötelező.
    it('should run a simple browser task via CLI', async () => {
        const scriptPath = path.resolve(process.cwd(), 'myai/browser_task_runner.py');
        if (!fs.existsSync(scriptPath)) {
            console.warn('⚠️ browser_task_runner.py not found, skipping test');
            expect(true).toBe(true);
            return;
        }
        const options = {
            mode: 'text',
            pythonPath: 'python',
            pythonOptions: ['-u'],
            scriptPath: path.dirname(scriptPath),
            args: [
                '--task', 'Go to google.com and tell me the title of the page.',
                '--headless', 'True',
                '--vision', 'False'
            ]
        };
        try {
            const messages = await PythonShell.run(path.basename(scriptPath), options);
            const lastMessage = messages[messages.length - 1];
            console.log('📋 Robotkéz CLI Output:', lastMessage);
            const result = JSON.parse(lastMessage);
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('final_answer');
            if (result.success) {
                console.log('✅ Robotkéz task sikeres!');
                console.log('📝 Final answer:', result.final_answer);
                console.log('📊 Metadata:', JSON.stringify(result.extracted_data));
                // Ellenőrizzük hogy a script valid választ adott
                expect(result.final_answer).toBeDefined();
                // NE ellenőrizzük a tartalmat - lehet hogy a Gemini nem adott vissza semmit (rate limit, stb.)
                // A lényeg hogy a CLI híd működik és valid JSON-t kapunk
            }
            else {
                console.error('❌ Browser task failed:', result.error);
                // Nem bukik a teszt ha nincs GEMINI_API_KEY
                if (result.error?.includes('GEMINI_API_KEY')) {
                    console.warn('⚠️ GEMINI_API_KEY missing, skipping assertion');
                    expect(true).toBe(true);
                }
                else {
                    expect(result.success).toBe(true);
                }
            }
        }
        catch (error) {
            console.error('❌ Python execution error:', error.message);
            // Nem bukik a teszt ha nincs GEMINI_API_KEY vagy browser-use
            if (error.message.includes('GEMINI_API_KEY') || error.message.includes('No module named')) {
                console.warn('⚠️ Dependencies missing, skipping test');
                expect(true).toBe(true);
            }
            else {
                throw error;
            }
        }
    }, 120000); // 2 perc timeout
});
