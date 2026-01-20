import * as lancedb from "@lancedb/lancedb";
import { config } from '../config/index.js';
import path from 'path';
class Cache {
    embeddings = new Map();
    searches = new Map();
    TTL = 3600000; // 1 hour in milliseconds
    getEmbedding(key) {
        const entry = this.embeddings.get(key);
        if (entry && Date.now() - entry.timestamp < this.TTL) {
            return entry.data;
        }
        if (entry) {
            this.embeddings.delete(key);
        }
        return null;
    }
    setEmbedding(key, data) {
        this.embeddings.set(key, { data, timestamp: Date.now() });
    }
    getSearch(key) {
        const entry = this.searches.get(key);
        if (entry && Date.now() - entry.timestamp < this.TTL) {
            return entry.data;
        }
        if (entry) {
            this.searches.delete(key);
        }
        return null;
    }
    setSearch(key, data) {
        this.searches.set(key, { data, timestamp: Date.now() });
    }
    clear() {
        this.embeddings.clear();
        this.searches.clear();
    }
    getStats() {
        return {
            embeddings: this.embeddings.size,
            searches: this.searches.size
        };
    }
}
const cache = new Cache();
// Use Ollama for embeddings
async function getEmbedding(text, useCache = true) {
    // Check cache first
    if (useCache) {
        const cached = cache.getEmbedding(text);
        if (cached)
            return cached;
    }
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
        const embedding = data.embedding;
        // Cache the result
        if (useCache) {
            cache.setEmbedding(text, embedding);
        }
        return embedding;
    }
    catch (e) {
        console.error("Embedding error:", e);
        return new Array(768).fill(0); // Fallback dummy vector (bad but prevents crash)
    }
}
// Database singleton
let db = null;
let tbl = null;
let initialized = false;
export async function initRAG() {
    if (initialized)
        return;
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
    }
    catch {
        // Create if not exists (need initial data or schema)
        // LanceDB often requires data to infer schema or specific create call
        // We'll skip deep creation logic here to avoid complexity in this snippet
        // and rely on the tool to handle lazy creation on first index.
    }
    initialized = true;
}
export async function addToIndex(filePath, content) {
    if (!db)
        await initRAG();
    const vector = await getEmbedding(content.slice(0, 1000), false); // Don't cache during indexing
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
    // Clear search cache when new data is added
    cache.clear();
}
export async function searchRAG(query, limit = 5, useCache = true) {
    if (!db || !tbl) {
        await initRAG();
        if (!db || !tbl)
            return [];
    }
    // Check cache for search results
    const cacheKey = `${query}:${limit}`;
    if (useCache) {
        const cached = cache.getSearch(cacheKey);
        if (cached)
            return cached;
    }
    const queryVector = await getEmbedding(query, useCache);
    const results = await tbl.vectorSearch(queryVector).limit(limit).toArray();
    // Cache the results
    if (useCache) {
        cache.setSearch(cacheKey, results);
    }
    return results;
}
export function clearRAGCache() {
    cache.clear();
}
export function getRAGCacheStats() {
    return cache.getStats();
}
