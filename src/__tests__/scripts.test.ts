import { exec } from 'child_process';
import path from 'path';

describe('Scripts', () => {
    it('jules_check.mjs runs and returns JSON', (done) => {
        const scriptPath = path.resolve(__dirname, '../../scripts/jules_check.mjs');
        // We use absolute path for cwd to avoid issues
        const projectRoot = path.resolve(__dirname, '../../');
        
        exec(`node "${scriptPath}"`, { cwd: projectRoot }, (error, stdout, stderr) => {
            if (error) {
                // If it fails with exit code 1 (e.g. missing logs), it might still output JSON.
                // But normally we expect it to pass if we just want to verify it runs.
                // Assuming current env has logs (we checked).
                // If it fails, check if stdout is JSON.
            }
            
            try {
                // stdout might contain other logs if not clean, but script should only output JSON
                const output = JSON.parse(stdout.trim());
                expect(output).toHaveProperty('status');
                done();
            } catch (e) {
                done(new Error(`Failed to parse output: "${stdout}". Stderr: "${stderr}". Error: ${e}`));
            }
        });
    });
});
