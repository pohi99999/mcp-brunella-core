import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "../src/config/index.js";
import { PythonShell } from "../src/utils/pythonShell.js";

// Logic to check if we have ANY valid python
const venvPy = path.resolve(
  config.workspaceRoot,
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python",
);
let hasPython = false;

try {
  execSync(`"${venvPy}" --version`, { stdio: "ignore" });
  hasPython = true;
} catch {
  try {
    execSync("python --version", { stdio: "ignore" });
    hasPython = true;
  } catch {
    hasPython = false;
  }
}

// Skip suite if no python environment found
describe.skipIf(!hasPython)("PythonShell", () => {
  // Disable API mode for tests - no FastAPI server running
  process.env.BRUNELLA_PYTHON_API_URL = "disabled";
  const shell = new PythonShell("interactive.py");

  it("should execute simple code via run()", async () => {
    const result = await shell.run("print(2 + 2)");
    expect(result).toMatch(/4/);
  }, 15000);

  it("should handle multi-line code", async () => {
    const code = `
def greet(name):
    return f"Hello, {name}"
print(greet("Brunella"))
`;
    const result = await shell.run(code);
    expect(result).toMatch(/Hello, Brunella/);
  }, 15000);

  it("should return error payload on Python exception", async () => {
    const result = await shell.run("print(undefined_variable)");
    const hasError = /error|NameError|undefined_variable/i.test(result);
    expect(hasError).toBe(true);
  }, 15000);
});
