import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import os from 'os';

const TEMP_DIR = path.join(os.tmpdir(), 'benchmark_files_route');
const FILE_COUNT = 5000;

async function setup() {
    if (fs.existsSync(TEMP_DIR)) {
        await fs.promises.rm(TEMP_DIR, { recursive: true, force: true });
    }
    await fs.promises.mkdir(TEMP_DIR);
    console.log(`Creating ${FILE_COUNT} files in ${TEMP_DIR}...`);
    const promises = [];
    for (let i = 0; i < FILE_COUNT; i++) {
        promises.push(fs.promises.writeFile(path.join(TEMP_DIR, `file_${i}.txt`), 'some content'));
    }
    await Promise.all(promises);
}

async function cleanup() {
    await fs.promises.rm(TEMP_DIR, { recursive: true, force: true });
}

// Blocking implementation
async function currentImplementation(fullPath: string, relPath: string) {
    const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
    // This part is synchronous and blocking
    const files = entries.map(entry => {
        const stats = fs.statSync(path.join(fullPath, entry.name));
        return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            path: path.join(relPath, entry.name).replace(/\\/g, '/'),
            size: entry.isFile() ? stats.size : 0,
            modified: stats.mtime
        };
    });
    return files;
}

// Non-blocking implementation (Promise.all)
async function optimizedImplementation(fullPath: string, relPath: string) {
    const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
    // This part is asynchronous
    const files = await Promise.all(entries.map(async entry => {
        const stats = await fs.promises.stat(path.join(fullPath, entry.name));
        return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            path: path.join(relPath, entry.name).replace(/\\/g, '/'),
            size: entry.isFile() ? stats.size : 0,
            modified: stats.mtime
        };
    }));
    return files;
}

// Batched implementation
async function batchedImplementation(fullPath: string, relPath: string) {
    const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
    const files = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async entry => {
            const stats = await fs.promises.stat(path.join(fullPath, entry.name));
            return {
                name: entry.name,
                isDirectory: entry.isDirectory(),
                path: path.join(relPath, entry.name).replace(/\\/g, '/'),
                size: entry.isFile() ? stats.size : 0,
                modified: stats.mtime
            };
        }));
        files.push(...batchResults);
    }
    return files;
}

async function measureBlocking(fn: () => Promise<any>, name: string) {
    return new Promise<void>((resolve) => {
        let maxDelay = 0;
        let lastTime = performance.now();

        const interval = setInterval(() => {
            const now = performance.now();
            const diff = now - lastTime;
            // Expected 10ms. If diff is 100ms, delay is 90ms.
            const delay = diff - 10;
            if (delay > maxDelay) maxDelay = delay;
            lastTime = now;
        }, 10);

        fn().then(() => {
            clearInterval(interval);
            console.log(`${name} Max Loop Delay: ${maxDelay.toFixed(2)} ms`);
            resolve();
        });
    });
}


async function runBenchmark() {
    await setup();

    const relPath = '.';
    const fullPath = TEMP_DIR;

    console.log('Running Warmup...');
    // Warmup
    await currentImplementation(fullPath, relPath);
    await optimizedImplementation(fullPath, relPath);
    await batchedImplementation(fullPath, relPath);

    console.log('\n--- Single Request Latency ---');

    const start1 = performance.now();
    await currentImplementation(fullPath, relPath);
    const end1 = performance.now();
    console.log(`Current (Sync): ${(end1 - start1).toFixed(2)} ms`);

    const start2 = performance.now();
    await optimizedImplementation(fullPath, relPath);
    const end2 = performance.now();
    console.log(`Optimized (Async): ${(end2 - start2).toFixed(2)} ms`);

    const start3 = performance.now();
    await batchedImplementation(fullPath, relPath);
    const end3 = performance.now();
    console.log(`Batched (Async): ${(end3 - start3).toFixed(2)} ms`);

    console.log('\n--- Event Loop Blocking Test ---');

    await measureBlocking(() => currentImplementation(fullPath, relPath), 'Current (Sync)');
    await measureBlocking(() => optimizedImplementation(fullPath, relPath), 'Optimized (Async)');
    await measureBlocking(() => batchedImplementation(fullPath, relPath), 'Batched (Async)');

    await cleanup();
}

runBenchmark().catch(console.error);
