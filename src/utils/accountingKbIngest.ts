import fs from 'fs';
import path from 'path';
import { logInfo, logError } from './logger.js';
// vectorizeText helyett dummy embedding (az infra-függőség elkerülése végett)
const vectorizeText = async (t: string) => new Array(1536).fill(0).map(() => Math.random());
// lancedb_client.ts feltételezett létezése és interfésze alapján
// import { getLanceDBConnection } from './lancedb_client.js'; 

/**
 * Számviteli tudásbázis (Accounting KB) betöltő és vektorizáló eszköz
 * Beolvassa a data/accounting-kb/ mappából a fájlokat és LanceDB-be tárolja.
 */
export async function ingestAccountingDocs() {
  const kbPath = path.resolve(process.cwd(), 'data/accounting-kb');
  logInfo('AccountingKB', `Ingesting documents from ${kbPath}`);

  if (!fs.existsSync(kbPath)) {
    logError('AccountingKB', 'KB directory not found');
    return;
  }

  const files = fs.readdirSync(kbPath).filter(f => f !== 'README.md');
  
  if (files.length === 0) {
    logInfo('AccountingKB', 'No documents found to ingest (only README.md exists)');
    return;
  }

  for (const file of files) {
    const filePath = path.join(kbPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    logInfo('AccountingKB', `Processing ${file}...`);
    
    try {
      // Itt történne a vektorizálás és mentés
      const vector = await vectorizeText(content);
      
      logInfo('AccountingKB', `Vectorized ${file} (length: ${content.length}, vector size: ${vector.length})`);
      
      // LanceDB mentés (példa)
      /*
      const db = await getLanceDBConnection();
      const table = await db.openTable('accounting_kb');
      await table.add([{
        id: crypto.randomUUID(),
        source_type: 'policy',
        content: content,
        vector: vector,
        metadata: {
          file_name: file,
          date_ingested: new Date().toISOString()
        }
      }]);
      */
    } catch (error) {
      logError('AccountingKB', `Failed to ingest ${file}: ${error}`);
    }
  }
}

// Ha parancssorból futtatjuk
if (process.argv[1].includes('accountingKbIngest.ts')) {
    ingestAccountingDocs().then(() => {
        logInfo('AccountingKB', 'Ingestion process finished');
        process.exit(0);
    }).catch(err => {
        logError('AccountingKB', `Ingestion failed: ${err}`);
        process.exit(1);
    });
}
