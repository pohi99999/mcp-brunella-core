/**
 * Test: Kahn-algoritmus (dagSort.ts)
 * Track: bas_orchestration_chain_20260221 / Phase 2
 */

import { describe, it, expect } from 'vitest';
import { kahnSort } from '@packages/utils/dagSort.js';
import type { MicroTask } from '@packages/agents/taskDecomposerCore.js';

function makeTask(id: string, dependencies: string[] = []): MicroTask {
  return { id, agent: 'Developer', task: `Task ${id}`, dependencies, parallel: false, retries: 1, timeoutMs: 60000 };
}

describe('kahnSort()', () => {
  it('lineáris lánc: A→B→C helyes sorrendben', () => {
    const tasks = [
      makeTask('t1', []),
      makeTask('t2', ['t1']),
      makeTask('t3', ['t2']),
    ];
    const sorted = kahnSort(tasks);
    expect(sorted.map(t => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('párhuzamos ágak: A→C, B→C (A és B bármilyen sorrendben, C utoljára)', () => {
    const tasks = [
      makeTask('tA', []),
      makeTask('tB', []),
      makeTask('tC', ['tA', 'tB']),
    ];
    const sorted = kahnSort(tasks);
    // tC biztosan utolsó
    expect(sorted[sorted.length - 1].id).toBe('tC');
    // tA és tB mindkettő szerepel az első két helyen
    expect(sorted.slice(0, 2).map(t => t.id).sort()).toEqual(['tA', 'tB']);
  });

  it('elágazó DAG: A→B→D, A→C→D', () => {
    const tasks = [
      makeTask('tA', []),
      makeTask('tB', ['tA']),
      makeTask('tC', ['tA']),
      makeTask('tD', ['tB', 'tC']),
    ];
    const sorted = kahnSort(tasks);
    expect(sorted[0].id).toBe('tA');
    expect(sorted[sorted.length - 1].id).toBe('tD');
  });

  it('egy elemű lista visszaadja önmagát', () => {
    const tasks = [makeTask('t1', [])];
    const sorted = kahnSort(tasks);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe('t1');
  });

  it('üres lista üres listát ad vissza', () => {
    expect(kahnSort([])).toEqual([]);
  });

  it('kör (t1→t2→t1) Error-t dob', () => {
    const tasks = [
      makeTask('t1', ['t2']),
      makeTask('t2', ['t1']),
    ];
    expect(() => kahnSort(tasks)).toThrow('DAG kör detektálva');
  });

  it('háromszög-kör (t1→t2→t3→t1) Error-t dob', () => {
    const tasks = [
      makeTask('t1', ['t3']),
      makeTask('t2', ['t1']),
      makeTask('t3', ['t2']),
    ];
    expect(() => kahnSort(tasks)).toThrow('DAG kör detektálva');
  });

  it('rendezés után minden elem szerepel pontosan egyszer', () => {
    const tasks = [
      makeTask('t1', []),
      makeTask('t2', ['t1']),
      makeTask('t3', ['t1']),
      makeTask('t4', ['t2', 't3']),
    ];
    const sorted = kahnSort(tasks);
    expect(sorted).toHaveLength(4);
    expect(new Set(sorted.map(t => t.id)).size).toBe(4);
  });
});
