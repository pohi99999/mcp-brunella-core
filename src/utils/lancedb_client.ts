import * as path from 'path';
import { logInfo, logError } from './logger.js';

const DB_PATH = path.join(process.cwd(), 'data', 'brunella_lancedb');

 
let lancedbModule: any = null;

export class LanceDBClient {
   
  private db: any | undefined;

  async connect(): Promise<void> {
    if (this.db) return;

    if (!lancedbModule) {
      try {
        lancedbModule = await import('@lancedb/lancedb');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('LanceDB', `Failed to load @lancedb/lancedb: ${msg}. LanceDB features will be disabled.`);
        // Leave db undefined so other methods can gracefully return defaults
        return;
      }
    }

    try {
      // connect may be a named export or on default
      const connector = lancedbModule.connect ?? lancedbModule.default?.connect;
      if (!connector) {
        logError('LanceDB', 'No connect() function found on @lancedb/lancedb module. LanceDB disabled.');
        return;
      }
      this.db = await connector(DB_PATH);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('LanceDB', `Failed to initialize LanceDB: ${msg}. LanceDB features will be disabled.`);
      this.db = undefined;
    }
  }

  async isDuplicate(tableName: string, filter: string): Promise<boolean> {
    try {
      await this.connect();
      if (!this.db) return false;
      const tableNames = await this.db.tableNames();
      if (!tableNames.includes(tableName)) return false;
      const table = await this.db.openTable(tableName);
      const results = await table.query().filter(filter).limit(1).toArray();
      return results.length > 0;
    } catch (e: unknown) {
      logError('LanceDB', `isDuplicate failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  async addData(tableName: string, data: Record<string, unknown> | Record<string, unknown>[]): Promise<void> {
    try {
      await this.connect();
      if (!this.db) return;
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(tableName)) {
        const table = await this.db.openTable(tableName);
        await table.add(Array.isArray(data) ? data : [data]);
      } else {
        await this.db.createTable(tableName, Array.isArray(data) ? data : [data]);
      }
      logInfo('LanceDB', `Data added to ${tableName}.`);
    } catch (e: unknown) {
      logError('LanceDB', `addData failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Alias for addData to support existing codebase usage
  async insert(tableName: string, data: Record<string, unknown> | Record<string, unknown>[]): Promise<void> {
    return this.addData(tableName, data);
  }

  async query(tableName: string, filter?: string, limit: number = 10): Promise<Record<string, unknown>[]> {
    try {
      await this.connect();
      if (!this.db) return [];
      const tableNames = await this.db.tableNames();
      if (!tableNames.includes(tableName)) return [];
      const table = await this.db.openTable(tableName);
      let q = table.query();
      if (filter) q = q.filter(filter);
      return await q.limit(limit).toArray();
    } catch (e: unknown) {
      logError('LanceDB', `query failed: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  async searchVector(tableName: string, vector: number[], limit: number = 5): Promise<Record<string, unknown>[]> {
    try {
      await this.connect();
      if (!this.db) return [];
      const tableNames = await this.db.tableNames();
      if (!tableNames.includes(tableName)) return [];
      const table = await this.db.openTable(tableName);
      return await table.vectorSearch(vector).limit(limit).toArray();
    } catch (e: unknown) {
      logError('LanceDB', `searchVector failed: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }
}

export const lanceDBClient = new LanceDBClient();// For backward compatibility with MT2
export const invoiceStore = {
  isDuplicate: (invNo: string) => lanceDBClient.isDuplicate('invoices', `invoice_number = "${invNo}"`),
  addInvoice: (data: Record<string, unknown>) => lanceDBClient.addData('invoices', data)
};
