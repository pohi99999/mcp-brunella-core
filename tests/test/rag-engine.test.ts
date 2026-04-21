import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HybridMemory, RagEngine } from '../src/utils/rag.js';

const ragHarness = vi.hoisted(() => ({
  embeddings: vi.fn(),
  searchText: vi.fn(),
  upsertText: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: ragHarness.logInfo,
  logWarn: ragHarness.logWarn,
  logError: ragHarness.logError,
}));

vi.mock('../src/utils/aiGateway.js', () => ({
  aiGateway: {
    embeddings: ragHarness.embeddings,
  },
}));

vi.mock('../src/utils/vectorize.js', () => ({
  vectorizeClient: {
    getStatus: vi.fn(() => ({ enabled: false })),
    upsertText: ragHarness.upsertText,
    searchText: ragHarness.searchText,
  },
}));

function createBatch(rows: Array<{ text: string; path?: string }>) {
  return {
    numRows: rows.length,
    schema: {
      fields: rows.some((row) => typeof row.path === 'string') ? [{ name: 'path' }] : [],
    },
    getChild(name: string) {
      return {
        get(index: number) {
          const row = rows[index];
          if (!row) return undefined;
          return name === 'text' ? row.text : row.path;
        },
      };
    },
  };
}

function createQuery(rows: Array<{ text: string; path?: string }>) {
  const query = {
    filter: vi.fn(() => query),
    limit: vi.fn(() => query),
    toArray: vi.fn(async () => rows),
    [Symbol.asyncIterator]: async function* () {
      yield createBatch(rows);
    },
  };

  return query;
}

function createFakeDb(rows: Array<{ text: string; path?: string }>) {
  const tableNames = [
    process.env.RAG_PRIMARY_TABLE || 'memory_v2_mxbai',
    process.env.RAG_LEGACY_TABLE || 'memory',
  ];
  const table = {
    add: vi.fn(async () => undefined),
    countRows: vi.fn(async () => rows.length),
    query: vi.fn(() => createQuery(rows)),
    vectorSearch: vi.fn(() => createQuery(rows)),
  };

  return {
    table,
    tableNames: vi.fn(async () => tableNames),
    openTable: vi.fn(async () => table),
    createTable: vi.fn(async () => table),
  };
}

describe('RagEngine lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ragHarness.embeddings.mockResolvedValue(new Array(100).fill(1));
  });

  it('caches the LanceDB module and connection until dispose() is called', async () => {
    const rows = [{ text: 'hello from rag engine', path: 'doc-1' }];
    const fakeDb = createFakeDb(rows);
    const connect = vi.fn(async () => fakeDb);
    const loadLanceDBModule = vi.fn(async () => ({ connect }));

    const engine = new RagEngine({
      dbPath: './data/test-rag',
      loadLanceDBModule,
    });

    const first = await engine.getTableCount();
    const second = await engine.getTableCount();

    expect(first).toBe(1);
    expect(second).toEqual(first);
    expect(loadLanceDBModule).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith('./data/test-rag');

    await engine.dispose();

    const third = await engine.getTableCount();
    expect(third).toEqual(first);
    expect(loadLanceDBModule).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('keeps HybridMemory compatible as a RagEngine subclass', () => {
    const legacy = new HybridMemory('./data/legacy-rag');

    expect(legacy).toBeInstanceOf(RagEngine);
    expect(typeof legacy.search).toBe('function');
    expect(typeof legacy.addDocument).toBe('function');
    expect(typeof legacy.dispose).toBe('function');
  });
});
