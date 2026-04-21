import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "../src/config/index.js";

// Helper to find a working python interpreter
function getPythonCommand() {
  const venvPath = path.resolve(
    config.workspaceRoot,
    process.platform === "win32"
      ? ".venv/Scripts/python.exe"
      : ".venv/bin/python",
  );

  if (fs.existsSync(venvPath)) {
    return venvPath;
  }

  try {
    execSync("python3 --version", { stdio: "ignore" });
    return "python3";
  } catch {
    try {
      execSync("python --version", { stdio: "ignore" });
      return "python";
    } catch {
      return null;
    }
  }
}

const pythonCmd = getPythonCommand();
const hasPython = pythonCmd !== null;

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

  it("should gate python_execute behind the runtime security flag", () => {
    const serverPath = path.resolve(
      config.workspaceRoot,
      "myai",
      "mcp_server.py",
    );
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain("is_python_execute_enabled");
    expect(content).toContain("BRUNELLA_ENABLE_PYTHON_EXECUTE=1");
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

  it.skip("should be registered in mcp_servers.json as brunella-python", () => {
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

  it.skipIf(!hasPython)(
    "should have valid Python syntax",
    () => {
      const serverPath = path.resolve(
        config.workspaceRoot,
        "myai",
        "mcp_server.py",
      );
      // Use the detected python command
      // -m py_compile checks syntax without running
      const result = execSync(`"${pythonCmd}" -m py_compile "${serverPath}"`, {
        encoding: "utf-8",
        timeout: 15000,
      });
      // py_compile returns empty stdout on success
      expect(result).toBe("");
    },
    15000,
  );

  it("should expose screenshot and session_id in the browser chat response model", () => {
    const serverPath = path.resolve(
      config.workspaceRoot,
      "myai",
      "server.py",
    );
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toMatch(
      /class ChatResponse\(BaseModel\):[\s\S]*response: str[\s\S]*session_id: str[\s\S]*screenshot: Optional\[str\] = None/,
    );
  });

  it("should expose the /rag/query FastAPI contract used by ResearcherAgent", () => {
    const serverPath = path.resolve(
      config.workspaceRoot,
      "myai",
      "server.py",
    );
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain('class RAGQueryRequest(BaseModel):');
    expect(content).toContain("query: str");
    expect(content).toContain("limit: int = 5");
    expect(content).toContain("class RAGQueryResponse(BaseModel):");
    expect(content).toContain("results: List[RAGResultItem]");
    expect(content).toContain('@app.post("/rag/query", response_model=RAGQueryResponse)');
    expect(content).toContain("detail=\"RAG service unavailable: lancedb is not installed\"");
  });
});
