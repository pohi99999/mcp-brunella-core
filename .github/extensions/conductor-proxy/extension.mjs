import { joinSession } from "@github/copilot-sdk/extension";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adapterPathDefault = path.join(__dirname, "adapter.js");
const geminiEntrypointDefault = process.env.GEMINI_ENTRYPOINT || "C:\\Users\\pohi9\\.gemini\\extensions\\conductor\\main.js";

let adapterProcess = null;

async function startAdapter(session) {
  const adapterPath = process.env.CONDUCTOR_ADAPTER_PATH || adapterPathDefault;
  try {
    await session.log(`[conductor-proxy] starting adapter: ${adapterPath}`);
  } catch (e) {
    // session.log may fail if session not available; fallback to console
    console.log(`[conductor-proxy] starting adapter: ${adapterPath}`);
  }

  const child = spawn(process.execPath, [adapterPath], {
    stdio: "inherit",
    env: { ...process.env, GEMINI_ENTRYPOINT: process.env.GEMINI_ENTRYPOINT || geminiEntrypointDefault },
  });

  child.on("exit", (code) => {
    try { session.log(`[conductor-proxy] adapter exited with code ${code}`); } catch { console.log(`[conductor-proxy] adapter exited with code ${code}`); }
  });
  child.on("error", (err) => {
    try { session.log(`[conductor-proxy] adapter failed to spawn: ${err && err.stack ? err.stack : err}`); } catch { console.error(err); }
  });

  adapterProcess = child;
  return child;
}

// Join the Copilot CLI session so the CLI knows this extension is active
const session = await joinSession({
  hooks: {
    onSessionStart: async () => {
      try { await session.log("conductor-proxy extension loaded"); } catch { console.log("conductor-proxy extension loaded"); }
    },
  },
  tools: [],
});

// Start the adapter after joining the session
startAdapter(session).catch((err) => {
  try { session.log(`[conductor-proxy] failed to start adapter: ${err}`); } catch { console.error(err); }
});

// Ensure adapter is cleaned up when session shuts down
session.on("session.shutdown", () => {
  if (adapterProcess) {
    try { adapterProcess.kill(); } catch (e) { console.warn("[conductor-proxy] failed to stop adapter", e); }
    adapterProcess = null;
  }
});

// Keep the process alive by listening to events — the joinSession promise keeps the process running
console.log("[conductor-proxy] initialized and waiting for session events");
