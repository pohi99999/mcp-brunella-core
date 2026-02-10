import { getEmbedding } from '../src/utils/rag.js';

async function runBenchmark() {
  console.log('Starting Embedding Benchmark...');

  const text = "This is a benchmark string to test embedding generation performance. Repeated calls should be cached.";
  const iterations = 5;
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    let embedding: number[] = [];
    try {
        embedding = await getEmbedding(text);
        if (i === 0 && embedding.every((v: number) => v === 0)) {
           console.warn('Warning: Embedding returned zero vector. Is Ollama running? Benchmark might be testing fallback logic.');
        }
    } catch (e: any) {
        console.error('Error fetching embedding:', e.message);
    }
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6; // Convert to milliseconds
    results.push(duration);
    console.log(`Iteration ${i + 1}: ${duration.toFixed(2)} ms`);
  }

  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  console.log(`Average time: ${avg.toFixed(2)} ms`);
  console.log('Benchmark Complete.');
}

runBenchmark().catch(console.error);
