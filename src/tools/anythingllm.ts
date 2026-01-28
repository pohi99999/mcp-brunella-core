import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../config/index.js";

function getBaseUrl() {
  return config.anythingllmBaseUrl.replace(/\/$/, "");
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
  } catch {
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
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }]
        };
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

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }]
        };
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