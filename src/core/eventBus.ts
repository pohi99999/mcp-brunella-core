/**
 * Enterprise Event Bus — SQLite WAL (Brunella Swarm Hybrid Architecture, Task 8)
 *
 * Durable, in-process event bus backed by SQLite WAL-mode storage.
 * Supports typed event routing with wildcard listeners.
 *
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logInfo, logError } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type EventType =
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'swarm.spawned'
  | 'swarm.dissolved'
  | 'swarm.leader_elected'
  | 'agent.working'
  | 'agent.idle'
  | 'agent.error'
  | 'system.failover'
  | 'system.recovered'
  | 'phoenix.snapshot'
  | 'phoenix.restored';

export interface BusEvent {
  source: string;
  type: EventType;
  payload: Record<string, unknown>;
}

type Listener = (event: BusEvent) => void;

// ---------------------------------------------------------------------------
// SCHEMA
// ---------------------------------------------------------------------------

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS event_bus (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    ts       INTEGER NOT NULL,
    source   TEXT NOT NULL,
    type     TEXT NOT NULL,
    payload  TEXT NOT NULL,
    consumed INTEGER DEFAULT 0
  );
`;

// ---------------------------------------------------------------------------
// EVENTBUS CLASS
// ---------------------------------------------------------------------------

export class EventBus {
  private listeners: Map<string, Array<Listener>>;
  private insertStmt: Database.Statement | null = null;

  private degradeToMemory(reason: unknown): void {
    this.insertStmt = null;
    this.db = null;
    logError('EventBus', `SQLite event bus unavailable, continuing without persistence: ${reason}`);
    logInfo('EventBus', 'SQLite persistence unavailable, falling back to in-memory mode');
  }

  constructor(private db: Database.Database | null) {
    this.listeners = new Map();

    if (!this.db) {
      this.insertStmt = null;
      logInfo('EventBus', 'SQLite persistence unavailable, falling back to in-memory mode');
      return;
    }

    try {
      // Enable WAL mode for concurrent reads + low-latency writes
      this.db.pragma('journal_mode = WAL');

      // Create table if not exists
      this.db.exec(CREATE_TABLE_SQL);

      // Prepare insert statement once for performance
      this.insertStmt = this.db.prepare(
        'INSERT INTO event_bus (ts, source, type, payload) VALUES (?, ?, ?, ?)'
      );
    } catch (err) {
      this.degradeToMemory(err);
    }
  }

  /**
   * Emit an event: persists to SQLite and notifies all matching listeners.
   */
  emit(event: BusEvent): void {
    // Persist to DB first
    if (this.insertStmt) {
      try {
        this.insertStmt.run(Date.now(), event.source, event.type, JSON.stringify(event.payload));
      } catch (err) {
        logError('EventBus', `Failed to persist event ${event.type}: ${err}`);
      }
    }

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      for (const listener of [...typeListeners]) {
        try {
          listener(event);
        } catch (err) {
          logError('EventBus', `Listener error for ${event.type}: ${err}`);
        }
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const listener of [...wildcardListeners]) {
        try {
          listener(event);
        } catch (err) {
          logError('EventBus', `Wildcard listener error: ${err}`);
        }
      }
    }
  }

  /**
   * Register a listener for a specific event type or all events ('*').
   */
  on(type: EventType | '*', listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  /**
   * Remove a previously registered listener.
   */
  off(type: EventType | '*', listener: Listener): void {
    const list = this.listeners.get(type);
    if (!list) return;
    const filtered = list.filter((l) => l !== listener);
    this.listeners.set(type, filtered);
  }
}

// ---------------------------------------------------------------------------
// SINGLETON
// ---------------------------------------------------------------------------

function createSingletonDb(): Database.Database | null {
  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'brunella.db');
  try {
    const instance = new Database(dbPath);
    logInfo('EventBus', `Singleton connected to ${dbPath}`);
    return instance;
  } catch (err) {
    logError('EventBus', `SQLite event bus unavailable, continuing without persistence: ${err}`);
    return null;
  }
}

export const eventBus = new EventBus(createSingletonDb());
