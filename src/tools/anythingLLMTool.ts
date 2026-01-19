/**
 * AnythingLLM Tool
 * 
 * MCP tool for interacting with AnythingLLM
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAnythingLLMAdapter, testAnythingLLMConnection } from '../adapters/anythingLLM.js';

export function registerAnythingLLMTool(server: McpServer) {
  
  // Test connection tool
  server.tool(
    "anythingllm_test_connection",
    "Test connection to AnythingLLM API",
    {},
    async () => {
      const adapter = createAnythingLLMAdapter();
      
      if (!adapter) {
        return {
          content: [{
            type: "text",
            text: "AnythingLLM not configured. Set ANYTHINGLLM_API_KEY environment variable."
          }]
        };
      }

      const result = await adapter.testConnection();
      
      return {
        content: [{
          type: "text",
          text: result.success ? `✓ ${result.message}` : `✗ ${result.message}`
        }]
      };
    }
  );

  // Chat tool
  server.tool(
    "anythingllm_chat",
    "Send a message to AnythingLLM workspace and get response",
    {
      workspace: z.string().describe("Workspace slug"),
      message: z.string().describe("Message to send"),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string()
      })).optional().describe("Chat history")
    },
    async ({ workspace, message, history }) => {
      const adapter = createAnythingLLMAdapter();
      
      if (!adapter) {
        throw new Error("AnythingLLM not configured");
      }

      const result = await adapter.chat(workspace, message, history);
      
      if (result.error) {
        throw new Error(result.error);
      }

      return {
        content: [{
          type: "text",
          text: result.response
        }]
      };
    }
  );

  // List workspaces tool
  server.tool(
    "anythingllm_list_workspaces",
    "List available AnythingLLM workspaces",
    {},
    async () => {
      const adapter = createAnythingLLMAdapter();
      
      if (!adapter) {
        throw new Error("AnythingLLM not configured");
      }

      const workspaces = await adapter.listWorkspaces();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(workspaces, null, 2)
        }]
      };
    }
  );

  // Create workspace tool
  server.tool(
    "anythingllm_create_workspace",
    "Create a new AnythingLLM workspace",
    {
      name: z.string().describe("Workspace name")
    },
    async ({ name }) => {
      const adapter = createAnythingLLMAdapter();
      
      if (!adapter) {
        throw new Error("AnythingLLM not configured");
      }

      const result = await adapter.createWorkspace(name);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to create workspace");
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result.workspace, null, 2)
        }]
      };
    }
  );

  // Upload document tool
  server.tool(
    "anythingllm_upload_document",
    "Upload a document to AnythingLLM workspace",
    {
      workspace: z.string().describe("Workspace slug"),
      content: z.string().describe("Document content"),
      filename: z.string().describe("Filename")
    },
    async ({ workspace, content, filename }) => {
      const adapter = createAnythingLLMAdapter();
      
      if (!adapter) {
        throw new Error("AnythingLLM not configured");
      }

      const result = await adapter.uploadDocument(workspace, content, filename);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to upload document");
      }

      return {
        content: [{
          type: "text",
          text: result.message || "Document uploaded successfully"
        }]
      };
    }
  );

  // Query documents tool
  server.tool(
    "anythingllm_query_documents",
    "Query documents in AnythingLLM workspace",
    {
      workspace: z.string().describe("Workspace slug"),
      query: z.string().describe("Search query")
    },
    async ({ workspace, query }) => {
      const adapter = createAnythingLLMAdapter();
      
      if (!adapter) {
        throw new Error("AnythingLLM not configured");
      }

      const result = await adapter.queryDocuments(workspace, query);
      
      if (result.error) {
        throw new Error(result.error);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result.results, null, 2)
        }]
      };
    }
  );

  // Get system info tool
  server.tool(
    "anythingllm_system_info",
    "Get AnythingLLM system information",
    {},
    async () => {
      const adapter = createAnythingLLMAdapter();
      
      if (!adapter) {
        throw new Error("AnythingLLM not configured");
      }

      const info = await adapter.getSystemInfo();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(info, null, 2)
        }]
      };
    }
  );
}
