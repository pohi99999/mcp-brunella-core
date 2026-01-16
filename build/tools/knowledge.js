"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerKnowledgeTools = registerKnowledgeTools;
const zod_1 = require("zod");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
const rag_js_1 = require("../utils/rag.js");
const KNOWLEDGE_ROOTS = ['02_PROJECTS', '03_LIBRARY', '07_KNOWLEDGE_BASE'];
async function searchFiles(dir, pattern, results) {
    // ... (previous implementation remains for fallback)
    try {
        const files = await promises_1.default.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path_1.default.join(dir, file.name);
            if (index_js_1.config.denyContains.some(denied => fullPath.includes(denied)))
                continue;
            if (file.name.startsWith('.'))
                continue;
            if (file.name === 'node_modules')
                continue;
            if (file.isDirectory()) {
                await searchFiles(fullPath, pattern, results);
            }
            else {
                try {
                    const stats = await promises_1.default.stat(fullPath);
                    if (stats.size > index_js_1.config.maxFileBytesForSearch)
                        continue;
                    const content = await promises_1.default.readFile(fullPath, 'utf-8');
                    if (content.toLowerCase().includes(pattern.toLowerCase())) {
                        results.push(fullPath);
                    }
                }
                catch (e) { }
            }
        }
    }
    catch (e) { }
}
function registerKnowledgeTools(server) {
    // Legacy exact match search
    server.tool("knowledge_search", "Searches for a text pattern (exact match).", {
        pattern: zod_1.z.string().describe("Text to search for"),
    }, async ({ pattern }) => {
        const results = [];
        for (const rootName of KNOWLEDGE_ROOTS) {
            const rootPath = path_1.default.join(index_js_1.config.workspaceRoot, rootName);
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
    });
    // New Semantic Search
    server.tool("knowledge_semantic_search", "Searches for meaning/concepts using RAG (Vector DB). Requires indexed files.", {
        query: zod_1.z.string().describe("The concept to search for"),
    }, async ({ query }) => {
        try {
            const results = await (0, rag_js_1.searchRAG)(query);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(results, null, 2)
                    }]
            };
        }
        catch (e) {
            return {
                isError: true,
                content: [{ type: "text", text: `RAG Error: ${e.message}` }]
            };
        }
    });
    // Indexing Tool
    server.tool("knowledge_index_file", "Adds a file to the semantic search index.", {
        file_path: zod_1.z.string(),
    }, async ({ file_path }) => {
        const fullPath = path_1.default.resolve(index_js_1.config.workspaceRoot, file_path);
        try {
            const content = await promises_1.default.readFile(fullPath, 'utf-8');
            await (0, rag_js_1.addToIndex)(file_path, content);
            return {
                content: [{ type: "text", text: `Indexed: ${file_path}` }]
            };
        }
        catch (e) {
            return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
        }
    });
    server.tool("knowledge_read_context", "Reads multiple files to build context for LLMs.", {
        file_paths: zod_1.z.array(zod_1.z.string()),
    }, async ({ file_paths }) => {
        let context = "";
        for (const filePath of file_paths) {
            const fullPath = path_1.default.resolve(index_js_1.config.workspaceRoot, filePath);
            if (!fullPath.startsWith(index_js_1.config.workspaceRoot))
                continue;
            try {
                const content = await promises_1.default.readFile(fullPath, 'utf-8');
                context += `\n--- FILE: ${filePath} ---\n${content}\n`;
            }
            catch (e) { }
        }
        return {
            content: [{ type: "text", text: context }]
        };
    });
}
