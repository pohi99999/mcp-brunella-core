import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Use tsx to run the source directly
const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/index.ts"],
  cwd: projectRoot,
  env: {
      ...process.env,
      WEB_UI_ENABLED: "0"
  }
});

const client = new Client({ name: "jules-qa-agent", version: "1.0.0" });

function extractText(result) {
  if (result && Array.isArray(result.content)) {
    return result.content
      .map((item) => (item.type === "text" ? item.text : `[${item.type}]`))
      .join("\n");
  }
  return JSON.stringify(result, null, 2);
}

async function run() {
  console.log("=== Jules Scenario 1: System Health Check (via tsx) ===");
  try {
    await client.connect(transport);
    console.log("SUCCESS: Connected to MCP Server.");

    // Step 1: monitor_get_metrics
    console.log("\nStep 1: Checking system metrics...");
    const metricsResult = await client.callTool({ name: "monitor_get_metrics", arguments: {} });
    const metricsText = extractText(metricsResult);
    console.log("Metrics Output:", metricsText);
    
    const metrics = JSON.parse(metricsText);
    if (metrics.uptime >= 0) {
        console.log(`SUCCESS: System uptime is ${metrics.uptime.toFixed(2)}s`);
    } else {
        console.error("FAILURE: System uptime is not valid.");
    }

    // Step 2: agent_list
    console.log("\nStep 2: Verifying Agent Registry...");
    const agentsResult = await client.callTool({ name: "agent_list", arguments: {} });
    const agentsText = extractText(agentsResult);
    console.log("Agents Output:", agentsText);
    
    const agents = JSON.parse(agentsText);
    const agentNames = agents.map(a => a.name);
    console.log("Registered Agents:", agentNames.join(", "));
    
    if (agentNames.includes('researcher') && agentNames.includes('developer')) {
        console.log("SUCCESS: Core agents are registered.");
    } else {
        console.error("FAILURE: Missing core agents.");
    }

    console.log("\n=== Scenario 1 PASSED ===");
  } catch (error) {
    console.error("\n=== Scenario 1 FAILED ===");
    console.error(error?.message || error);
    process.exit(1);
  } finally {
    try {
      await transport.close();
    } catch {
      // ignore
    }
  }
}

run();
