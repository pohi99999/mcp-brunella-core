import { describe, it, expect } from 'vitest';
import { EventBus, BusEvent } from '@packages/core-logic/eventBus.js';

interface EventRow { id: number; ts: number; source: string; type: string; payload: string; consumed: number; }

type EventBusDb = ConstructorParameters<typeof EventBus>[0];

function createMockDb(): { db: EventBusDb; rows: EventRow[] } {
  const rows: EventRow[] = [];

  const db = {
    pragma: (_statement: string) => {},
    exec: (_sql: string) => {},
    prepare: (sql: string) => {
      if (sql.startsWith('INSERT INTO event_bus')) {
        return {
          run: (ts: number, source: string, type: string, payload: string) => {
            rows.push({
              id: rows.length + 1,
              ts,
              source,
              type,
              payload,
              consumed: 0,
            });
          },
        };
      }

      throw new Error(`Unsupported SQL in test double: ${sql}`);
    },
  };

  return {
    db: db as unknown as EventBusDb,
    rows,
  };
}

describe('EventBus', () => {
  it('emit stores event in SQLite and notifies listeners', () => {
    const { db, rows } = createMockDb();
    const bus = new EventBus(db);

    const received: BusEvent[] = [];
    bus.on('task.completed', (e) => received.push(e));

    bus.emit({ source: 'TestAgent', type: 'task.completed', payload: { taskId: 't1' } });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('task.completed');

    // Verify DB row
    const row = rows.find((entry) => entry.type === 'task.completed');
    expect(row).toBeDefined();
    expect(row.source).toBe('TestAgent');
    expect(JSON.parse(row.payload)).toEqual({ taskId: 't1' });
  });

  it('wildcard listener receives all events', () => {
    const { db } = createMockDb();
    const bus = new EventBus(db);

    const all: unknown[] = [];
    bus.on('*', (e) => all.push(e));

    bus.emit({ source: 'A', type: 'agent.working', payload: {} });
    bus.emit({ source: 'B', type: 'swarm.spawned', payload: {} });

    expect(all).toHaveLength(2);
  });

  it('off removes listener', () => {
    const { db } = createMockDb();
    const bus = new EventBus(db);

    let count = 0;
    const handler = () => { count++; };
    bus.on('system.failover', handler);
    bus.emit({ source: 'S', type: 'system.failover', payload: {} });
    bus.off('system.failover', handler);
    bus.emit({ source: 'S', type: 'system.failover', payload: {} });

    expect(count).toBe(1);
  });

  it('works in in-memory mode when SQLite is unavailable', () => {
    const bus = new EventBus(null);

    const received: BusEvent[] = [];
    bus.on('*', (e) => received.push(e));

    expect(() => {
      bus.emit({ source: 'Fallback', type: 'system.recovered', payload: { mode: 'memory' } });
    }).not.toThrow();

    expect(received).toHaveLength(1);
    expect(received[0].payload).toEqual({ mode: 'memory' });
  });

  it('falls back to in-memory mode when SQLite init fails after open', () => {
    const bus = new EventBus({
      pragma: () => {
        throw new Error('disk I/O error');
      },
      exec: () => {},
      prepare: () => {
        throw new Error('should not prepare after pragma failure');
      },
    } as unknown as EventBusDb);

    const received: BusEvent[] = [];
    bus.on('*', (event) => received.push(event));

    expect(() => {
      bus.emit({ source: 'Fallback', type: 'system.recovered', payload: { stage: 'init' } });
    }).not.toThrow();

    expect(received).toHaveLength(1);
    expect(received[0].payload).toEqual({ stage: 'init' });
  });
});
