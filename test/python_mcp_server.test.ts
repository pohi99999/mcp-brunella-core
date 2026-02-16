import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "../src/config/index.js";

// Helper to find valid python
let validPython = "";

const checkPython = (cmd: string): boolean => {
  try {
    execSync(`"${cmd}" --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

// 1. Try venv (only if file exists to avoid false positives with some shells)
const venvPath = path.resolve(
  config.workspaceRoot,
  process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python",
);

if (fs.existsSync(venvPath) && checkPython(venvPath)) {
  validPython = venvPath;
}
// 2. Try python3 (standard on Linux/macOS)
else if (checkPython("python3")) {
  validPython = "python3";
}
// 3. Try python (standard on Windows or some Linux)
else if (checkPython("python")) {
  validPython = "python";
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
    const servers = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const pythonServer = servers.find(
      (s: { name: string }) => s.name === "brunella-python",
    );

    expect(pythonServer).toBeDefined();
    expect(pythonServer.command).toBe("python");
    expect(pythonServer.args).toContain("-m");
    expect(pythonServer.args).toContain("myai.mcp_server");
  });

  it.skipIf(!validPython)(
    "should have valid Python syntax",
    () => {
      const serverPath = path.resolve(
        config.workspaceRoot,
        "myai",
        "mcp_server.py",
      );
      // Use the detected valid python
      const result = execSync(`"${validPython}" -m py_compile "${serverPath}"`, {
        encoding: "utf-8",
        timeout: 15000,
      });
      expect(result).toBe("");
    },
    15000,
  );
});
