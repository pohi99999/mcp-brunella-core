import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logInfo, logError } from "../utils/logger.js";
import { mcpError, mcpOk } from "../utils/mcpResponse.js";
import { ensureError } from "../utils/ensureError.js";

/**
 * Super-Bridge Tool az n8n munkafolyamatok indításához
 */
export function registerN8nTools(server: McpServer) {
    server.tool(
        "n8n_trigger_workflow",
        "Indít egy n8n munkafolyamatot a megadott adatokkal.",
        {
            workflowId: z.string().describe("Az n8n munkafolyamat egyedi azonosítója vagy slug-ja"),
            data: z.record(z.any()).optional().describe("A munkafolyamatnak átadandó JSON adatok")
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

            logInfo('N8nBridge', `Workflow indítása: ${workflowId}`);

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
                return mcpOk(result, `Sikeres n8n hívás! Eredmény: ${JSON.stringify(result, null, 2)}`);
            } catch (error: unknown) {
                const normalized = ensureError(error);
                logError('N8nBridge', `Hiba: ${normalized.message}`);
                return mcpError(`Nem sikerült indítani az n8n workflow-t: ${normalized.message}`);
            }
        }
    );
}
