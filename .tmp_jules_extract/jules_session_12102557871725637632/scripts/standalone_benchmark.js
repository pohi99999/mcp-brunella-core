// Standalone benchmark for migration optimization
const BATCH_SIZE = 50;
const API_DELAY = 50;

async function mockUpsertText(id, text, metadata) {
  return new Promise(resolve => setTimeout(() => resolve(true), API_DELAY));
}

async function processBatchSequential(items) {
  let successCount = 0;
  for (const item of items) {
    try {
      const success = await mockUpsertText(item.id, item.text, item.metadata);
      if (success) {
        successCount++;
      }
    } catch (e) {
    }
  }
  return successCount;
}

async function processBatchParallel(items) {
  const results = await Promise.allSettled(
    items.map(item => mockUpsertText(item.id, item.text, item.metadata))
  );

  let successCount = 0;
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      successCount++;
    }
  });

  return successCount;
}

async function run() {
  const items = Array.from({ length: BATCH_SIZE }, (_, i) => ({
    id: `id-${i}`,
    text: `text-${i}`,
    metadata: { i }
  }));

  console.log(`--- Benchmarking Batch Size: ${BATCH_SIZE}, API Delay: ${API_DELAY}ms ---`);

  // Sequential
  const startSeq = Date.now();
  await processBatchSequential(items);
  const durationSeq = Date.now() - startSeq;
  console.log(`Sequential implementation: ${durationSeq}ms`);

  // Parallel
  const startPar = Date.now();
  await processBatchParallel(items);
  const durationPar = Date.now() - startPar;
  console.log(`Parallel implementation: ${durationPar}ms`);

  const speedup = (durationSeq / durationPar).toFixed(2);
  console.log(`Speedup: ${speedup}x`);
}

run().catch(console.error);
