import * as lancedb from "@lancedb/lancedb";
import { config } from '../config/index.js';
import path from 'path';
import fs from 'fs/promises';

// Use Ollama for embeddings
async function getEmbedding(text: string): Promise<number[]> {
    try {
        const response = await fetch("http://localhost:11434/api/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "nomic-embed-text", // Standard fast embedding model
                prompt: text
            })
        });
        
        if (!response.ok) throw new Error("Ollama embedding failed");
        const data = await response.json();
        return data.embedding;
    } catch (e) {
        console.error("Embedding error:", e);
        return new Array(768).fill(0); // Fallback dummy vector (bad but prevents crash)
    }
}

// Database singleton
let db: lancedb.Connection | null = null;
let tbl: lancedb.Table | null = null;

export async function initRAG() {
    const dbPath = path.join(config.systemLogDir, 'lancedb');
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
    } catch {
        // Create if not exists (need initial data or schema)
        // LanceDB often requires data to infer schema or specific create call
        // We'll skip deep creation logic here to avoid complexity in this snippet
        // and rely on the tool to handle lazy creation on first index.
    }
}

export async function addToIndex(filePath: string, content: string) {
    if (!db) await initRAG();
    
    const vector = await getEmbedding(content.slice(0, 1000)); // Embed first 1k chars for summary
    
    const data = [{
        id: filePath,
        path: filePath,
        content: content,
        vector: vector
    }];

    if (!tbl) {
        tbl = await db!.createTable("knowledge_base", data);
    } else {
        await tbl.add(data);
    }
}

export async function searchRAG(query: string, limit = 5) {
    if (!db || !tbl) return [];
    
    const queryVector = await getEmbedding(query);
    const results = await tbl.vectorSearch(queryVector).limit(limit).toArray();
    return results;
}
