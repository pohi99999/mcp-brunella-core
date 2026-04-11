#!/usr/bin/env node
/**
 * Conductor adapter: spawns the Gemini Conductor extension entrypoint as a child process.
 * Set GEMINI_ENTRYPOINT env var to the path of the Gemini extension main.js if different.
 * Example: C:\\Users\\pohi9\\.gemini\\extensions\\conductor\\main.js
 *
 * IMPORTANT: stdout must NOT be used for logging — this process's stdout may be
 * connected to the Copilot extension protocol channel. Use stderr only.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const entrypoint = process.env.GEMINI_ENTRYPOINT || "C:\\Users\\pohi9\\.gemini\\extensions\\conductor\\main.js";

if (!existsSync(entrypoint)) {
  process.stderr.write(`[conductor-adapter] Gemini entrypoint not found: ${entrypoint} — exiting cleanly\n`);
  process.exit(0);
}

process.stderr.write(`[conductor-adapter] starting Gemini entrypoint: ${entrypoint}\n`);

// Use stdio: ['ignore', 'ignore', 'pipe'] — do NOT inherit stdout/stdin
// as that would corrupt the Copilot extension JSON-RPC protocol channel.
const child = spawn(process.execPath, [entrypoint], {
  stdio: ["ignore", "ignore", "pipe"],
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.stderr.write(`[conductor-adapter] child terminated with signal ${signal}\n`);
    process.exit(1);
  } else {
    process.stderr.write(`[conductor-adapter] child exited with code ${code}\n`);
    process.exit(code ?? 0);
  }
});

child.on("error", (err) => {
  process.stderr.write(`[conductor-adapter] failed to spawn child: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
