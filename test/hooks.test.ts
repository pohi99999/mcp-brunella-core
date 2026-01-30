import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerHook,
  listHooks,
  runHooks,
  clearHooks
} from '../src/utils/hooks.js';

describe('Hooks', () => {
  beforeEach(() => {
    clearHooks();
  });

  it('listHooks returns empty when no hooks registered', () => {
    const list = listHooks();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });

  it('registerHook and listHooks show count', () => {
    registerHook('BeforeTool', () => {});
    registerHook('BeforeTool', () => {});
    const list = listHooks();
    const before = list.find((x) => x.name === 'BeforeTool');
    expect(before).toBeDefined();
    expect(before!.count).toBe(2);
  });

  it('runHooks invokes handlers when not disabled', async () => {
    let ran = 0;
    registerHook('SessionStart', () => { ran += 1; });
    await runHooks('SessionStart', {});
    expect(ran).toBe(1);
  });

  it('runHooks skips when hook name in disabled', async () => {
    let ran = 0;
    registerHook('AfterTool', () => { ran += 1; });
    await runHooks('AfterTool', {}, { disabled: ['AfterTool'] });
    expect(ran).toBe(0);
  });

  it('runHooks skips when enabled false', async () => {
    let ran = 0;
    registerHook('SessionEnd', () => { ran += 1; });
    await runHooks('SessionEnd', {}, { enabled: false });
    expect(ran).toBe(0);
  });

  it('clearHooks(name) removes only that hook', () => {
    registerHook('BeforeTool', () => {});
    registerHook('AfterTool', () => {});
    clearHooks('BeforeTool');
    const list = listHooks();
    expect(list.find((x) => x.name === 'BeforeTool')).toBeUndefined();
    expect(list.find((x) => x.name === 'AfterTool')).toBeDefined();
  });

  it('clearHooks() removes all', () => {
    registerHook('BeforeTool', () => {});
    clearHooks();
    expect(listHooks().length).toBe(0);
  });
});