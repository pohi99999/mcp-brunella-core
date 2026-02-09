import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const buildPath = path.join(process.cwd(), "build", "index.js");
const cliPath = path.join(process.cwd(), "build", "cli.js");
if (!fs.existsSync(buildPath)) {
  console.error("Build not found. Run: npm run build");
  process.exit(1);
}

function runCliSmoke() {
  if (!fs.existsSync(cliPath)) return true;
  const help = spawnSync(process.execPath, [cliPath, "--help"], { encoding: "utf8", cwd: process.cwd() });
  if (help.status !== 0) {
    console.error("CLI smoke: brunella --help failed");
    return false;
  }

  const config = spawnSync(process.execPath, [cliPath, "config", "list"], { encoding: "utf8", cwd: process.cwd() });
  if (config.status !== 0) {
    console.warn("CLI smoke: brunella config list skipped (command unavailable or failed)");
  } else {
    console.log("CLI smoke: --help and config list OK");
  }

  return true;
}

const serverEnv = {
  WEB_UI_ENABLED: process.env.WEB_UI_ENABLED || "1"
};

const trim = (v) => (typeof v === "string" ? v.trim() : v);

if (process.env.ANYTHINGLLM_BASE_URL) {
  serverEnv.ANYTHINGLLM_BASE_URL = trim(process.env.ANYTHINGLLM_BASE_URL);
}

if (process.env.ANYTHINGLLM_WORKSPACE) {
  serverEnv.ANYTHINGLLM_WORKSPACE = trim(process.env.ANYTHINGLLM_WORKSPACE);
}

if (process.env.ANYTHINGLLM_API_KEY) {
  serverEnv.ANYTHINGLLM_API_KEY = trim(process.env.ANYTHINGLLM_API_KEY);
}

if (process.env.PORT) {
  serverEnv.PORT = process.env.PORT;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [buildPath],
  cwd: process.cwd(),
  stderr: "pipe",
  env: serverEnv
});

if (transport.stderr) {
  transport.stderr.on("data", (chunk) => process.stderr.write(chunk));
}

const client = new Client({ name: "brunella-smoke", version: "1.0.0" });

function extractText(result) {
  if (result && Array.isArray(result.content)) {
    return result.content
      .map((item) => (item.type === "text" ? item.text : `[${item.type}]`))
      .join("\n");
  }
  return JSON.stringify(result, null, 2);
}

function findWorkspaceSlug(payload) {
  if (!payload) return "";
  const fromArray = (value) => {
    if (!Array.isArray(value) || value.length === 0) return "";
    return value[0]?.slug || value[0]?.workspace || value[0]?.id || "";
  };

  if (Array.isArray(payload)) return fromArray(payload);
  if (payload.workspaces) return fromArray(payload.workspaces);
  if (payload.data) return fromArray(payload.data);
  return "";
}

async function run() {
  let exitCode = 0;
  if (!runCliSmoke()) exitCode = 1;
  try {
    await client.connect(transport);
    await client.ping();
    console.log("Protocol ping: OK");

    const pingTool = await client.callTool({ name: "ping", arguments: {} });
    console.log("Tool ping response:\n", extractText(pingTool));

    const listResult = await client.callTool({
      name: "anythingllm_list_workspaces",
      arguments: {}
    });
    const listText = extractText(listResult);
    console.log("AnythingLLM workspaces:\n", listText);

    let workspaceSlug = process.env.ANYTHINGLLM_WORKSPACE?.trim();
    if (!workspaceSlug) {
      try {
        const parsed = JSON.parse(listText);
        workspaceSlug = findWorkspaceSlug(parsed);
      } catch {
        workspaceSlug = "";
      }
    }

    if (workspaceSlug) {
      const chatResult = await client.callTool({
        name: "anythingllm_chat",
        arguments: {
          workspace: workspaceSlug,
          message: "Smoke test ping from Brunella."
        }
      });
      console.log("AnythingLLM chat response:\n", extractText(chatResult));
    } else {
      console.warn("Skipping AnythingLLM chat: workspace slug not found.");
    }
  } catch (error) {
    exitCode = 1;
    console.error("Smoke test failed:", error?.message || error);
  } finally {
    try {
      await transport.close();
    } catch {
      // ignore
    }
  }

  process.exitCode = exitCode;
}

run();
