import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from '../config/index.js';
import { searchRAG, addToIndex } from '../utils/rag.js';

// Dynamic imports for Node.js modules
let fs: typeof import('fs/promises') | null = null;
let path: typeof import('path') | null = null;

async function ensureModules() {
    if (typeof process !== 'undefined' && process.versions?.node) {
        if (!fs) fs = (await import('fs/promises')).default || await import('fs/promises');
        if (!path) path = (await import('path')).default || await import('path');
    }
}

export async function registerKnowledgeTools(server: McpServer) {
  await ensureModules();

  server.tool(
    "knowledge_search",
    "Searches the knowledge base using semantic search (RAG).",
    {
      query: z.string().describe("The search query"),
      limit: z.number().optional().default(5).describe("Number of results to return"),
    },
    async ({ query, limit }) => {
      try {
        const results = await searchRAG(query, limit);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error searching knowledge base: ${error.message}`
          }]
        };
      }
    }
  );

  server.tool(
    "knowledge_add",
    "Adds a document or note to the knowledge base.",
    {
      content: z.string().describe("The content to add"),
      metadata: z.object({
        source: z.string().optional(),
        tags: z.array(z.string()).optional()
      }).optional(),
    },
    async ({ content, metadata }) => {
      try {
        await addToIndex(content, metadata || {});

        // Save to file as backup if fs is available
        if (fs && path) {
            const filename = `note-${Date.now()}.md`;
            const filepath = path.join(config.workspaceRoot, '_KNOWLEDGE_BASE', 'notes', filename);
            await fs.writeFile(filepath, content);
        }

        return {
          content: [{
            type: "text",
            text: "Successfully added to knowledge base."
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error adding to knowledge base: ${error.message}`
          }]
        };
      }
    }
  );
}
