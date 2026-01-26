// scripts/index_knowledge.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import fs from "fs";

async function runIndexing() {
  console.log("🔍 Starting Knowledge Indexing...");

  const serverPath = path.resolve(__dirname, "../build/index.js");
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: { ...process.env, NODE_ENV: "test", WEB_UI_ENABLED: "0" }
  });

  const client = new Client({ name: "indexing-client", version: "1.0.0" }, { capabilities: {} });

  const filesToIndex = [
    "README.md",
    "mag.md",
    "INTEGRATION_PLAN.md",
    "conductor/product.md",
    "conductor/tech-stack.md",
    "conductor/workflow.md"
  ];

  try {
    await client.connect(transport);
    console.log("✅ Connected to MCP Server");

    for (const relativePath of filesToIndex) {
      const absolutePath = path.resolve(__dirname, "..", relativePath);
      
      if (!fs.existsSync(absolutePath)) {
        console.warn(`   ⚠️ File not found, skipping: ${relativePath}`);
        continue;
      }

      console.log(`   📄 Indexing: ${relativePath}...`);
      try {
        const result = await client.callTool({
          name: "knowledge_index_file",
          arguments: { path: absolutePath }
        });
        // @ts-ignore
        console.log(`      ✅ ${result.content[0].text}`);
      } catch (err: any) {
        console.error(`      ❌ Failed to index ${relativePath}: ${err.message}`);
      }
    }

    console.log("\n🎉 Indexing Process Completed!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Indexing Failed:", error);
    process.exit(1);
  }
}

runIndexing();
