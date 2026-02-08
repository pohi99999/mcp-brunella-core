// FILE: src/utils/rag.ts
// PURPOSE: Zone II: Hibrid memória rendszer (LanceDB) valós idejű íráshoz Node.js-ben.
// Zone IV: Dual Storage (LanceDB + JSONL backup).
// Zone V: Vector Embeddings via Ollama nomic-embed-text model.

import * as lancedb from "@lancedb/lancedb";
import fs from "fs/promises";
import path from "path";
import { logInfo, logError } from "./logger.js";

const DB_PATH = "./data/brunella_lancedb";
const HARVEST_BACKUP_PATH = "./logs/harvest_backup.jsonl";

// Ollama embedding configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";
const EMBEDDING_DIMENSION = 768; // nomic-embed-text uses 768 dimensions
const EMBEDDING_TIMEOUT_MS = 30000;

/**
 * Get embedding vector from Ollama API
 * Uses nomic-embed-text model by default (768 dimensions)
 */
async function getEmbedding(text: string): Promise<number[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text.slice(0, 8000), // Limit text length for embedding
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.status}`);
    }

    const data = await response.json() as { embedding?: number[] };
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Invalid embedding response from Ollama");
    }

    return data.embedding;
  } catch (error: any) {
    if (error.name === "AbortError") {
      logError("RAG", `Embedding timeout after ${EMBEDDING_TIMEOUT_MS}ms`);
    } else {
      logError("RAG", `Embedding error: ${error.message}`);
    }
    // Return zero vector as fallback (will still store the text)
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }
}

export class HybridMemory {
  private dbPath = DB_PATH;

  async addDocument(content: string, metadata: object) {
    const db = await lancedb.connect(this.dbPath);
    const tableNames = await db.tableNames();

    // Generate embedding for the content
    const vector = await getEmbedding(content);
    const record = { vector, text: content, ...metadata, createdAt: new Date().toISOString() };

    let table;
    if (tableNames.includes("memory")) {
      table = await db.openTable("memory");
      await table.add([record]);
    } else {
      // Create table with first record (defines schema)
      table = await db.createTable("memory", [record]);
    }

    logInfo("RAG", `Document indexed: ${(metadata as any).path || "unknown"}`);
  }

  async getTableCount(): Promise<number> {
    try {
      const db = await lancedb.connect(this.dbPath);
      const tableNames = await db.tableNames();
      if (!tableNames.includes("memory")) return 0;
      const table = await db.openTable("memory");
      return await table.countRows();
    } catch (e) {
      return 0;
    }
  }
}

const memory = new HybridMemory();

/** Add content to the RAG index (path/id stored in metadata). */
export async function addToIndex(pathOrId: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true }).catch(() => { });
  await memory.addDocument(content, { path: pathOrId });
}

/** Get total number of records in the RAG index. */
export async function getRAGCount(): Promise<number> {
  return await memory.getTableCount();
}

/** Search RAG using vector similarity (cosine distance via LanceDB). */
export async function searchRAG(query: string, limit = 20): Promise<Array<{ text: string; path?: string; score?: number }>> {
  try {
    const db = await lancedb.connect(DB_PATH);
    const tableNames = await db.tableNames();
    if (!tableNames.includes("memory")) return [];

    const table = await db.openTable("memory");

    // Generate embedding for the query
    const queryVector = await getEmbedding(query);

    // Check if we got a valid embedding (not all zeros)
    const hasValidEmbedding = queryVector.some((v) => v !== 0);

    if (hasValidEmbedding) {
      // Vector similarity search
      const results = await table
        .vectorSearch(queryVector)
        .limit(limit)
        .toArray();

      return results.map((r: any) => ({
        text: r.text || "",
        path: r.path,
        score: r._distance, // LanceDB returns distance (lower = more similar)
      }));
    } else {
      // Fallback to text search if embedding failed
      logInfo("RAG", "Embedding failed, falling back to text search");
      const results: Array<{ text: string; path?: string }> = [];
      const q = query.toLowerCase();

      for await (const batch of table.query().limit(limit * 3)) {
        const textCol = batch.getChild("text");
        const pathCol = batch.schema.fields.find((f) => f.name === "path") ? batch.getChild("path") : null;
        const n = batch.numRows;
        for (let i = 0; i < n; i++) {
          const text = String(textCol?.get(i) ?? "");
          if (text.toLowerCase().includes(q)) {
            results.push({ text, path: pathCol ? String(pathCol.get(i) ?? "") : undefined });
            if (results.length >= limit) return results;
          }
        }
      }
      return results;
    }
  } catch (error: any) {
    logError("RAG", `Search error: ${error.message}`);
    return [];
  }
}

/** Zone IV: Dual Storage – LanceDB + JSONL backup (antifragilitás). */
export class DualStorageManager {
  private backupPath = HARVEST_BACKUP_PATH;
  private dbPath = DB_PATH;

  async saveWithBackup(table: string, data: Record<string, unknown>): Promise<void> {
    const entry = { ...data, savedAt: new Date().toISOString(), table };
    const line = JSON.stringify(entry) + "\n";

    // 1. JSONL backup (biztonsági mentés)
    await fs.mkdir(path.dirname(this.backupPath), { recursive: true }).catch(() => { });
    await fs.appendFile(this.backupPath, line, "utf-8").catch((e) => {
      console.warn(`[DualStorage] Backup write failed: ${e.message}`);
    });

    // 2. LanceDB (ha van text mező)
    const text = (data.text as string) ?? JSON.stringify(data);
    await addToIndex((data.path as string) ?? `harvest_${Date.now()}`, text);
  }
}