import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logInfo, logError } from "../utils/logger.js";
import { mcpError, mcpOk } from "../utils/mcpResponse.js";
import { ensureError } from "../utils/ensureError.js";
import { agentManager } from "../agents/AgentManager.js";

// Local state map to hold background execution results for n8n
const n8nTaskState = new Map<string, { status: string; result?: unknown; error?: string }>();

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
            const baseUrl = process.env.N8N_BASE_URL || 'https://n8n-latest-fulv.onrender.com';
            const apiKey = process.env.N8N_API_KEY;

            if (!apiKey) {
                return {
                    isError: true,
                    content: [{ type: "text", text: "N8N_API_KEY nincs beállítva a környezeti változók között." }]
                };
            }

            const taskId = `n8n_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            logInfo('N8nBridge', `Workflow indítása (Fire-and-Forget): ${workflowId}, taskId: ${taskId}`);

            // Initialize local state
            n8nTaskState.set(taskId, { status: 'pending' });

            // Start execution in background
            Promise.resolve().then(async () => {
                try {
                    const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}/run`, {
                        method: 'POST',
                        headers: {
                            'X-N8N-API-KEY': apiKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data || {})
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`n8n hiba: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    n8nTaskState.set(taskId, { status: 'completed', result });
                } catch (error: unknown) {
                    const normalized = ensureError(error);
                    n8nTaskState.set(taskId, { status: 'error', error: normalized.message });
                }
            });

            // Start polling via AgentManager
            agentManager.pollExternalTask(
                taskId,
                "n8n",
                async () => {
                    const state = n8nTaskState.get(taskId);
                    if (!state) return { status: 'unknown' };
                    if (state.status !== 'pending') {
                        // Clean up state once it's done
                        n8nTaskState.delete(taskId);
                    }
                    return state;
                }
            );

            return mcpOk({ taskId, status: "pending" }, `n8n workflow elindítva a háttérben. Task ID: ${taskId}`);
        }
    );
}
