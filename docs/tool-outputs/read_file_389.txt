import * as lancedb from "@lancedb/lancedb";
import * as path from 'path';
import { logInfo, logError } from './logger.js';

const DB_PATH = path.join(process.cwd(), 'data', 'brunella_lancedb');

export class LanceDBClient {
  private db: lancedb.Connection | undefined;

  async connect(): Promise<void> {
    if (!this.db) {
      this.db = await lancedb.connect(DB_PATH);
    }
  }

  async isDuplicate(tableName: string, filter: string): Promise<boolean> {
    await this.connect();
    const tableNames = await this.db!.tableNames();
    
    if (!tableNames.includes(tableName)) {
      return false;
    }

    const table = await this.db!.openTable(tableName);
    const results = await table.query()
      .filter(filter)
      .limit(1)
      .toArray();

    return results.length > 0;
  }

  async addData(tableName: string, data: any): Promise<void> {
    await this.connect();
    const tableNames = await this.db!.tableNames();

    if (tableNames.includes(tableName)) {
      const table = await this.db!.openTable(tableName);
      await table.add(Array.isArray(data) ? data : [data]);
    } else {
      await this.db!.createTable(tableName, Array.isArray(data) ? data : [data]);
    }
    
    logInfo('LanceDB', `Data added to ${tableName}.`);
  }

  async query(tableName: string, filter?: string, limit: number = 10): Promise<any[]> {
    await this.connect();
    const tableNames = await this.db!.tableNames();
    
    if (!tableNames.includes(tableName)) {
      return [];
    }

    const table = await this.db!.openTable(tableName);
    let q = table.query();
    if (filter) {
      q = q.filter(filter);
    }
    return await q.limit(limit).toArray();
  }
}

export const lanceDBClient = new LanceDBClient();
// For backward compatibility with MT2
export const invoiceStore = {
  isDuplicate: (invNo: string) => lanceDBClient.isDuplicate('invoices', `invoice_number = "${invNo}"`),
  addInvoice: (data: any) => lanceDBClient.addData('invoices', data)
};
