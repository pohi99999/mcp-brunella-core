import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "@packages/utils/index.js";

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

describe("Python server security (myai/server.py)", () => {
  const serverPath = path.resolve(config.workspaceRoot, "myai", "server.py");

  it("should gate raw /execute behind the python execute env flag", () => {
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain("BRUNELLA_ENABLE_PYTHON_EXECUTE");
    expect(content).toContain('status_code=403');
    expect(content).toContain("MAX_DYNAMIC_CODE_SIZE");
  });

  it("should reuse runtime security helpers for harvest paths", () => {
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain("resolve_harvest_scenario_path");
    expect(content).toContain("resolve_json_schema_source");
  });

  it.skipIf(!hasPython)("should have valid Python syntax", () => {
    const result = execSync(`"${pythonCmd}" -m py_compile "${serverPath}"`, {
      encoding: "utf-8",
      timeout: 15000,
    });

    expect(result).toBe("");
  }, 15000);
});
