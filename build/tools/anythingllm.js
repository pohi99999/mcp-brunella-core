"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnythingLLMTools = registerAnythingLLMTools;
const zod_1 = require("zod");
const index_js_1 = require("../config/index.js");
function getBaseUrl() {
    return index_js_1.config.anythingllmBaseUrl.replace(/\/$/, "");
}
async function requestAnythingLLM(path, options = {}) {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}${path}`;
    const headers = {
        "Content-Type": "application/json"
    };
    if (index_js_1.config.anythingllmApiKey) {
        headers.Authorization = `Bearer ${index_js_1.config.anythingllmApiKey}`;
        headers["X-AnythingLLM-Api-Key"] = index_js_1.config.anythingllmApiKey;
    }
    const response = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    let data = text;
    try {
        data = text ? JSON.parse(text) : null;
    }
    catch {
        // keep raw text
    }
    if (!response.ok) {
        const message = typeof data === "string" ? data : JSON.stringify(data);
        throw new Error(`AnythingLLM error (${response.status}): ${message}`);
    }
    return data;
}
function registerAnythingLLMTools(server) {
    server.tool("anythingllm_list_workspaces", "Lists available AnythingLLM workspaces.", {}, async () => {
        try {
            const data = await requestAnythingLLM("/api/v1/workspaces");
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: error.message }]
            };
        }
    });
    server.tool("anythingllm_chat", "Sends a chat message to an AnythingLLM workspace.", {
        message: zod_1.z.string().describe("User message to send"),
        workspace: zod_1.z.string().optional().describe("Workspace slug (optional)")
    }, async ({ message, workspace }) => {
        const workspaceSlug = workspace || index_js_1.config.anythingllmWorkspace;
        if (!workspaceSlug) {
            return {
                isError: true,
                content: [{ type: "text", text: "Workspace not set. Provide 'workspace' or set ANYTHINGLLM_WORKSPACE." }]
            };
        }
        try {
            const data = await requestAnythingLLM(`/api/v1/workspace/${workspaceSlug}/chat`, {
                method: "POST",
                body: JSON.stringify({ message })
            });
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: error.message }]
            };
        }
    });
}
