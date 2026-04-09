#!/usr/bin/env node
/**
 * Conductor adapter: spawns the Gemini Conductor extension entrypoint as a child process.
 * Set GEMINI_ENTRYPOINT env var to the path of the Gemini extension main.js if different.
 * Example: C:\\Users\\pohi9\\.gemini\\extensions\\conductor\\main.js
 */

const { spawn } = require('child_process');
const path = require('path');

const entrypoint = process.env.GEMINI_ENTRYPOINT || 'C:\\Users\\pohi9\\.gemini\\extensions\\conductor\\main.js';
console.log(`[conductor-adapter] starting Gemini entrypoint: ${entrypoint}`);

const child = spawn(process.execPath, [entrypoint], { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[conductor-adapter] child terminated with signal ${signal}`);
    process.exit(1);
  } else {
    console.log(`[conductor-adapter] child exited with code ${code}`);
    process.exit(code || 0);
  }
});

child.on('error', (err) => {
  console.error(`[conductor-adapter] failed to spawn child: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
