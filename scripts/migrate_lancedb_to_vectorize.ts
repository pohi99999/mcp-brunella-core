import * as lancedb from '@lancedb/lancedb';
import { vectorizeClient } from '../src/utils/vectorize.js';
import { logInfo, logError, logWarn } from '../src/utils/logger.js';
import * as dotenv from 'dotenv';

dotenv.config();

const DB_PATH = './data/brunella_lancedb';
const BATCH_SIZE = 50; // Vectorize batch upsert size
const MAX_ROWS_PER_TABLE = parseInt(process.env.MIGRATE_MAX_ROWS || '10000', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

async function migrate() {
  logInfo('Migration', 'Starting LanceDB to Vectorize migration...');
  
  if (!vectorizeClient.getStatus().enabled) {
    logError('Migration', 'VectorizeClient is not enabled. Check your .env configuration.');
    process.exit(1);
  }

  if (DRY_RUN) {
    logWarn('Migration', 'DRY RUN MODE - Preview only, no actual migration');
  }

  try {
    const db = await lancedb.connect(DB_PATH);
    const tableNames = await db.tableNames();
    
    if (tableNames.length === 0) {
      logInfo('Migration', 'No tables found in LanceDB. Nothing to migrate.');
      return;
    }

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const tableName of tableNames) {
      logInfo('Migration', `Processing table: ${tableName}`);
      const table = await db.openTable(tableName);
      
      // Get rows in batches for large tables
      const totalRows = await table.countRows();
      logInfo('Migration', `Found ${totalRows} rows in ${tableName}`);
      
      const rowsToMigrate = Math.min(totalRows, MAX_ROWS_PER_TABLE);
      logInfo('Migration', `Migrating ${rowsToMigrate} rows (max: ${MAX_ROWS_PER_TABLE})`);

      let offset = 0;
      const batchItems: Array<{ id: string; text: string; metadata: Record<string, unknown> }> = [];

      while (offset < rowsToMigrate) {
        const limit = Math.min(BATCH_SIZE * 2, rowsToMigrate - offset);
        const rows = await table.query().limit(limit).offset(offset).toArray();
        
        if (rows.length === 0) break;

        for (const row of rows) {
          const id = (row.path as string) || `migrated-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const text = (row.text as string) || JSON.stringify(row);
          
          // Extract metadata (everything except vector and text)
          const metadata: Record<string, unknown> = { 
            source: 'lancedb_migration', 
            table: tableName,
            migratedAt: new Date().toISOString()
          };
          
          for (const [key, value] of Object.entries(row)) {
            if (key !== 'vector' && key !== 'text' && typeof value !== 'object') {
              // Limit metadata size (Vectorize has 10KB limit)
              const valueStr = String(value);
              if (valueStr.length < 1000) {
                metadata[key] = value;
              }
            }
          }

          batchItems.push({ id, text, metadata });

          // Process batch when full
          if (batchItems.length >= BATCH_SIZE) {
            const migrated = await processBatch(batchItems, DRY_RUN);
            totalMigrated += migrated;
            totalSkipped += (batchItems.length - migrated);
            batchItems.length = 0; // Clear batch
            
            if (totalMigrated % 100 === 0) {
              logInfo('Migration', `Progress: ${totalMigrated} migrated, ${totalSkipped} skipped`);
            }
          }
        }

        offset += rows.length;
      }

      // Process remaining items
      if (batchItems.length > 0) {
        const migrated = await processBatch(batchItems, DRY_RUN);
        totalMigrated += migrated;
        totalSkipped += (batchItems.length - migrated);
      }
    }

    logInfo('Migration', `Migration complete! Total migrated: ${totalMigrated}, skipped: ${totalSkipped}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('Migration', `Migration failed: ${msg}`);
  }
}

/**
 * Process a batch of items for migration
 */
async function processBatch(
  items: Array<{ id: string; text: string; metadata: Record<string, unknown> }>,
  dryRun: boolean
): Promise<number> {
  if (dryRun) {
    logInfo('Migration', `[DRY RUN] Would migrate batch of ${items.length} items`);
    return items.length;
  }

  let successCount = 0;

  for (const item of items) {
    try {
      const success = await vectorizeClient.upsertText(item.id, item.text, item.metadata);
      if (success) {
        successCount++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Skip oversized metadata errors (logged already by VectorizeClient)
      if (!msg.includes('oversized metadata')) {
        logError('Migration', `Failed to migrate row ${item.id}: ${msg}`);
      }
    }
  }

  return successCount;
}

migrate().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  logError('Migration', `Fatal error: ${msg}`);
});
