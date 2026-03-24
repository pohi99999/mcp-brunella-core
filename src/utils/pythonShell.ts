import path from "path";
import fs from "fs/promises";
import { config } from "../config/index.js";
import { E2BSandboxManager } from "../security/e2b_sandbox_manager.js";
import { ExecuteResultSchema, validatePythonResponse } from "./pythonBridge.js";

export class PythonShell {
  private scriptPath: string;
  private pythonPath: string;
  private apiUrl: string;
  private useApi: boolean = true;

  constructor(scriptRelativePath: string) {
    this.scriptPath = path.resolve(config.workspaceRoot, scriptRelativePath);
    const venvRel =
      process.platform === "win32"
        ? ".venv/Scripts/python.exe"
        : ".venv/bin/python";
    const candidatePath = path.resolve(config.workspaceRoot, venvRel);
    this.apiUrl =
      process.env.BRUNELLA_PYTHON_API_URL ?? "http://127.0.0.1:8000";
    this.useApi = this.apiUrl !== "" && this.apiUrl !== "disabled";

    this.pythonPath = "python"; // Default fallback

    // Validate python path for legacy fallback - ONLY in Node environment
    if (typeof process !== 'undefined' && process.versions?.node) {
       this.validatePythonPath(candidatePath);
    }
  }

  private async validatePythonPath(candidatePath: string) {
    try {
      const { execSync } = await import("child_process");
      execSync(`"${candidatePath}" --version`, { stdio: "ignore" });
      this.pythonPath = candidatePath;
    } catch (e) {
      this.pythonPath = "python"; // Fallback
    }
  }

  /** Zone IV: Phoenix Protocol – retry on failure, then fallback. */
  async run(code: string, context?: any): Promise<string> {
    // E2B Sandbox mode: isolated cloud execution (highest security)
    if (process.env.E2B_ENABLED === 'true') {
      return this.runViaE2B(code);
    }

    if (this.useApi) {
      try {
        return await this.runViaApi(code, context);
      } catch (e) {
        // Phoenix: retry once after short delay
        await new Promise((r) => setTimeout(r, 1500));
        try {
          return await this.runViaApi(code, context);
        } catch (e2) {
          // Fallback to legacy subprocess
        }
      }
    }
    return this.runLegacy(code, context);
  }

  private async runViaE2B(code: string): Promise<string> {
    const sandbox = new E2BSandboxManager();
    const result = await sandbox.executeCode(code, { export_artifacts: false });
    if (!result.success) {
      return JSON.stringify({ error: result.error ?? 'E2B execution failed' });
    }
    return result.output ?? '';
  }

  private async runViaApi(code: string, context?: any): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.apiUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, context }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}: ${await response.text()}`,
        );
      }

      const data = (await response.json()) as Record<string, unknown>;

      // Zod validáció — típusbiztos Python válasz
      const validated = validatePythonResponse(ExecuteResultSchema, data, "/execute");
      if (validated.success) {
        const typed = validated.data;
        if (typed.error) {
          return JSON.stringify({ error: typed.error });
        }
        return typed.stdout;
      }
      // Graceful degradation: ha a séma nem stimmel, fallback a régi logikára
      const fallback = data as { stdout?: string; error?: string };
      if (fallback.error) {
        return JSON.stringify({ error: fallback.error });
      }
      return String(fallback.stdout ?? "");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async runLegacy(code: string, context?: any): Promise<string> {
    if (typeof process === 'undefined' || !process.versions?.node) {
        throw new Error("Legacy Python execution is only supported in Node.js environment");
    }

    const { exec } = await import("child_process");
    const root = config.workspaceRoot.replace(/\\/g, "/");
    const tempIn = path.join(config.systemLogDir, `py_in_${Date.now()}.json`);
    const tempPy = path.join(config.systemLogDir, `py_run_${Date.now()}.py`);

    try {
      await fs.mkdir(config.systemLogDir, { recursive: true });
    } catch (e) { /* non-critical */ } // Ignore if dir exists

    try {
      await fs.writeFile(tempIn, JSON.stringify(context || {}), "utf-8");

      // Indent the code to fit inside the try block
      const indentedCode = code
        .split("\n")
        .map((line) => "    " + line)
        .join("\n");

      const wrapperCode = `
import sys, json, os
import traceback

sys.path.append('${root}')

try:
    with open('${tempIn.replace(/\\/g, "/")}', 'r', encoding='utf-8') as f:
        context = json.load(f)
${indentedCode}
except Exception as e:
    traceback.print_exc()
    print(json.dumps({"error": str(e)}))
`;
      await fs.writeFile(tempPy, wrapperCode, "utf-8");

      return new Promise((resolve, reject) => {
        exec(
          `"${this.pythonPath}" "${tempPy}"`,
          { timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
          async (error, stdout, stderr) => {
            await fs.unlink(tempIn).catch(() => {});
            await fs.unlink(tempPy).catch(() => {});
            if (error) {
              // If output contains JSON error, prefer that
              if (stdout.trim().startsWith("{") && stdout.includes('"error"')) {
                resolve(stdout.trim());
                return;
              }
              reject(stderr || error.message);
              return;
            }
            resolve(stdout.trim());
          },
        );
      });
    } catch (e: any) {
      return JSON.stringify({ error: e.message });
    }
  }
}

export const globalPythonShell = new PythonShell("interactive.py");

/**
 * Runs a specific Python worker script with JSON arguments.
 */
export async function runPythonWorker(scriptName: string, args: any): Promise<any> {
  const code = `
import asyncio
import json
import sys
from importlib import import_module

# Add project root to path
sys.path.append('.')

async def main():
    module_name = "${scriptName.replace('.py', '').replace('/', '.')}"
    # Try different locations
    try:
        module = import_module(module_name)
    except ImportError:
        try:
            module = import_module("myai.workers." + module_name)
        except ImportError:
            module = import_module("myai.refiners." + module_name)
            
    # Look for common entry points
    if hasattr(module, 'scrape_page_data'):
        res = await module.scrape_page_data(**context)
    elif hasattr(module, 'evaluate_product_potential'):
        res = await module.evaluate_product_potential(context)
    elif hasattr(module, 'parse_invoice_text'):
        res = await module.parse_invoice_text(context.get('text', ''))
    else:
        raise AttributeError(f"No valid entry point found in {module_name}")
        
    print(json.dumps(res))

if __name__ == "__main__":
    asyncio.run(main())
`;
  const output = await globalPythonShell.run(code, args);
  try {
    const parsed: unknown = JSON.parse(output);
    // Zod validáció: ha error objektum, explicit jelezzük
    const errCheck = validatePythonResponse(
      ExecuteResultSchema,
      typeof parsed === "object" && parsed !== null && "stdout" in parsed ? parsed : { stdout: output },
      "runPythonWorker",
    );
    // A worker eredményt parseoljuk, nem ExecuteResult-ot
    return parsed;
  } catch (e) {
    throw new Error(`Failed to parse Python worker output: ${output}. Error: ${e}`);
  }
}
