import { describe, it, expect, vi } from 'vitest';

// Mock types to match the script
interface MigrateItem {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

// Simulated delay to represent network API call
const API_DELAY = 50;

async function mockUpsertText(id: string, text: string, metadata: Record<string, unknown>): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, API_DELAY));
  return true;
}

// Sequential implementation (Current)
async function processBatchSequential(items: MigrateItem[]): Promise<number> {
  let successCount = 0;
  for (const item of items) {
    try {
      const success = await mockUpsertText(item.id, item.text, item.metadata);
      if (success) {
        successCount++;
      }
    } catch (e: any) {
      // Mock logging
    }
  }
  return successCount;
}

// Parallel implementation (Optimized)
async function processBatchParallel(items: MigrateItem[]): Promise<number> {
  const results = await Promise.allSettled(
    items.map(item => mockUpsertText(item.id, item.text, item.metadata))
  );

  let successCount = 0;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value) {
        successCount++;
      }
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      // Mock logging
    }
  });

  return successCount;
}

describe('Migration Performance Benchmark', () => {
  const BATCH_SIZE = 50;
  const items: MigrateItem[] = Array.from({ length: BATCH_SIZE }, (_, i) => ({
    id: `id-${i}`,
    text: `text-${i}`,
    metadata: { i }
  }));

  it('Sequential Baseline', async () => {
    const start = Date.now();
    const count = await processBatchSequential(items);
    const end = Date.now();
    const duration = end - start;
    
    console.log(`Sequential: ${duration}ms for ${BATCH_SIZE} items`);
    expect(count).toBe(BATCH_SIZE);
    // 50 items * 50ms = 2500ms baseline
    expect(duration).toBeGreaterThanOrEqual(BATCH_SIZE * API_DELAY);
  });

  it('Parallel Optimized', async () => {
    const start = Date.now();
    const count = await processBatchParallel(items);
    const end = Date.now();
    const duration = end - start;
    
    console.log(`Parallel: ${duration}ms for ${BATCH_SIZE} items`);
    expect(count).toBe(BATCH_SIZE);
    // Should be much faster, ideally close to API_DELAY (plus overhead)
    expect(duration).toBeLessThan(BATCH_SIZE * API_DELAY);
  });
});
