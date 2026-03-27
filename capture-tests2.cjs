const { execSync } = require("child_process");
const fs = require("fs");
console.log("Script starting...");
let stdout = "", stderr = "";
try {
  stdout = execSync("npx vitest run --config vitest.config.ts --reporter=json", {
    encoding: "utf8",
    timeout: 300000,
    cwd: "f:\\mcp-brunella-core"
  });
  console.log("execSync completed normally");
} catch (e) {
  console.log("execSync threw, status:", e.status);
  stdout = e.stdout || "";
  stderr = e.stderr || "";
}
console.log("stdout bytes: " + stdout.length);
console.log("stderr bytes: " + stderr.length);
fs.writeFileSync("f:\\mcp-brunella-core\\test-json-results.json", stdout);
console.log("Done writing files");
