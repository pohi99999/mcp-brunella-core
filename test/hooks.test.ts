import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
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
    assert.ok(Array.isArray(list));
    assert.strictEqual(list.length, 0);
  });

  it('registerHook and listHooks show count', () => {
    registerHook('BeforeTool', () => {});
    registerHook('BeforeTool', () => {});
    const list = listHooks();
    const before = list.find((x) => x.name === 'BeforeTool');
    assert.ok(before);
    assert.strictEqual(before!.count, 2);
  });

  it('runHooks invokes handlers when not disabled', async () => {
    let ran = 0;
    registerHook('SessionStart', () => { ran += 1; });
    await runHooks('SessionStart', {});
    assert.strictEqual(ran, 1);
  });

  it('runHooks skips when hook name in disabled', async () => {
    let ran = 0;
    registerHook('AfterTool', () => { ran += 1; });
    await runHooks('AfterTool', {}, { disabled: ['AfterTool'] });
    assert.strictEqual(ran, 0);
  });

  it('runHooks skips when enabled false', async () => {
    let ran = 0;
    registerHook('SessionEnd', () => { ran += 1; });
    await runHooks('SessionEnd', {}, { enabled: false });
    assert.strictEqual(ran, 0);
  });

  it('clearHooks(name) removes only that hook', () => {
    registerHook('BeforeTool', () => {});
    registerHook('AfterTool', () => {});
    clearHooks('BeforeTool');
    const list = listHooks();
    assert.strictEqual(list.find((x) => x.name === 'BeforeTool'), undefined);
    assert.ok(list.find((x) => x.name === 'AfterTool'));
  });

  it('clearHooks() removes all', () => {
    registerHook('BeforeTool', () => {});
    clearHooks();
    assert.strictEqual(listHooks().length, 0);
  });
});
