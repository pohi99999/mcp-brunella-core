import { getAuditDb } from './auditLog.js';

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  payload: unknown;
  metadata: {
    agentName: string;
    sessionId: string;
    correlationId: string;
    causationId: string;
    timestamp: number;
    version: number;
  };
}

export class EventStore {
  async append(event: DomainEvent) {
    const db = await getAuditDb();
    if (!db) return;
    
    // Create table if not exists (for prototype safety)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS event_store (
        id TEXT PRIMARY KEY,
        type TEXT,
        aggregateId TEXT,
        payload TEXT,
        metadata TEXT,
        timestamp INTEGER,
        version INTEGER
      )
    `).run();

    db.prepare(
      `INSERT INTO event_store (id, type, aggregateId, payload, metadata, timestamp, version) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.id,
      event.type,
      event.aggregateId,
      JSON.stringify(event.payload),
      JSON.stringify(event.metadata),
      event.metadata.timestamp,
      event.metadata.version
    );
  }

  async replay(aggregateId: string, untilTimestamp?: number) {
    const db = await getAuditDb();
    if (!db) return [];
    
    return db.prepare(
      `SELECT * FROM event_store 
       WHERE aggregateId = ? AND timestamp <= ?
       ORDER BY version ASC`
    ).all(aggregateId, untilTimestamp ?? Date.now());
  }

  async getTimeline(correlationId: string) {
    const db = await getAuditDb();
    if (!db) return [];
    
    return db.prepare(
      `SELECT type, metadata, timestamp FROM event_store
       WHERE json_extract(metadata, '$.correlationId') = ?
       ORDER BY timestamp ASC`
    ).all(correlationId);
  }
}

export const eventStore = new EventStore();
