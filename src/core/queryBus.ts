import { getAuditDb } from './auditLog.js';

export interface DashboardQuery {
  view: string;
  filter?: string;
  params?: unknown[];
}

export class QueryBus {
  async get(query: DashboardQuery) {
    const db = await getAuditDb();
    if (!db) return [];
    
    let sql = `SELECT * FROM ${query.view}`;
    if (query.filter) {
      sql += ` WHERE ${query.filter}`;
    }
    
    return db.prepare(sql).all(...(query.params || []));
  }
}

export const queryBus = new QueryBus();
