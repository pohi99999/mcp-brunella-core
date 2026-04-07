import * as path from 'path';
import { logInfo, logError } from './logger.js';

const DB_PATH = path.join(process.cwd(), 'data', 'brunella_lancedb');

type LanceRecord = Record<string, unknown>;

interface LanceQueryLike {
  filter(predicate: string): LanceQueryLike;
  limit(limit: number): LanceQueryLike;
  toArray(): Promise<unknown[]>;
}

interface LanceTableLike {
  add(data: LanceRecord[]): Promise<unknown>;
  query(): LanceQueryLike;
  vectorSearch(vector: number[]): LanceQueryLike;
}

interface LanceDbConnection {
  tableNames(): Promise<string[]>;
  openTable(name: string): Promise<LanceTableLike>;
  createTable(name: string, data: LanceRecord[]): Promise<LanceTableLike>;
}

interface LanceDBModule {
  connect?: (uri: string) => Promise<LanceDbConnection>;
  default?: {
    connect?: (uri: string) => Promise<LanceDbConnection>;
  };
}

let lancedbModule: LanceDBModule | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export class LanceDBClient {
  private db: LanceDbConnection | undefined;

  async connect(): Promise<void> {
    if (this.db) return;

    if (!lancedbModule) {
      try {
        const module = await import('@lancedb/lancedb');
        lancedbModule = module as LanceDBModule;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logError('LanceDB', `Failed to load @lancedb/lancedb: ${msg}. LanceDB features will be disabled.`);
        return;
      }
    }

    try {
      const connector = lancedbModule.connect ?? lancedbModule.default?.connect;
      if (!connector) {
        logError('LanceDB', 'No connect() function found on @lancedb/lancedb module. LanceDB disabled.');
        return;
      }
      this.db = await connector(DB_PATH);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
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
    } catch (error: unknown) {
      logError('LanceDB', `isDuplicate failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async addData(tableName: string, data: LanceRecord | LanceRecord[]): Promise<void> {
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
    } catch (error: unknown) {
      logError('LanceDB', `addData failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async insert(tableName: string, data: LanceRecord | LanceRecord[]): Promise<void> {
    return this.addData(tableName, data);
  }

  async query(tableName: string, filter?: string, limit: number = 10): Promise<LanceRecord[]> {
    try {
      await this.connect();
      if (!this.db) return [];
      const tableNames = await this.db.tableNames();
      if (!tableNames.includes(tableName)) return [];
      const table = await this.db.openTable(tableName);
      let query = table.query();
      if (filter) query = query.filter(filter);
      return toRecordArray(await query.limit(limit).toArray());
    } catch (error: unknown) {
      logError('LanceDB', `query failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async searchVector(tableName: string, vector: number[], limit: number = 5): Promise<LanceRecord[]> {
    try {
      await this.connect();
      if (!this.db) return [];
      const tableNames = await this.db.tableNames();
      if (!tableNames.includes(tableName)) return [];
      const table = await this.db.openTable(tableName);
      return toRecordArray(await table.vectorSearch(vector).limit(limit).toArray());
    } catch (error: unknown) {
      logError('LanceDB', `searchVector failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}

export const lanceDBClient = new LanceDBClient();

// For backward compatibility with MT2
export const invoiceStore = {
  isDuplicate: (invNo: string) => lanceDBClient.isDuplicate('invoices', `invoice_number = "${invNo}"`),
  addInvoice: (data: LanceRecord) => lanceDBClient.addData('invoices', data),
};
