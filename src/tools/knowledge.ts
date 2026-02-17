import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { searchRAG, addToIndex } from '../utils/rag.js';

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
                    } catch (e) { /* non-critical */ }      }
    }
  } catch (e) { /* non-critical */ }
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
      for (const rootName of KNOWLEDGE_ROOTS) {
          const rootPath = path.join(config.workspaceRoot, rootName);
          await searchFiles(rootPath, pattern, results);
      }
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
        } catch (e: any) {
            return {
                isError: true,
                content: [{ type: "text", text: `RAG Error: ${e.message}` }]
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
        } catch (e: any) {
            return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
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
        for (const filePath of file_paths) {
            const fullPath = path.resolve(config.workspaceRoot, filePath);
            if (!fullPath.startsWith(config.workspaceRoot)) continue;
            try {
                const content = await fs.readFile(fullPath, 'utf-8');
                context += `\n--- FILE: ${filePath} ---\n${content}\n`;
            } catch (e) { /* non-critical */ }
        }
        return {
            content: [{ type: "text", text: context }]
        };
    }
  );
}
