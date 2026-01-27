// scripts/search_knowledge.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

async function runSearch() {
  console.log("🔍 Testing Semantic Search...");

  const serverPath = path.resolve(__dirname, "../build/index.js");
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: { ...process.env, NODE_ENV: "test", WEB_UI_ENABLED: "0" }
  });

  const client = new Client({ name: "search-client", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    console.log("✅ Connected to MCP Server");

    const query = "What is the tech stack?";
    console.log(`   🔎 Query: "${query}"`);

    const result = await client.callTool({
      name: "knowledge_semantic_search",
      arguments: { query }
    });

    // @ts-ignore
    console.log(`\n   📄 Results:\n${result.content[0].text}`);

    console.log("\n🎉 Search Test Completed!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Search Failed:", error);
    process.exit(1);
  }
}

runSearch();
