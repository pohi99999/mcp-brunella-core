#!/usr/bin/env node
/**
 * LanceDB Embeddings Migration Script
 *
 * Migrál régi táblákat (memory, memory_v2_mxbai) → új schemára (embeddingModel mező hozzáadásával)
 * Újra generálja az embeddings-eket nomic-embed-text modellel (768 dims)
 *
 * Használat:
 *   npx tsx scripts/migrate-embeddings.ts
 *   npx tsx scripts/migrate-embeddings.ts --dry-run    # Csak elemzi, nem ír
 *   npx tsx scripts/migrate-embeddings.ts --backup     # Backup készítés
 */

import * as lancedb from "@lancedb/lancedb";
import fs from "fs/promises";
import path from "path";
import { aiGateway } from "../src/utils/aiGateway.js";

// Konfiguráció
const DB_PATH = "./data/brunella_lancedb";
const BACKUP_PATH = "./data/brunella_lancedb_backup";
const NEW_EMBEDDING_MODEL = "nomic-embed-text";
const NEW_EMBEDDING_DIM = 768;
const BATCH_SIZE = 10; // Egyszerre hány dokumentumot dolgozzon fel

// CLI argumentumok
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const shouldBackup = args.includes("--backup");

// Színes console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(level: string, message: string) {
  const timestamp = new Date().toISOString();
  const levelColors: Record<string, string> = {
    INFO: colors.blue,
    SUCCESS: colors.green,
    WARN: colors.yellow,
    ERROR: colors.red,
  };
  const color = levelColors[level] || colors.reset;
  console.log(`${color}[${level}]${colors.reset} ${timestamp} - ${message}`);
}

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const embedding = await aiGateway.embeddings(text.slice(0, 8000), {
      model: NEW_EMBEDDING_MODEL,
      expectedDimension: NEW_EMBEDDING_DIM,
    });

    // Ellenőrizzük a dimenziót
    if (embedding.length !== NEW_EMBEDDING_DIM) {
      log("WARN", `Embedding dimension mismatch: expected ${NEW_EMBEDDING_DIM}, got ${embedding.length}`);
      // Normalizáljuk vagy nullázzuk
      if (embedding.length > NEW_EMBEDDING_DIM) {
        return embedding.slice(0, NEW_EMBEDDING_DIM);
      } else {
        return [...embedding, ...new Array(NEW_EMBEDDING_DIM - embedding.length).fill(0)];
      }
    }

    return embedding;
  } catch (error: any) {
    log("ERROR", `Embedding generation failed: ${error.message}`);
    return new Array(NEW_EMBEDDING_DIM).fill(0); // Zero vector fallback
  }
}

async function backupDatabase(): Promise<void> {
  log("INFO", `Creating backup: ${DB_PATH} → ${BACKUP_PATH}`);

  try {
    await fs.mkdir(path.dirname(BACKUP_PATH), { recursive: true });
    await fs.cp(DB_PATH, BACKUP_PATH, { recursive: true, force: true });
    log("SUCCESS", "Backup completed successfully");
  } catch (error: any) {
    log("ERROR", `Backup failed: ${error.message}`);
    throw error;
  }
}

async function migrateTable(
  db: lancedb.Connection,
  oldTableName: string,
  newTableName: string
): Promise<number> {
  log("INFO", `Starting migration: ${oldTableName} → ${newTableName}`);

  try {
    const tableNames = await db.tableNames();

    if (!tableNames.includes(oldTableName)) {
      log("WARN", `Source table not found: ${oldTableName}, skipping...`);
      return 0;
    }

    const oldTable = await db.openTable(oldTableName);
    const allRecords = await oldTable.query().toArray();

    log("INFO", `Found ${allRecords.length} records in ${oldTableName}`);

    if (allRecords.length === 0) {
      log("WARN", `Empty table: ${oldTableName}, skipping...`);
      return 0;
    }

    if (isDryRun) {
      log("INFO", `[DRY RUN] Would migrate ${allRecords.length} records`);
      log("INFO", `[DRY RUN] Sample record: ${JSON.stringify(allRecords[0], null, 2).slice(0, 200)}...`);
      return allRecords.length;
    }

    // Új táblát készítünk
    let migratedCount = 0;
    const newRecords = [];

    for (let i = 0; i < allRecords.length; i++) {
      const record = allRecords[i];
      const text = record.text || record.content || "";

      if (!text) {
        log("WARN", `Record #${i} has no text, skipping...`);
        continue;
      }

      // Új embedding generálás
      log("INFO", `Processing ${i + 1}/${allRecords.length}: ${text.slice(0, 50)}...`);
      const newVector = await getEmbedding(text);

      // Új record az új schemával
      const newRecord = {
        vector: newVector,
        text: text,
        embeddingModel: NEW_EMBEDDING_MODEL, // ← ÚJ MEZŐ
        embeddingDimension: NEW_EMBEDDING_DIM, // ← ÚJ MEZŐ
        path: record.path || record.id || `migrated_${i}`,
        createdAt: record.createdAt || new Date().toISOString(),
        migratedAt: new Date().toISOString(), // ← ÚJ MEZŐ
        // További mezők átmásolása
        ...Object.fromEntries(
          Object.entries(record).filter(
            ([key]) => !["vector", "text", "path", "createdAt"].includes(key)
          )
        ),
      };

      newRecords.push(newRecord);
      migratedCount++;

      // Batch write (minden BATCH_SIZE rekordnál)
      if (newRecords.length >= BATCH_SIZE) {
        if (tableNames.includes(newTableName)) {
          const newTable = await db.openTable(newTableName);
          await newTable.add(newRecords);
        } else {
          await db.createTable(newTableName, newRecords);
          tableNames.push(newTableName); // Emlékezünk hogy létrehoztuk
        }
        log("SUCCESS", `Batch written: ${newRecords.length} records to ${newTableName}`);
        newRecords.length = 0; // Clear batch
      }
    }

    // Maradék rekordok írása
    if (newRecords.length > 0) {
      if (tableNames.includes(newTableName)) {
        const newTable = await db.openTable(newTableName);
        await newTable.add(newRecords);
      } else {
        await db.createTable(newTableName, newRecords);
      }
      log("SUCCESS", `Final batch written: ${newRecords.length} records to ${newTableName}`);
    }

    log("SUCCESS", `Migration completed: ${migratedCount} records migrated to ${newTableName}`);
    return migratedCount;
  } catch (error: any) {
    log("ERROR", `Migration failed for ${oldTableName}: ${error.message}`);
    throw error;
  }
}

async function main() {
  log("INFO", `${colors.bright}LanceDB Embeddings Migration Tool${colors.reset}`);
  log("INFO", `Mode: ${isDryRun ? "DRY RUN" : "PRODUCTION"}`);
  log("INFO", `Backup: ${shouldBackup ? "ENABLED" : "DISABLED"}`);
  log("INFO", `New embedding model: ${NEW_EMBEDDING_MODEL} (${NEW_EMBEDDING_DIM} dims)`);
  log("INFO", "");

  try {
    // 1. Backup (ha kérték)
    if (shouldBackup && !isDryRun) {
      await backupDatabase();
      log("INFO", "");
    }

    // 2. Kapcsolódás LanceDB-hez
    log("INFO", `Connecting to LanceDB: ${DB_PATH}`);
    const db = await lancedb.connect(DB_PATH);
    const tableNames = await db.tableNames();
    log("INFO", `Found ${tableNames.length} tables: ${tableNames.join(", ")}`);
    log("INFO", "");

    // 3. Migrációs tervek
    const migrations = [
      { old: "memory", new: "memory_v3_nomic" },
      { old: "memory_v2_mxbai", new: "memory_v3_nomic" }, // Ugyanaz a cél tábla!
    ];

    let totalMigrated = 0;

    for (const { old: oldTable, new: newTable } of migrations) {
      const count = await migrateTable(db, oldTable, newTable);
      totalMigrated += count;
      log("INFO", "");
    }

    // 4. Összefoglaló
    log("SUCCESS", `${colors.bright}Migration Summary:${colors.reset}`);
    log("SUCCESS", `Total records migrated: ${totalMigrated}`);
    log("SUCCESS", `New embedding model: ${NEW_EMBEDDING_MODEL}`);
    log("SUCCESS", `New table schema includes: embeddingModel, embeddingDimension, migratedAt`);

    if (isDryRun) {
      log("INFO", "");
      log("INFO", "This was a DRY RUN. No changes were made.");
      log("INFO", "Run without --dry-run to perform actual migration.");
    } else {
      log("INFO", "");
      log("SUCCESS", "Migration completed successfully!");
      log("INFO", "Next steps:");
      log("INFO", "1. Verify new table: brunella agents execute researcher --query 'test search'");
      log("INFO", "2. Update RAG_PRIMARY_TABLE in .env if needed");
      log("INFO", "3. Delete old tables if migration successful");
    }
  } catch (error: any) {
    log("ERROR", `Migration failed: ${error.message}`);
    log("ERROR", error.stack);
    process.exit(1);
  }
}

main();
