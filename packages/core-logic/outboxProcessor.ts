import { getAuditDb } from './auditLog.js';
import { logInfo, logError } from '@packages/utils/logger.js';

export interface OutboxMessage {
  type: 'email' | 'webhook' | 'slack';
  payload: unknown;
}

export class OutboxProcessor {
  async schedule(message: OutboxMessage) {
    const db = await getAuditDb();
    if (!db) return;
    
    // Create table if not exists (for prototype safety)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        payload TEXT,
        status TEXT,
        createdAt INTEGER,
        attempts INTEGER
      )
    `).run();

    db.prepare(
      `INSERT INTO outbox (type, payload, status, createdAt, attempts)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      message.type,
      JSON.stringify(message.payload),
      'pending',
      Date.now(),
      0
    );
  }
  
  startWorker() {
    setInterval(async () => {
      const db = await getAuditDb();
      if (!db) return;
      
      try {
        const pending = db.prepare(
          `SELECT * FROM outbox WHERE status = 'pending' 
           AND attempts < 5 ORDER BY createdAt ASC LIMIT 10`
        ).all() as any[];
        
        for (const msg of pending) {
          try {
            await this.deliver(msg);
            db.prepare(`UPDATE outbox SET status = 'sent' WHERE id = ?`).run(msg.id);
          } catch (e) {
            const attempts = msg.attempts + 1;
            const status = attempts >= 4 ? 'dead' : 'pending';
            db.prepare(`UPDATE outbox SET attempts = ?, status = ? WHERE id = ?`).run(attempts, status, msg.id);
            logError('OutboxProcessor', `Delivery failed for message ${msg.id}: ${e}`);
          }
        }
      } catch (err) {
        // Table might not exist yet
      }
    }, 10_000);
  }

  private async deliver(msg: any) {
    logInfo('OutboxProcessor', `Delivering message type: ${msg.type}`);
    // Simulate delivery
  }
}

export const outboxProcessor = new OutboxProcessor();

