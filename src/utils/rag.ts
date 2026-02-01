// FILE: src/utils/rag.ts
// PURPOSE: Zone II: Hibrid memória rendszer (LanceDB) valós idejű íráshoz Node.js-ben.

import * as lancedb from "@lancedb/lancedb";
import fs from "fs/promises";
import path from "path";

const DB_PATH = "./data/brunella_lancedb";

export class HybridMemory {
  private dbPath = DB_PATH;

  async addDocument(content: string, metadata: object) {
    const db = await lancedb.connect(this.dbPath);
    const tableNames = await db.tableNames();

    let table;
    if (tableNames.includes("memory")) {
      table = await db.openTable("memory");
    } else {
      table = await db.createTable("memory", [{ vector: new Array(1536).fill(0), text: content, ...metadata }]);
    }

    await table.add([{ text: content, ...metadata }]);
  }
}

const memory = new HybridMemory();

/** Add content to the RAG index (path/id stored in metadata). */
export async function addToIndex(pathOrId: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true }).catch(() => {});
  await memory.addDocument(content, { path: pathOrId });
}

/** Search RAG by text (simple substring match until vector/embedding is wired). */
export async function searchRAG(query: string, limit = 20): Promise<Array<{ text: string; path?: string }>> {
  try {
    const db = await lancedb.connect(DB_PATH);
    const tableNames = await db.tableNames();
    if (!tableNames.includes("memory")) return [];

    const table = await db.openTable("memory");
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
  } catch {
    return [];
  }
}