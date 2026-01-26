// scripts/e2e_runner.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// Utility to run a test session against a specific server script
async function runTestSession(serverCommand: string, serverArgs: string[], testName: string, checks: (client: Client) => Promise<void>) {
    console.log(`\n🔌 Connecting to ${testName}...`);
    console.log(`   Command: ${serverCommand} ${serverArgs.join(" ")}`);

    const transport = new StdioClientTransport({
        command: serverCommand,
        args: serverArgs,
        env: { ...process.env, NODE_ENV: "test", WEB_UI_ENABLED: "0" } // Disable Web UI to avoid port conflicts
    });

    const client = new Client({ name: "e2e-test-client", version: "1.0.0" }, { capabilities: {} });

    try {
        await client.connect(transport);
        console.log(`   ✅ Connected to ${testName}`);
        await checks(client);
        console.log(`   🎉 ${testName} Tests Passed`);
    } catch (error) {
        console.error(`   ❌ ${testName} Failed:`, error);
        throw error;
    } finally {
        // Transport close might be needed ensuring process kill
        // The SDK might handle this, but let's be sure in a real scenario.
    }
}

async function runE2E() {
    console.log("🚀 Starting E2E Tests...");
    const nodeServerPath = path.resolve(__dirname, "../build/index.js");
    const pythonVenvPython = path.resolve(__dirname, "../.venv/Scripts/python.exe");
    const automationServerPath = path.resolve(__dirname, "../src/servers/automation.py");
    const googleServerPath = path.resolve(__dirname, "../src/servers/google_workspace.py");
    const vertexServerPath = path.resolve(__dirname, "../src/servers/vertex_ai.py");

    try {
        // ... (previous tests) ...

        // 3. Test Python Google Workspace Server
        await runTestSession(pythonVenvPython, ["-m", "src.servers.google_workspace"], "Python Google Workspace Server", async (client) => {
            const tools = await client.listTools();
            const toolNames = tools.tools.map(t => t.name);
            console.log(`      ℹ Found ${tools.tools.length} tools: ${toolNames.join(", ")}`);

            if (!toolNames.includes("gmail_send_email")) throw new Error("Missing 'gmail_send_email'");
            if (!toolNames.includes("drive_list_files")) throw new Error("Missing 'drive_list_files'");
        });

        // 4. Test Python Vertex AI Server
        await runTestSession(pythonVenvPython, ["-m", "src.servers.vertex_ai"], "Python Vertex AI Server", async (client) => {
            const tools = await client.listTools();
            const toolNames = tools.tools.map(t => t.name);
            console.log(`      ℹ Found ${tools.tools.length} tools: ${toolNames.join(", ")}`);

            if (!toolNames.includes("vertex_generate_content")) throw new Error("Missing 'vertex_generate_content'");
        });

        console.log("\n✅✅✅ All Systems Operational ✅✅✅");
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Global Test Failure");
        process.exit(1);
    }
}

runE2E();