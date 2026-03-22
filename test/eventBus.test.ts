import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { EventBus, BusEvent } from '../src/core/eventBus.js';

interface EventRow { id: number; ts: number; source: string; type: string; payload: string; consumed: number; }

describe('EventBus', () => {
  it('emit stores event in SQLite and notifies listeners', () => {
    const db = new Database(':memory:');
    const bus = new EventBus(db);

    const received: BusEvent[] = [];
    bus.on('task.completed', (e) => received.push(e));

    bus.emit({ source: 'TestAgent', type: 'task.completed', payload: { taskId: 't1' } });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('task.completed');

    // Verify DB row
    const row = db.prepare('SELECT * FROM event_bus WHERE type = ?').get('task.completed') as EventRow;
    expect(row).toBeDefined();
    expect(row.source).toBe('TestAgent');
    expect(JSON.parse(row.payload)).toEqual({ taskId: 't1' });
  });

  it('wildcard listener receives all events', () => {
    const db = new Database(':memory:');
    const bus = new EventBus(db);

    const all: unknown[] = [];
    bus.on('*', (e) => all.push(e));

    bus.emit({ source: 'A', type: 'agent.working', payload: {} });
    bus.emit({ source: 'B', type: 'swarm.spawned', payload: {} });

    expect(all).toHaveLength(2);
  });

  it('off removes listener', () => {
    const db = new Database(':memory:');
    const bus = new EventBus(db);

    let count = 0;
    const handler = () => { count++; };
    bus.on('system.failover', handler);
    bus.emit({ source: 'S', type: 'system.failover', payload: {} });
    bus.off('system.failover', handler);
    bus.emit({ source: 'S', type: 'system.failover', payload: {} });

    expect(count).toBe(1);
  });
});
