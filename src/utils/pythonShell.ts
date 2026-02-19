import path from "path";
import { config } from "../config/index.js";
import { resolvePythonPath } from "./pythonUtils.js";

export class PythonShell {
  private scriptPath: string;
  private pythonPath: string;
  private apiUrl: string;
  private useApi: boolean = true;

  constructor(scriptRelativePath: string) {
    this.scriptPath = path.resolve(config.workspaceRoot, scriptRelativePath);
    this.apiUrl =
      process.env.BRUNELLA_PYTHON_API_URL ?? "http://127.0.0.1:8000";
    this.useApi = this.apiUrl !== "" && this.apiUrl !== "disabled";

    this.pythonPath = "python"; // Default fallback

    // Validate python path for legacy fallback - ONLY in Node environment
    if (typeof process !== 'undefined' && process.versions?.node) {
       resolvePythonPath(config.workspaceRoot).then((p) => {
         this.pythonPath = p;
       });
    }
  }

  /** Zone IV: Phoenix Protocol – retry on failure, then fallback. */
  async run(code: string, context?: any): Promise<string> {
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

      const data = (await response.json()) as {
        stdout: string;
        error?: string;
      };
      if (data.error) {
        // If the python code itself threw an exception, we want to return that as the result string
        // just like the legacy shell does (it prints the error json)
        // However, our server returns { stdout: "", error: "..." }
        // Legacy wrapper printed: print(json.dumps({"error": str(e)}))
        return JSON.stringify({ error: data.error });
      }
      return data.stdout;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async runLegacy(code: string, context?: any): Promise<string> {
    if (typeof process === 'undefined' || !process.versions?.node) {
        throw new Error("Legacy Python execution is only supported in Node.js environment");
    }

    const { exec } = await import("child_process");
    const fs = (await import("fs")).promises;

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
