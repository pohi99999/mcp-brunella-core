import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';

const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', {
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

if (stagedFiles.length === 0) {
  console.log('No staged TS/JS files to lint.');
  process.exit(0);
}

console.log(`Linting staged files: ${stagedFiles.join(', ')}`);
const eslintScript = path.resolve('node_modules/eslint/bin/eslint.js');

execFileSync(process.execPath, [eslintScript, '--no-warn-ignored', ...stagedFiles], {
  stdio: 'inherit',
});
