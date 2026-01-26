// scripts/test_cli.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runCLITests() {
  console.log("🚀 Testing Brunella CLI...");

  const commands = [
    { cmd: "node build/cli.js --help", expect: "Brunella CLI" },
    { cmd: "node build/cli.js --version", expect: "1.0.0" },
    { cmd: "node build/cli.js tools --help", expect: "List available MCP tools" },
    { cmd: "node build/cli.js agents --help", expect: "List available agents" }
  ];

  let successCount = 0;

  for (const { cmd, expect } of commands) {
    console.log(`   🐘 Running: ${cmd}`);
    try {
      const { stdout } = await execAsync(cmd);
      if (stdout.includes(expect)) {
        console.log(`      ✅ Passed`);
        successCount++;
      } else {
        console.error(`      ❌ Failed (Expected content not found)`);
      }
    } catch (error: any) {
      console.error(`      ❌ Error: ${error.message}`);
    }
  }

  console.log(`
📊 Summary: ${successCount}/${commands.length} tests passed.`);
  
  if (successCount === commands.length) {
    console.log("🎉 CLI Validation Successful!");
    process.exit(0);
  } else {
    console.error("❌ CLI Validation Failed!");
    process.exit(1);
  }
}

runCLITests();
