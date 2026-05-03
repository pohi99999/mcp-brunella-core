import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const diffResult = spawnSync('git', [
  'diff',
  '--cached',
  '--name-only',
  '--diff-filter=ACM',
  '--',
  ':(glob)**/*.ts',
  ':(glob)**/*.tsx',
  ':(glob)**/*.js',
  ':(glob)**/*.jsx',
], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (diffResult.error) {
  throw diffResult.error;
}

if (diffResult.status !== 0) {
  throw new Error(diffResult.stderr || `git diff failed with exit code ${diffResult.status}`);
}

const stagedFiles = (diffResult.stdout ?? '')
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

if (stagedFiles.length === 0) {
  console.log('No staged TS/JS files to lint.');
  process.exit(0);
}

const eslintScript = path.resolve('node_modules/eslint/bin/eslint.js');
const chunkSize = 40;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

const batches = chunk(stagedFiles, chunkSize);
console.log(`Linting ${stagedFiles.length} staged TS/JS files in ${batches.length} batch(es).`);

for (const [index, batch] of batches.entries()) {
  console.log(`Lint batch ${index + 1}/${batches.length}: ${batch.length} file(s)`);
  execFileSync(process.execPath, [eslintScript, '--no-warn-ignored', ...batch], {
    stdio: 'inherit',
  });
}
