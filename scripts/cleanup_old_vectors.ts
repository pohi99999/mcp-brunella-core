import { vectorizeClient } from '../src/utils/vectorize.js';
import { logInfo, logError, logWarn } from '../src/utils/logger.js';
import * as dotenv from 'dotenv';

dotenv.config();

const RETENTION_DAYS = parseInt(process.env.VECTORIZE_RETENTION_DAYS || '90', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 100;

interface VectorizeListResponse {
  result?: {
    vectors?: Array<{
      id: string;
      metadata?: Record<string, unknown>;
    }>;
  };
}

/**
 * Cleanup script: törli a RETENTION_DAYS-nál régebbi vektorokat
 * 
 * Használat:
 *   node --import tsx scripts/cleanup_old_vectors.ts
 *   DRY_RUN=true node --import tsx scripts/cleanup_old_vectors.ts  # preview only
 *   VECTORIZE_RETENTION_DAYS=60 node --import tsx scripts/cleanup_old_vectors.ts
 */
async function cleanup() {
  logInfo('VectorCleanup', `Cleanup indítása: ${RETENTION_DAYS} napnál régebbi vektorok törlése`);
  
  if (!vectorizeClient.getStatus().enabled) {
    logError('VectorCleanup', 'VectorizeClient nem engedélyezve. Ellenőrizd a .env konfigurációt.');
    process.exit(1);
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffTimestamp = cutoffDate.getTime();

  logInfo('VectorCleanup', `Cutoff dátum: ${cutoffDate.toISOString()}`);
  if (DRY_RUN) {
    logWarn('VectorCleanup', 'DRY RUN MODE - Nincs tényleges törlés');
  }

  try {
    // Cloudflare Vectorize API még nem támogatja a list + filter műveletet közvetlenül
    // Workaround: metadata-ban tároljuk a createdAt timestampet, query-vel szűrjük
    
    // Mivel a Vectorize API korlátozottan támogatja a vector listázást,
    // alternatív megoldás: lokális tracking vagy metadata-alapú keresés
    
    logWarn('VectorCleanup', 'Vectorize API korlátozások: teljes vector lista nem elérhető API-n keresztül');
    logInfo('VectorCleanup', 'Megoldás: migration során mentett IDs alapján vagy metadata query');
    
    // Példa: ha van tracking fájl vagy database, ahol tároljuk az ID-kat és időbélyegeket
    const trackedVectors = await getTrackedVectors(); // mock function
    
    const toDelete: string[] = [];
    
    for (const vector of trackedVectors) {
      const createdAt = vector.metadata?.createdAt as string | undefined;
      if (!createdAt) continue;
      
      const vectorDate = new Date(createdAt).getTime();
      if (vectorDate < cutoffTimestamp) {
        toDelete.push(vector.id);
      }
    }

    logInfo('VectorCleanup', `Törölendő vektorok: ${toDelete.length}`);

    if (toDelete.length === 0) {
      logInfo('VectorCleanup', 'Nincs törölendő vektor.');
      return;
    }

    if (!DRY_RUN) {
      // Batch delete
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_SIZE);
        await deleteVectorBatch(batch);
        logInfo('VectorCleanup', `Törölve: ${i + batch.length}/${toDelete.length}`);
      }
    } else {
      logInfo('VectorCleanup', `Törölnék (DRY RUN): ${toDelete.slice(0, 10).join(', ')}...`);
    }

    logInfo('VectorCleanup', '✅ Cleanup befejezve');
  } catch (e: any) {
    logError('VectorCleanup', `Cleanup hiba: ${e.message}`);
    process.exit(1);
  }
}

/**
 * Mock function - valódi implementációhoz tracking DB vagy fájl szükséges
 */
async function getTrackedVectors(): Promise<Array<{ id: string; metadata?: Record<string, unknown> }>> {
  logWarn('VectorCleanup', 'getTrackedVectors: mock implementáció - valódi tracking DB szükséges');
  
  // Placeholder: üres lista vagy lokális tracking fájl olvasása
  // Valódi implementáció: SQLite, JSON file, vagy D1 database tracking tábla
  return [];
}

/**
 * Vectorize delete API hívás
 */
async function deleteVectorBatch(ids: string[]): Promise<void> {
  const baseUrl = 'https://api.cloudflare.com/client/v4';
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const indexName = process.env.CF_VECTORIZE_INDEX || 'brunella-agent-memory';
  
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const globalApiKey = process.env.CLOUDFLARE_GLOBAL_API_KEY || process.env.CF_GLOBAL_API_KEY;
  const email = process.env.CLOUDFLARE_EMAIL || process.env.CF_EMAIL;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (globalApiKey && email) {
    headers['X-Auth-Key'] = globalApiKey;
    headers['X-Auth-Email'] = email;
  } else if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  try {
    const response = await fetch(
      `${baseUrl}/accounts/${accountId}/vectorize/v2/indexes/${indexName}/delete`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Delete failed: ${response.status} ${err}`);
    }

    logInfo('VectorCleanup', `Batch deleted: ${ids.length} vectors`);
  } catch (e: any) {
    logError('VectorCleanup', `Delete batch failed: ${e.message}`);
    throw e;
  }
}

cleanup().catch(console.error);
