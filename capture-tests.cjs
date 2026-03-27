const { execSync } = require("child_process");
const fs = require("fs");
let stdout = "", stderr = "";
try {
  stdout = execSync('npx vitest run --reporter=verbose --exclude "test/cli-e2e*" --exclude "test/phase*" --exclude "test/swarm_smoke*"', {
    encoding: "utf8",
    timeout: 600000,
    maxBuffer: 50 * 1024 * 1024,
    env: Object.assign({}, process.env, { NO_COLOR: "1", FORCE_COLOR: "0" }),
    cwd: "f:\\mcp-brunella-core"
  });
} catch (e) {
  stdout = e.stdout || "";
  stderr = e.stderr || "";
}
fs.writeFileSync("f:\\mcp-brunella-core\\test-capture-result.txt", stdout);
fs.writeFileSync("f:\\mcp-brunella-core\\test-capture-stderr.txt", stderr);
console.log("stdout bytes: " + stdout.length);
console.log("stderr bytes: " + stderr.length);
