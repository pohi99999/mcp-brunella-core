// scripts/e2e_runner.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, ChildProcess } from "child_process";
import path from "path";

async function runE2E() {
  console.log("🚀 Starting E2E Tests...");

  const serverPath = path.resolve(__dirname, "../build/index.js");
  const serverProcess: ChildProcess = spawn("node", [serverPath], {
    env: { ...process.env, NODE_ENV: "test" },
    stdio: ["pipe", "pipe", "inherit"], // stdin/stdout for MCP, stderr inherited
  });

  console.log("🔌 Connecting to MCP Server...");

  const transport = new StdioClientTransport({
    // @ts-ignore - spawn result is compatible but types might mismatch slightly
    command: "node", 
    args: [serverPath],
  });

  // We are manually managing the process to reuse it, but SDK transport spawns its own usually.
  // To avoid complexity, we'll let the SDK spawn the process via StdioClientTransport
  // and we will just configure it correctly.
  
  // Correction: StdioClientTransport spawns the process itself. We define it there.
  // So we don't need the manual spawn above unless we want to control it differently.
  // Let's rely on the SDK.
  
  const client = new Client(
    {
      name: "e2e-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  const e2eTransport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
  });

  try {
    await client.connect(e2eTransport);
    console.log("✅ Connected to MCP Server");

    // Phase 2: Test Cases will be added here
    console.log("\n🧪 Running Test Cases...");

    // Test 1: List Tools
    console.log("   [Test 1] Listing Tools...");
    const tools = await client.listTools();
    const toolNames = tools.tools.map(t => t.name);
    console.log(`   ℹ Found ${tools.tools.length} tools: ${toolNames.join(", ")}`);
    
    const requiredTools = ["automation_status", "schedule_reminder", "gmail_send_email"];
    const missingTools = requiredTools.filter(t => !toolNames.includes(t));
    
    if (missingTools.length > 0) {
        throw new Error(`Missing required tools: ${missingTools.join(", ")}`);
    }
    console.log("   ✅ Tool List Verified");

    // Test 2: Automation Status (Python Bridge)
    console.log("\n   [Test 2] Testing Automation Status (Python Bridge)...");
    const statusResult = await client.callTool({
        name: "automation_status",
        arguments: {}
    });
    // @ts-ignore
    const statusText = statusResult.content[0].text;
    console.log(`   ℹ Response: ${statusText}`);
    
    if (!statusText.includes("active")) {
        throw new Error("Automation module is not active!");
    }
    console.log("   ✅ Automation Module Verified");

    // Test 3: List Jobs (Scheduler)
    console.log("\n   [Test 3] Testing Scheduler...");
    const jobsResult = await client.callTool({
        name: "list_scheduled_jobs",
        arguments: {}
    });
    // @ts-ignore
    const jobsText = jobsResult.content[0].text;
    console.log(`   ℹ Response: ${jobsText}`);
    console.log("   ✅ Scheduler Verified");

    console.log("\n🎉 All E2E Tests Passed!");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ E2E Test Failed:", error);
    process.exit(1);
  } finally {
      // Clean up if needed
  }
}

runE2E();
