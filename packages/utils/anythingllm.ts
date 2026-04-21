import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@packages/utils/index.js";
import { mcpError, mcpOk } from "@packages/utils/mcpResponse.js";
import { ensureError } from "@packages/utils/ensureError.js";
import { logDebug } from "@packages/utils/logger.js";

function getBaseUrl() {
  return config.anythingllmBaseUrl.trim().replace(/\/$/, "");
}

async function requestAnythingLLM(path: string, options: RequestInit = {}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (config.anythingllmApiKey) {
    headers.Authorization = `Bearer ${config.anythingllmApiKey}`;
    headers["X-AnythingLLM-Api-Key"] = config.anythingllmApiKey;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error: unknown) {
    logDebug("AnythingLLM response parse fallback", ensureError(error));
    // keep raw text
  }

  if (!response.ok) {
    const message = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`AnythingLLM error (${response.status}): ${message}`);
  }

  return data;
}

export function registerAnythingLLMTools(server: McpServer) {
  server.tool(
    "anythingllm_list_workspaces",
    "Lists available AnythingLLM workspaces.",
    {},
    async () => {
      try {
        const data = await requestAnythingLLM("/api/v1/workspaces");
        return mcpOk(data);
      } catch (error: unknown) {
        const normalized = ensureError(error);
        return mcpError(normalized.message);
      }
    }
  );

  server.tool(
    "anythingllm_chat",
    "Sends a chat message to an AnythingLLM workspace.",
    {
      message: z.string().describe("User message to send"),
      workspace: z.string().optional().describe("Workspace slug (optional)")
    },
    async ({ message, workspace }) => {
      const workspaceSlug = workspace || config.anythingllmWorkspace;
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

        return mcpOk(data);
      } catch (error: unknown) {
        const normalized = ensureError(error);
        return mcpError(normalized.message);
      }
    }
  );
}

export async function listAnythingLLMWorkspaces() {
  return await requestAnythingLLM("/api/v1/workspaces");
}

export async function chatAnythingLLM(message: string, workspace?: string) {
  const workspaceSlug = workspace || config.anythingllmWorkspace;
  if (!workspaceSlug) throw new Error("Workspace not set");
  return await requestAnythingLLM(`/api/v1/workspace/${workspaceSlug}/chat`, {
      method: "POST",
      body: JSON.stringify({ message })
  });
}

