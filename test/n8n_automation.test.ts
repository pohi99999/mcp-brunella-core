// FILE: test/n8n_automation.test.ts
// PURPOSE: Ellenőrzi, hogy a Python worker indítható-e és látja-e a környezeti változókat.

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import axios from 'axios'; // For API cleanup

const execPromise = promisify(exec);

describe("Robotkéz n8n Integration Test", () => {
    it("should verify environment variables are present", () => {
        expect(process.env.N8N_TEST_USER).toBeDefined();
        expect(process.env.N8N_TEST_URL).toBeDefined();
    });

    it("should create and rename a workflow via n8n API", async () => {
        const pythonScriptPath = path.join(process.cwd(), "myai/browser_worker.py");
        // Use python3 on non-Windows platforms (like CI), or just 'python' if venv is active/alias exists
        // In this environment, we assume python or python3 is available.
        // We avoid hardcoded venv paths which fail in CI.
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

        let workflowId: string | undefined;

        try {
            // Run the Python script that executes the API scenario
            const { stdout, stderr } = await execPromise(`${pythonCommand} "${pythonScriptPath}"`);

            // Log stdout and stderr for debugging
            console.log("Python Script Stdout:", stdout);
            if (stderr) console.error("Python Script Stderr:", stderr);

            // Assert that the scenario completed successfully and extracted workflow details
            expect(stdout).toContain("Scenario execution complete via API.");
            expect(stdout).toContain("Workflow created:");
            expect(stdout).toContain("Workflow renamed to:");

            // Extract workflow ID from stdout for cleanup
            const idMatch = stdout.match(/ID: ([\w-]+)/);
            if (idMatch && idMatch[1]) {
                workflowId = idMatch[1];
            } else {
                throw new Error("Could not extract workflow ID from Python script output.");
            }

        } finally {
            // Cleanup: Delete the created workflow via n8n API
            if (workflowId && workflowId !== 'mock-id' && process.env.N8N_API_KEY && process.env.N8N_TEST_URL) {
                const n8nBaseUrl = process.env.N8N_TEST_URL;
                const n8nApiKey = process.env.N8N_API_KEY;

                try {
                    await axios.delete(`${n8nBaseUrl}/api/v1/workflows/${workflowId}`, {
                        headers: {
                            "X-N8N-API-KEY": n8nApiKey,
                            "Accept": "application/json"
                        }
                    });
                    console.log(`Cleaned up workflow with ID: ${workflowId}`);
                } catch (error) {
                    console.error(`Error during cleanup of workflow ${workflowId}:`, error);
                }
            } else {
                console.warn("Cleanup skipped: Workflow ID mock-id or n8n API credentials missing.");
            }
        }
    }, 30000); // Increased timeout for the API call and cleanup
});
