// FILE: src/utils/rag.ts
// PURPOSE: Zone II: Hibrid memória rendszer (LanceDB) valós idejű íráshoz Node.js-ben.
// Zone IV: Dual Storage (LanceDB + JSONL backup).
// Zone V: Vector Embeddings via Ollama nomic-embed-text model.

import fs from "fs/promises";
import path from "path";
import { logInfo, logError, logWarn } from "./logger.js";
import { aiGateway } from "./aiGateway.js";
import { vectorizeClient } from "./vectorize.js";

const DB_PATH = "./data/brunella_lancedb";
const HARVEST_BACKUP_PATH = "./logs/harvest_backup.jsonl";

type LanceRecord = Record<string, unknown>;

interface LanceQueryRowBatch {
  getChild(name: string): { get(index: number): unknown } | null;
  schema: { fields: Array<{ name?: string }> };
  numRows: number;
}

interface LanceQueryLike extends AsyncIterable<LanceQueryRowBatch> {
  filter(predicate: string): LanceQueryLike;
  limit(limit: number): LanceQueryLike;
  toArray(): Promise<unknown[]>;
}

interface LanceTableLike {
  add(records: LanceRecord[]): Promise<unknown>;
  query(): LanceQueryLike;
  vectorSearch(vector: number[] | Float32Array): LanceQueryLike;
  countRows(filter?: string): Promise<number>;
}

interface LanceDbConnection {
  tableNames(): Promise<string[]>;
  openTable(name: string): Promise<LanceTableLike>;
  createTable(name: string, data: LanceRecord[]): Promise<LanceTableLike>;
  deleteTable?(name: string): Promise<void>;
  dropTable?(name: string): Promise<void>;
}

interface LanceDBModule {
  connect?: (uri: string) => Promise<LanceDbConnection>;
  default?: {
    connect?: (uri: string) => Promise<LanceDbConnection>;
  };
}

interface RagEngineOptions {
  dbPath?: string;
  loadLanceDBModule?: () => Promise<LanceDBModule | null>;
}

function isRecord(value: unknown): value is LanceRecord {
  return typeof value === "object" && value !== null;
}

function toRecordArray(value: unknown): LanceRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

async function loadDefaultLanceDBModule(): Promise<LanceDBModule | null> {
  try {
    const module = await import("@lancedb/lancedb");
    logInfo("RAG", "LanceDB module loaded dynamically.");
    return module as LanceDBModule;
  } catch (error: unknown) {
    logWarn("RAG", `LanceDB module not available: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

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

type EmbeddingResult = {
  vector: number[];
  available: boolean;
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
const modelAvailability = new Map<string, boolean>();

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
): Promise<EmbeddingResult> {
  if (modelAvailability.get(config.model) === false) {
    return {
      vector: zeroVector(config.dimension),
      available: false,
    };
  }

  try {
    const rawEmbedding = await aiGateway.embeddings(text.slice(0, 8000), {
      model: config.model,
      expectedDimension: config.dimension,
    });

    const vector = normalizeEmbedding(rawEmbedding, config.dimension);
    const available = !isMostlyZeroVector(vector);
    modelAvailability.set(config.model, available);

    return { vector, available };
  } catch (error: unknown) {
    modelAvailability.set(config.model, false);
    logError("RAG", `Embedding error (${config.model}): ${error instanceof Error ? error.message : String(error)}`);
    return {
      vector: zeroVector(config.dimension),
      available: false,
    };
  }
}

export class RagEngine {
  private readonly dbPath: string;
  private readonly loadLanceDBModuleFn: () => Promise<LanceDBModule | null>;
  private lancedbModule: LanceDBModule | null = null;
  private lancedbConnected: LanceDbConnection | null = null;

  constructor(options: RagEngineOptions = {}) {
    this.dbPath = options.dbPath ?? DB_PATH;
    this.loadLanceDBModuleFn = options.loadLanceDBModule ?? loadDefaultLanceDBModule;
  }

  async dispose(): Promise<void> {
    this.lancedbModule = null;
    this.lancedbConnected = null;
  }

  private async loadLanceDBModule(): Promise<LanceDBModule | null> {
    if (this.lancedbModule) return this.lancedbModule;
    const module = await this.loadLanceDBModuleFn();
    if (module) {
      this.lancedbModule = module;
    }
    return module;
  }

  private async connectToLanceDB(): Promise<LanceDbConnection | null> {
    if (this.lancedbConnected) return this.lancedbConnected;

    const mod = await this.loadLanceDBModule();
    if (!mod) return null;

    try {
      const connector = mod.connect ?? mod.default?.connect;
      if (typeof connector !== "function") {
        logError("RAG", "@lancedb/lancedb module does not expose a connect() function. LanceDB disabled.");
        this.lancedbConnected = null;
        return null;
      }

      this.lancedbConnected = await connector(this.dbPath);
      logInfo("RAG", "Connected to LanceDB.");
      return this.lancedbConnected;
    } catch (error: unknown) {
      logError("RAG", `Failed to connect to LanceDB: ${error instanceof Error ? error.message : String(error)}`);
      this.lancedbConnected = null;
      return null;
    }
  }

  private async addDocumentToTable(
    db: LanceDbConnection,
    tableNames: string[],
    tableName: string,
    record: LanceRecord,
  ): Promise<void> {
    if (tableNames.includes(tableName)) {
      const table = await db.openTable(tableName);
      try {
        await table.add([record]);
        return;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logWarn("RAG", `Failed to add to table ${tableName}: ${msg}. Attempting to recreate table with new schema.`);
        try {
          if (typeof db.deleteTable === "function") {
            await db.deleteTable(tableName);
            logInfo("RAG", `Deleted table ${tableName} to recreate schema.`);
          } else if (typeof db.dropTable === "function") {
            await db.dropTable(tableName);
            logInfo("RAG", `Dropped table ${tableName} to recreate schema.`);
          } else {
            logWarn("RAG", "DB does not support deleteTable/dropTable; attempting createTable which may fail if table exists.");
          }
        } catch (innerError: unknown) {
          logWarn("RAG", `Error deleting table ${tableName}: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
        }
        try {
          await db.createTable(tableName, [record]);
          return;
        } catch (innerError: unknown) {
          logError("RAG", `Failed to recreate table ${tableName}: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
          throw error;
        }
      }
    }

    await db.createTable(tableName, [record]);
  }

  private async searchTable(
    db: LanceDbConnection,
    tableName: string,
    query: string,
    limit: number,
    config: EmbeddingConfig,
  ): Promise<Array<{ text: string; path?: string; score?: number }>> {
    const table = await db.openTable(tableName);
    const embedding = await getEmbedding(query, config);
    const queryVector = embedding.vector;

    if (embedding.available && !isMostlyZeroVector(queryVector)) {
      const results = await table
        .vectorSearch(queryVector)
        .limit(limit)
        .toArray();

      return toRecordArray(results).map((row) => ({
        text: String(row.text || ""),
        path: typeof row.path === "string" ? row.path : undefined,
        score: typeof row._distance === "number" ? row._distance : undefined,
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
      const pathCol = batch.schema.fields.find((field) => field.name === "path")
        ? batch.getChild("path")
        : null;
      const rowCount = batch.numRows;
      for (let i = 0; i < rowCount; i++) {
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

    if (results.length === 0) {
      try {
        const tableWithFallbacks = table as LanceTableLike & {
          toArray?: () => Promise<unknown[]>;
          getRows?: () => Promise<unknown[]>;
        };

        if (typeof tableWithFallbacks.toArray === "function") {
          const rows = toRecordArray(await tableWithFallbacks.toArray());
          for (const row of rows) {
            const text = String(row.text ?? "");
            const pathVal = typeof row.path === "string" ? row.path : undefined;
            if (text.toLowerCase().includes(q)) {
              results.push({ text, path: pathVal });
              if (results.length >= limit) return results;
            }
          }
        } else if (typeof table.query().toArray === "function") {
          const rows = toRecordArray(await table.query().toArray());
          for (const row of rows) {
            const text = String(row.text ?? "");
            const pathVal = typeof row.path === "string" ? row.path : undefined;
            if (text.toLowerCase().includes(q)) {
              results.push({ text, path: pathVal });
              if (results.length >= limit) return results;
            }
          }
        } else if (typeof tableWithFallbacks.getRows === "function") {
          const rows = toRecordArray(await tableWithFallbacks.getRows());
          for (const row of rows) {
            const text = String(row.text ?? "");
            const pathVal = typeof row.path === "string" ? row.path : undefined;
            if (text.toLowerCase().includes(q)) {
              results.push({ text, path: pathVal });
              if (results.length >= limit) return results;
            }
          }
        }
      } catch (error: unknown) {
        logWarn('RAG', `Fallback table enumeration failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }

  async addDocument(content: string, metadata: object) {
    const db = await this.connectToLanceDB();
    if (!db) {
      logWarn('RAG', 'LanceDB not available; skipping local index write.');
      return;
    }
    const tableNames = await db.tableNames();

    const createdAt = new Date().toISOString();
    const primaryEmbedding = await getEmbedding(content, PRIMARY_EMBEDDING_CONFIG);
    let wroteAnyIndex = false;

    if (primaryEmbedding.available) {
      await this.addDocumentToTable(
        db,
        tableNames,
        PRIMARY_EMBEDDING_CONFIG.tableName,
        {
          vector: primaryEmbedding.vector,
          text: content,
          embeddingModel: PRIMARY_EMBEDDING_CONFIG.model,
          embeddingDimension: PRIMARY_EMBEDDING_CONFIG.dimension,
          ...metadata,
          createdAt,
        },
      );
      wroteAnyIndex = true;
    }

    if (DUAL_INDEX_WRITE_ENABLED || !primaryEmbedding.available) {
      const legacyEmbedding = await getEmbedding(content, LEGACY_EMBEDDING_CONFIG);
      await this.addDocumentToTable(
        db,
        tableNames,
        LEGACY_EMBEDDING_CONFIG.tableName,
        {
          vector: legacyEmbedding.vector,
          text: content,
          embeddingModel: LEGACY_EMBEDDING_CONFIG.model,
          embeddingDimension: LEGACY_EMBEDDING_CONFIG.dimension,
          ...metadata,
          createdAt,
        },
      );
      wroteAnyIndex = true;
    }

    if (!wroteAnyIndex) {
      logWarn('RAG', 'No embedding index was written; both primary and legacy embeddings were unavailable');
    }

    const metadataPath = isRecord(metadata) && typeof metadata.path === "string" ? metadata.path : "unknown";
    logInfo("RAG", `Document indexed: ${metadataPath}`);
  }

  async getTableCount(): Promise<number> {
    try {
      const db = await this.connectToLanceDB();
      if (!db) {
        logWarn('RAG', 'LanceDB not available; getTableCount() returning 0.');
        return 0;
      }
      const tableNames = await db.tableNames();

      const selectedTable = tableNames.includes(
        PRIMARY_EMBEDDING_CONFIG.tableName,
      )
        ? PRIMARY_EMBEDDING_CONFIG.tableName
        : LEGACY_EMBEDDING_CONFIG.tableName;

      if (!tableNames.includes(selectedTable)) return 0;

      const table = await db.openTable(selectedTable);
      return await table.countRows();
    } catch {
      return 0;
    }
  }

  async search(
    query: string,
    limit = 20,
  ): Promise<Array<{ text: string; path?: string; score?: number }>> {
    try {
      const db = await this.connectToLanceDB();
      if (!db) {
        logWarn('RAG', 'LanceDB not available; search() returning empty results.');
        return [];
      }
      const tableNames = await db.tableNames();
      if (tableNames.length === 0) return [];

      if (
        tableNames.includes(PRIMARY_EMBEDDING_CONFIG.tableName) &&
        modelAvailability.get(PRIMARY_EMBEDDING_CONFIG.model) !== false
      ) {
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
    } catch (error: unknown) {
      logError("RAG", `Search error: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}

export class HybridMemory extends RagEngine {
  constructor(dbPath: string = DB_PATH) {
    super({ dbPath });
  }
}

const memory = new HybridMemory();

/**
 * Module-level singleton RagEngine for backward-compatible function exports.
 * Can be used for dependency injection in tests or alternate configurations.
 */
export const defaultRagEngine: HybridMemory = memory;

/** Add content to the RAG index (path/id stored in metadata). */
export async function addToIndex(
  pathOrId: string,
  content: string,
): Promise<void> {
  if (process.env.CF_VECTORIZE_ENABLED === 'true' || vectorizeClient.getStatus().enabled) {
    try {
      await vectorizeClient.upsertText(pathOrId, content, { source: pathOrId });
    } catch (error: unknown) {
      logWarn('RAG', `Vectorize upsert failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

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
  if (process.env.CF_VECTORIZE_ENABLED === 'true' || vectorizeClient.getStatus().enabled) {
    try {
      const results = await vectorizeClient.searchText(query, limit);
      if (results.length > 0) {
        return results.map((result) => {
          const metadata = isRecord(result.metadata) ? result.metadata : {};
          return {
            text: typeof metadata.text === "string" ? metadata.text : "",
            path: typeof metadata.source === "string" ? metadata.source : result.id,
            score: result.score,
          };
        });
      }
    } catch (error: unknown) {
      logWarn('RAG', `Vectorize search failed, fallback LanceDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

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

    await fs
      .mkdir(path.dirname(this.backupPath), { recursive: true })
      .catch(() => {});
    await fs.appendFile(this.backupPath, line, "utf-8").catch((error: unknown) => {
      logWarn("RAG", `Backup write failed: ${error instanceof Error ? error.message : String(error)}`);
    });

    const text = typeof data.text === "string" ? data.text : JSON.stringify(data);
    const sourcePath = typeof data.path === "string" ? data.path : `harvest_${Date.now()}`;
    await addToIndex(sourcePath, text);
  }
}
