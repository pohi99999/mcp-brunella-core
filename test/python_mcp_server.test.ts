import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "../src/config/index.js";

// Check for Python environment
const venvPy = path.resolve(
  config.workspaceRoot,
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python",
);
let pythonCmd = "";
let hasPython = false;

try {
  // 1. Try Virtual Environment
  execSync(`"${venvPy}" --version`, { stdio: "ignore" });
  pythonCmd = venvPy;
  hasPython = true;
} catch {
  try {
    // 2. Try 'python' (system)
    execSync("python --version", { stdio: "ignore" });
    pythonCmd = "python";
    hasPython = true;
  } catch {
    try {
        // 3. Try 'python3' (system fallback)
        execSync("python3 --version", { stdio: "ignore" });
        pythonCmd = "python3";
        hasPython = true;
    } catch {
        hasPython = false;
    }
  }
}

describe("Python MCP Server (myai/mcp_server.py)", () => {
  it("should exist as a file", () => {
    const serverPath = path.resolve(
      config.workspaceRoot,
      "myai",
      "mcp_server.py",
    );
    expect(fs.existsSync(serverPath)).toBe(true);
  });

  it("should contain FastMCP import and tool definitions", () => {
    const serverPath = path.resolve(
      config.workspaceRoot,
      "myai",
      "mcp_server.py",
    );
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain("from fastmcp import FastMCP");
    expect(content).toContain("@mcp.tool()");
    expect(content).toContain("def python_execute");
    expect(content).toContain("def data_refine");
    expect(content).toContain("def rag_search");
    expect(content).toContain("def harvest_scenario");
    expect(content).toContain("def harvest_extract");
    expect(content).toContain("def system_health");
  });

  it("should define stdio and sse transport modes", () => {
    const serverPath = path.resolve(
      config.workspaceRoot,
      "myai",
      "mcp_server.py",
    );
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain('"stdio"');
    expect(content).toContain('"sse"');
    expect(content).toContain("mcp.run(transport=");
  });

  it("should have a main() entry point", () => {
    const serverPath = path.resolve(
      config.workspaceRoot,
      "myai",
      "mcp_server.py",
    );
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain("def main():");
    expect(content).toContain('if __name__ == "__main__"');
  });

  it("should be registered in mcp_servers.json as brunella-python", () => {
    const configPath = path.resolve(config.workspaceRoot, "mcp_servers.json");
    if (fs.existsSync(configPath)) {
        const servers = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const pythonServer = servers.find(
          (s: { name: string }) => s.name === "brunella-python",
        );

        expect(pythonServer).toBeDefined();
        // command could be python or python3 depending on env, so we just check it exists
        expect(pythonServer.command).toMatch(/python3?/);
        expect(pythonServer.args).toContain("-m");
        expect(pythonServer.args).toContain("myai.mcp_server");
    }
  });

  // Skip if no python detected
  (hasPython ? it : it.skip)(
    "should have valid Python syntax",
    () => {
      const serverPath = path.resolve(
        config.workspaceRoot,
        "myai",
        "mcp_server.py",
      );

      // Use the detected command (venv or system)
      try {
        // -m py_compile checks syntax without running main
        execSync(`"${pythonCmd}" -m py_compile "${serverPath}"`, {
            encoding: "utf-8",
            timeout: 15000,
            stdio: 'pipe'
          });
      } catch (error: any) {
         // Fail the test if syntax check fails
         // If py_compile finds syntax errors, it exits with non-zero
        throw new Error(`Python syntax check failed:\n${error.stderr || error.message}`);
      }
    },
    15000,
  );
});
