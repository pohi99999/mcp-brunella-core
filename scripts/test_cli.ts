// scripts/test_cli.ts
// Aligned with current CLI: gemini-cli / Brunella entry (build/cli/index.js), commands chat, extension, run, conductor, connect, agent.
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runCLITests() {
  console.log("🚀 Testing CLI (build/cli/index.js)...");

  const cliPath = "node build/cli/index.js";
  const commands = [
    { cmd: `${cliPath} --help`, expect: "Usage:" },
    { cmd: `${cliPath} --version`, expect: "1.0.0" },
    { cmd: `${cliPath} agent --help`, expect: "Manage" },
    { cmd: `${cliPath} connect --help`, expect: "Connect" }
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
