import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { searchRAG, addToIndex } from '../utils/rag.js';
import { logDebug } from '../utils/logger.js';

const KNOWLEDGE_ROOTS = ['02_PROJECTS', '03_LIBRARY', '07_KNOWLEDGE_BASE'];

async function searchFiles(dir: string, pattern: string, results: string[]) {
  // ... (previous implementation remains for fallback)
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (config.denyContains.some(denied => fullPath.includes(denied))) continue;
      if (file.name.startsWith('.')) continue;
      if (file.name === 'node_modules') continue;

      if (file.isDirectory()) {
        await searchFiles(fullPath, pattern, results);
      } else {
        try {
          const stats = await fs.stat(fullPath);
          if (stats.size > config.maxFileBytesForSearch) continue;
          const content = await fs.readFile(fullPath, 'utf-8');
          if (content.toLowerCase().includes(pattern.toLowerCase())) {
            results.push(fullPath);
          }
        } catch (error: unknown) {
          // Non-critical: file read errors during search are expected for locked/inaccessible files
          const err = error instanceof Error ? error : new Error(String(error));
          logDebug('knowledge_search', `Skipped file ${fullPath}: ${err.message}`);
        }
      }
    }
  } catch (error: unknown) {
    // Non-critical: directory read errors during search are expected
    const err = error instanceof Error ? error : new Error(String(error));
    logDebug('searchFiles', `Skipped directory ${dir}: ${err.message}`);
  }
}

export function registerKnowledgeTools(server: McpServer) {
  
  // Legacy exact match search
  server.tool(
    "knowledge_search",
    "Searches for a text pattern (exact match).",
    {
      pattern: z.string().describe("Text to search for"),
    },
    async ({ pattern }) => {
      const results: string[] = [];
      await Promise.all(
        KNOWLEDGE_ROOTS.map(async (rootName) => {
          const rootPath = path.join(config.workspaceRoot, rootName);
          await searchFiles(rootPath, pattern, results);
        })
      );
      const limitedResults = results.slice(0, 50);
      return {
        content: [{
          type: "text",
          text: limitedResults.length > 0 
            ? `Found "${pattern}" in:\n` + limitedResults.join('\n')
            : `No matches found for "${pattern}".`
        }]
      };
    }
  );

  // New Semantic Search
  server.tool(
    "knowledge_semantic_search",
    "Searches for meaning/concepts using RAG (Vector DB). Requires indexed files.",
    {
      query: z.string().describe("The concept to search for"),
    },
    async ({ query }) => {
        try {
            const results = await searchRAG(query);
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(results, null, 2)
                }]
            };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            return {
                isError: true,
                content: [{ type: "text", text: `RAG Error: ${err.message}` }]
            };
        }
    }
  );

  // Indexing Tool
  server.tool(
    "knowledge_index_file",
    "Adds a file to the semantic search index.",
    {
        file_path: z.string(),
    },
    async ({ file_path }) => {
        const fullPath = path.resolve(config.workspaceRoot, file_path);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            await addToIndex(file_path, content);
            return {
                content: [{ type: "text", text: `Indexed: ${file_path}` }]
            };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
        }
    }
  );

  server.tool(
    "knowledge_read_context",
    "Reads multiple files to build context for LLMs.",
    {
        file_paths: z.array(z.string()),
    },
    async ({ file_paths }) => {
        let context = "";
        const readPromises = file_paths.map(async (filePath) => {
            const fullPath = path.resolve(config.workspaceRoot, filePath);
            if (!fullPath.startsWith(config.workspaceRoot)) return null;
            try {
                const content = await fs.readFile(fullPath, 'utf-8');
                return `\n--- FILE: ${filePath} ---\n${content}\n`;
            } catch (error: unknown) {
                // Non-critical: file read errors during context building are expected
                const err = error instanceof Error ? error : new Error(String(error));
                logDebug('knowledge_read_context', `Skipped file ${filePath}: ${err.message}`);
                return null;
            }
        });

        const results = await Promise.allSettled(readPromises);
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value !== null) {
                context += result.value;
            }
        }
        return {
            content: [{ type: "text", text: context }]
        };
    }
  );
}
