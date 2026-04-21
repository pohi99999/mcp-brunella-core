import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logInfo, logError } from "@packages/utils/logger.js";
import { mcpError, mcpOk } from "@packages/utils/mcpResponse.js";
import { ensureError } from "@packages/utils/ensureError.js";
import { agentManager } from "@packages/agents/AgentManager.js";
import { N8nClient } from "@packages/utils/n8nClient.js";

/**
 * Super-Bridge Tool az n8n munkafolyamatok indításához
 */
export function registerN8nTools(server: McpServer) {
    server.tool(
        "n8n_trigger_workflow",
        "Indít egy n8n munkafolyamatot a megadott adatokkal (Fire-and-Forget).",
        {
            workflowId: z.string().describe("Az n8n munkafolyamat egyedi azonosítója vagy slug-ja"),
            data: z.record(z.string(), z.unknown()).optional().describe("A munkafolyamatnak átadandó JSON adatok")
        },
        async ({ workflowId, data }) => {
            try {
                const n8nClient = new N8nClient();
                if (!n8nClient.hasApiKey()) {
                    return mcpError("N8N_API_KEY nincs beállítva a környezeti változók között.");
                }

                logInfo('N8nBridge', `Aszinkron workflow indítása: ${workflowId}`);

                // Trigger the workflow asynchronously to get an execution ID
                const asyncExec = await n8nClient.triggerWorkflowAsync(workflowId, data);
                const executionId = asyncExec.executionId;

                if (!executionId) {
                    throw new Error("n8n nem adott vissza executionId-t az aszinkron indításra.");
                }

                // Offload polling to the AgentManager
                agentManager.executeExternalTask(
                    executionId,
                    "n8n",
                    async () => {
                        const execution = await n8nClient.getExecution(executionId);
                        // Map n8n status to a standardized status
                        let status = 'running';
                        if (execution.finished) {
                            status = execution.status === 'success' ? 'completed' : 'failed';
                        }
                        return {
                            status,
                            result: execution,
                            error: execution.status === 'failed' ? 'Workflow execution failed' : undefined,
                        };
                    },
                    { timeoutMs: 20 * 60 * 1000, pollIntervalMs: 10000 } // 20 min timeout, 10s poll
                );

                return mcpOk({ taskId: executionId, status: "pending" }, `n8n workflow elindítva a háttérben. Task ID: ${executionId}`);

            } catch (error: unknown) {
                const normalized = ensureError(error);
                logError('N8nBridge', `Hiba az n8n workflow indításakor: ${normalized.message}`);
                return mcpError(`n8n hiba: ${normalized.message}`);
            }
        }
    );
}


