// FILE: test/n8n_automation.test.ts
// PURPOSE: Ellenőrzi, hogy a Python worker indítható-e és látja-e a környezeti változókat.

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios'; // For API cleanup

const execPromise = promisify(exec);

import { describe, it, expect } from 'vitest';

describe("Robotkéz n8n Integration Test", () => {
    // Skip tests in CI/Linux environments where Windows paths and specific setup are unavailable
    const isCI = process.env.CI === 'true';
    const isLinux = process.platform === 'linux';
    const runIntegration = process.env.RUN_N8N_INTEGRATION === 'true';
    const shouldSkip = isCI || isLinux || !runIntegration;

    it.skipIf(shouldSkip)("should verify environment variables are present", () => {
        expect(process.env.N8N_TEST_USER).toBeDefined();
        expect(process.env.N8N_TEST_URL).toBeDefined();
    });

    it.skipIf(shouldSkip)("should create and rename a workflow via n8n API", async () => {
        const pythonScriptPath = "F:/mcp-brunella-core/myai/browser_worker.py";
        const venvPythonPath = "F:/mcp-brunella-core/.venv/Scripts/python";

        let workflowId: string | undefined;

        try {
            // Run the Python script that executes the API scenario
            const projectRoot = 'F:/mcp-brunella-core'; // Explicitly define project root
            const { stdout, stderr } = await execPromise(`${venvPythonPath} ${pythonScriptPath}`, {
                env: { PYTHONPATH: projectRoot }
            });

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
            if (workflowId && process.env.N8N_API_KEY && process.env.N8N_TEST_URL) {
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
                console.warn("Cleanup skipped: Workflow ID or n8n API credentials missing.");
            }
        }
    }, 30000); // Increased timeout for the API call and cleanup
});