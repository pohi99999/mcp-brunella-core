// FILE: src/utils/rag.ts
// PURPOSE: Zone II: Hibrid memória rendszer (LanceDB) valós idejű íráshoz Node.js-ben.
// Zone IV: Dual Storage (LanceDB + JSONL backup).
// Zone V: Vector Embeddings via Ollama nomic-embed-text model.

import * as lancedb from "@lancedb/lancedb";
import fs from "fs/promises";
import path from "path";
import { logInfo, logError, logWarn } from "./logger.js";
import { aiGateway } from "./aiGateway.js";

const DB_PATH = "./data/brunella_lancedb";
const HARVEST_BACKUP_PATH = "./logs/harvest_backup.jsonl";

// Ollama embedding configuration (dual-index transition)
const PRIMARY_EMBEDDING_MODEL =
  process.env.RAG_EMBEDDING_MODEL_PRIMARY ||
  process.env.EMBEDDING_MODEL ||
  "mxbai-embed-large";
const PRIMARY_EMBEDDING_DIMENSION = Number(
  process.env.RAG_EMBEDDING_DIM_PRIMARY || 1024,
);
const LEGACY_EMBEDDING_MODEL =
  process.env.RAG_EMBEDDING_MODEL_LEGACY || "nomic-embed-text";
const LEGACY_EMBEDDING_DIMENSION = Number(
  process.env.RAG_EMBEDDING_DIM_LEGACY || 768,
);
const DUAL_INDEX_WRITE_ENABLED =
  (process.env.RAG_DUAL_INDEX_WRITE || "true").toLowerCase() === "true";
const PRIMARY_TABLE = process.env.RAG_PRIMARY_TABLE || "memory_v2_mxbai";
const LEGACY_TABLE = process.env.RAG_LEGACY_TABLE || "memory";

type EmbeddingConfig = {
  model: string;
  dimension: number;
  tableName: string;
};

const PRIMARY_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: PRIMARY_EMBEDDING_MODEL,
  dimension: PRIMARY_EMBEDDING_DIMENSION,
  tableName: PRIMARY_TABLE,
};

const LEGACY_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: LEGACY_EMBEDDING_MODEL,
  dimension: LEGACY_EMBEDDING_DIMENSION,
  tableName: LEGACY_TABLE,
};

const ZERO_VECTOR_RATIO_THRESHOLD = 0.95;

function zeroVector(size: number): number[] {
  return new Array(size).fill(0);
}

function normalizeEmbedding(
  raw: number[] | null | undefined,
  expectedDimension: number,
): number[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return zeroVector(expectedDimension);
  }

  if (raw.length === expectedDimension) {
    return raw;
  }

  if (raw.length > expectedDimension) {
    return raw.slice(0, expectedDimension);
  }

  return [...raw, ...zeroVector(expectedDimension - raw.length)];
}

function isMostlyZeroVector(vector: number[]): boolean {
  if (!vector.length) return true;
  const zeroCount = vector.filter((v) => v === 0).length;
  return zeroCount / vector.length >= ZERO_VECTOR_RATIO_THRESHOLD;
}

/**
 * Get embedding vector from Ollama API (via AI Gateway if enabled)
 * Uses configurable embedding model and enforces expected vector dimension.
 */
async function getEmbedding(
  text: string,
  config: EmbeddingConfig,
): Promise<number[]> {
  try {
    const rawEmbedding = await aiGateway.embeddings(text.slice(0, 8000), {
      model: config.model,
      expectedDimension: config.dimension,
    });

    return normalizeEmbedding(rawEmbedding, config.dimension);
  } catch (error: any) {
    logError("RAG", `Embedding error (${config.model}): ${error.message}`);
    return zeroVector(config.dimension);
  }
}

export class HybridMemory {
  private dbPath: string;

  constructor(dbPath: string = DB_PATH) {
    this.dbPath = dbPath;
  }

  private async addDocumentToTable(
    db: lancedb.Connection,
    tableNames: string[],
    tableName: string,
    record: Record<string, unknown>,
  ): Promise<void> {
    if (tableNames.includes(tableName)) {
      const table = await db.openTable(tableName);
      await table.add([record]);
      return;
    }

    await db.createTable(tableName, [record]);
  }

  private async searchTable(
    db: lancedb.Connection,
    tableName: string,
    query: string,
    limit: number,
    config: EmbeddingConfig,
  ): Promise<Array<{ text: string; path?: string; score?: number }>> {
    const table = await db.openTable(tableName);
    const queryVector = await getEmbedding(query, config);

    if (!isMostlyZeroVector(queryVector)) {
      const results = await table
        .vectorSearch(queryVector)
        .limit(limit)
        .toArray();

      return results.map((r: any) => ({
        text: r.text || "",
        path: r.path,
        score: r._distance,
      }));
    }

    logInfo(
      "RAG",
      `Embedding unavailable for ${config.model}, using text fallback on ${tableName}`,
    );
    const results: Array<{ text: string; path?: string }> = [];
    const q = query.toLowerCase();

    for await (const batch of table.query().limit(limit * 3)) {
      const textCol = batch.getChild("text");
      const pathCol = batch.schema.fields.find((f) => f.name === "path")
        ? batch.getChild("path")
        : null;
      const n = batch.numRows;
      for (let i = 0; i < n; i++) {
        const text = String(textCol?.get(i) ?? "");
        if (text.toLowerCase().includes(q)) {
          results.push({
            text,
            path: pathCol ? String(pathCol.get(i) ?? "") : undefined,
          });
          if (results.length >= limit) return results;
        }
      }
    }

    return results;
  }

  async addDocument(content: string, metadata: object) {
    const db = await lancedb.connect(this.dbPath);
    const tableNames = await db.tableNames();

    const createdAt = new Date().toISOString();
    const primaryVector = await getEmbedding(content, PRIMARY_EMBEDDING_CONFIG);

    await this.addDocumentToTable(
      db,
      tableNames,
      PRIMARY_EMBEDDING_CONFIG.tableName,
      {
        vector: primaryVector,
        text: content,
        embeddingModel: PRIMARY_EMBEDDING_CONFIG.model,
        embeddingDimension: PRIMARY_EMBEDDING_CONFIG.dimension,
        ...metadata,
        createdAt,
      },
    );

    if (DUAL_INDEX_WRITE_ENABLED) {
      const legacyVector = await getEmbedding(content, LEGACY_EMBEDDING_CONFIG);
      await this.addDocumentToTable(
        db,
        tableNames,
        LEGACY_EMBEDDING_CONFIG.tableName,
        {
          vector: legacyVector,
          text: content,
          embeddingModel: LEGACY_EMBEDDING_CONFIG.model,
          embeddingDimension: LEGACY_EMBEDDING_CONFIG.dimension,
          ...metadata,
          createdAt,
        },
      );
    }

    logInfo("RAG", `Document indexed: ${(metadata as any).path || "unknown"}`);
  }

  async getTableCount(): Promise<number> {
    try {
      const db = await lancedb.connect(this.dbPath);
      const tableNames = await db.tableNames();

      const selectedTable = tableNames.includes(
        PRIMARY_EMBEDDING_CONFIG.tableName,
      )
        ? PRIMARY_EMBEDDING_CONFIG.tableName
        : LEGACY_EMBEDDING_CONFIG.tableName;

      if (!tableNames.includes(selectedTable)) return 0;

      const table = await db.openTable(selectedTable);
      return await table.countRows();
    } catch (e) {
      return 0;
    }
  }

  async search(
    query: string,
    limit = 20,
  ): Promise<Array<{ text: string; path?: string; score?: number }>> {
    try {
      const db = await lancedb.connect(this.dbPath);
      const tableNames = await db.tableNames();
      if (tableNames.length === 0) return [];

      if (tableNames.includes(PRIMARY_EMBEDDING_CONFIG.tableName)) {
        const primaryResults = await this.searchTable(
          db,
          PRIMARY_EMBEDDING_CONFIG.tableName,
          query,
          limit,
          PRIMARY_EMBEDDING_CONFIG,
        );

        if (primaryResults.length > 0) {
          return primaryResults;
        }
      }

      if (tableNames.includes(LEGACY_EMBEDDING_CONFIG.tableName)) {
        logInfo(
          "RAG",
          `Primary index empty, falling back to legacy index (${LEGACY_EMBEDDING_CONFIG.tableName})`,
        );
        return await this.searchTable(
          db,
          LEGACY_EMBEDDING_CONFIG.tableName,
          query,
          limit,
          LEGACY_EMBEDDING_CONFIG,
        );
      }

      return [];
    } catch (error: any) {
      logError("RAG", `Search error: ${error.message}`);
      return [];
    }
  }
}

const memory = new HybridMemory();

/** Add content to the RAG index (path/id stored in metadata). */
export async function addToIndex(
  pathOrId: string,
  content: string,
): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true }).catch(() => {});
  await memory.addDocument(content, { path: pathOrId });
}

/** Get total number of records in the RAG index. */
export async function getRAGCount(): Promise<number> {
  return await memory.getTableCount();
}

/** Search RAG using vector similarity (cosine distance via LanceDB). */
export async function searchRAG(
  query: string,
  limit = 20,
): Promise<Array<{ text: string; path?: string; score?: number }>> {
  return await memory.search(query, limit);
}

/** Zone IV: Dual Storage – LanceDB + JSONL backup (antifragilitás). */
export class DualStorageManager {
  private backupPath = HARVEST_BACKUP_PATH;
  private dbPath = DB_PATH;

  async saveWithBackup(
    table: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const entry = { ...data, savedAt: new Date().toISOString(), table };
    const line = JSON.stringify(entry) + "\n";

    // 1. JSONL backup (biztonsági mentés)
    await fs
      .mkdir(path.dirname(this.backupPath), { recursive: true })
      .catch(() => {});
    await fs.appendFile(this.backupPath, line, "utf-8").catch((e) => {
      logWarn("RAG", `Backup write failed: ${e.message}`);
    });

    // 2. LanceDB (ha van text mező)
    const text = (data.text as string) ?? JSON.stringify(data);
    await addToIndex((data.path as string) ?? `harvest_${Date.now()}`, text);
  }
}
