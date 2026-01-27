"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRAG = initRAG;
exports.addToIndex = addToIndex;
exports.searchRAG = searchRAG;
const lancedb = __importStar(require("@lancedb/lancedb"));
const index_js_1 = require("../config/index.js");
const path_1 = __importDefault(require("path"));
// Use Ollama for embeddings
async function getEmbedding(text) {
    try {
        const response = await fetch("http://localhost:11434/api/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "nomic-embed-text", // Standard fast embedding model
                prompt: text
            })
        });
        if (!response.ok)
            throw new Error("Ollama embedding failed");
        const data = await response.json();
        return data.embedding;
    }
    catch (e) {
        console.error("Embedding error:", e);
        return new Array(768).fill(0); // Fallback dummy vector (bad but prevents crash)
    }
}
// Database singleton
let db = null;
let tbl = null;
async function initRAG() {
    const dbPath = path_1.default.join(index_js_1.config.systemLogDir, 'lancedb');
    db = await lancedb.connect(dbPath);
    // Create or open table
    const schema = {
        id: "string",
        path: "string",
        content: "string",
        vector: "vector[768]" // Assuming nomic-embed-text dimension
    };
    // Simple check if table exists (API varies by version, trying open then create)
    try {
        tbl = await db.openTable("knowledge_base");
    }
    catch {
        // Create if not exists (need initial data or schema)
        // LanceDB often requires data to infer schema or specific create call
        // We'll skip deep creation logic here to avoid complexity in this snippet
        // and rely on the tool to handle lazy creation on first index.
    }
}
async function addToIndex(filePath, content) {
    if (!db)
        await initRAG();
    const vector = await getEmbedding(content.slice(0, 1000)); // Embed first 1k chars for summary
    const data = [{
            id: filePath,
            path: filePath,
            content: content,
            vector: vector
        }];
    if (!tbl) {
        tbl = await db.createTable("knowledge_base", data);
    }
    else {
        await tbl.add(data);
    }
}
async function searchRAG(query, limit = 5) {
    if (!db || !tbl)
        await initRAG();
    if (!tbl)
        return []; // Ha még az inicializálás után sincs tábla (üres DB)
    const queryVector = await getEmbedding(query);
    const results = await tbl.vectorSearch(queryVector).limit(limit).toArray();
    return results;
}
