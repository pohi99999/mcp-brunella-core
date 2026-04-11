import { joinSession } from "@github/copilot-sdk/extension";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adapterPathDefault = path.join(__dirname, "adapter.js");
const geminiEntrypointDefault = process.env.GEMINI_ENTRYPOINT || "C:\\Users\\pohi9\\.gemini\\extensions\\conductor\\main.js";

let adapterProcess = null;

async function startAdapter(session) {
  const adapterPath = process.env.CONDUCTOR_ADAPTER_PATH || adapterPathDefault;
  const geminiEntrypoint = process.env.GEMINI_ENTRYPOINT || geminiEntrypointDefault;

  // Check if the Gemini entrypoint exists before spawning — avoids crashing
  // and corrupting the Copilot JSON-RPC protocol channel with error output.
  if (!existsSync(geminiEntrypoint)) {
    const msg = `[conductor-proxy] Gemini entrypoint not found: ${geminiEntrypoint} — adapter skipped`;
    try { await session.log(msg); } catch { process.stderr.write(msg + "\n"); }
    return null;
  }

  try {
    await session.log(`[conductor-proxy] starting adapter: ${adapterPath}`);
  } catch (e) {
    process.stderr.write(`[conductor-proxy] starting adapter: ${adapterPath}\n`);
  }

  // IMPORTANT: stdio must NOT be "inherit" — the adapter's stdout/stdin
  // would corrupt the Copilot extension JSON-RPC protocol channel.
  // Use 'ignore' for stdin/stdout, pipe only stderr so errors are visible.
  const child = spawn(process.execPath, [adapterPath], {
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, GEMINI_ENTRYPOINT: geminiEntrypoint },
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  child.on("exit", (code) => {
    const msg = `[conductor-proxy] adapter exited with code ${code}`;
    try { session.log(msg); } catch { process.stderr.write(msg + "\n"); }
  });
  child.on("error", (err) => {
    const msg = `[conductor-proxy] adapter failed to spawn: ${err && err.stack ? err.stack : err}`;
    try { session.log(msg); } catch { process.stderr.write(msg + "\n"); }
  });

  adapterProcess = child;
  return child;
}

// Join the Copilot CLI session so the CLI knows this extension is active
const session = await joinSession({
  hooks: {
    onSessionStart: async () => {
      try { await session.log("conductor-proxy extension loaded"); } catch { process.stderr.write("conductor-proxy extension loaded\n"); }
    },
  },
  tools: [],
});

// Start the adapter after joining the session
startAdapter(session).catch((err) => {
  const msg = `[conductor-proxy] failed to start adapter: ${err}`;
  try { session.log(msg); } catch { process.stderr.write(msg + "\n"); }
});

// Ensure adapter is cleaned up when session shuts down
session.on("session.shutdown", () => {
  if (adapterProcess) {
    try { adapterProcess.kill(); } catch (e) { process.stderr.write("[conductor-proxy] failed to stop adapter\n"); }
    adapterProcess = null;
  }
});

process.stderr.write("[conductor-proxy] initialized and waiting for session events\n");
