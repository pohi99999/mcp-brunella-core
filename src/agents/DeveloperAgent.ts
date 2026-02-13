// FILE: src/agents/DeveloperAgent.ts
// PURPOSE: AI-powered development agent with self-healing capabilities
// VERSION: 2.0

import { IAgent, AgentResponse } from "./types.js";
import { logInfo, logError, setAgentStatus } from "../utils/logger.js";
import { globalPythonShell } from "../utils/pythonShell.js";
import { generateResponse } from "../core/llm_client.js";
import { getSpecStatus, requiresSpec } from "./specStatus.js";
import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

/**
 * DeveloperAgent 2.0 - Self-Healing AI Developer
 *
 * Capabilities:
 * - Code generation (TypeScript, Python, JavaScript)
 * - Automatic test generation (Vitest)
 * - Build & Test loop with auto-fix
 * - Error analysis and resolution
 * - Git operations (commit, branch)
 *
 * Uses: GPT-4o (GitHub Models) by default
 */
export class DeveloperAgent implements IAgent {
  name = "Developer";
  role = "AI Developer & Self-Healer";
  description =
    "Generates code, writes tests, fixes errors, and commits changes. Uses GPT-4o for intelligent code generation.";
  capabilities = [
    "generate_code",
    "write_tests",
    "fix_errors",
    "run_python",
    "git_commit",
    "self_heal",
  ];

  private llmProvider = process.env.LLM_PROVIDER || "github"; // GPT-4o default
  private maxRetries = 3;
  private buildTimeout = 120000; // 2 minutes

  async execute(task: string, context?: any): Promise<AgentResponse> {
    const taskDesc = task.length > 80 ? task.slice(0, 77) + "..." : task;
    setAgentStatus(this.name, "working", taskDesc);
    logInfo(this.name, `Processing: ${task}`);

    try {
      // ── SPEC GATE (RULE-SF1) ────────────────────────────────────
      // Block execution if a trackId is present and spec is not approved.
      // Skip check for SKIP_SPEC_CHECK env var (test environments).
      const trackId = context?.trackId as string | undefined;
      if (
        trackId &&
        requiresSpec(this.name) &&
        process.env.SKIP_SPEC_CHECK !== "true"
      ) {
        const specStatus = await getSpecStatus(trackId);
        if (specStatus !== "approved") {
          logInfo(
            this.name,
            `BLOCKED: Spec not approved for track '${trackId}' (status: ${specStatus})`,
          );
          return {
            status: "error",
            error: `SPEC_NOT_APPROVED: Track '${trackId}' spec is '${specStatus}'. Run SpecWriterAgent first.`,
            message: `Blocked by Spec Gate: spec status is '${specStatus}' for track '${trackId}'`,
          };
        }
        logInfo(this.name, `Spec gate PASSED for track '${trackId}'`);
      }
      // ── END SPEC GATE ───────────────────────────────────────────

      // Route to appropriate handler
      if (this.isCodeGenerationTask(task)) {
        return await this.handleCodeGeneration(task, context);
      } else if (this.isTestGenerationTask(task)) {
        return await this.handleTestGeneration(task, context);
      } else if (this.isFixTask(task)) {
        return await this.handleErrorFix(task, context);
      } else if (this.isPythonTask(task, context)) {
        return await this.handlePythonExecution(task, context);
      } else if (this.isGitTask(task)) {
        return await this.handleGitOperation(task, context);
      } else {
        // Generic: let LLM decide what to do
        return await this.handleGenericTask(task, context);
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Task failed: ${error}`);
      return { status: "error", error };
    } finally {
      setAgentStatus(this.name, "idle");
    }
  }

  // ==================== Task Type Detection ====================

  private isCodeGenerationTask(task: string): boolean {
    const keywords = [
      "generate",
      "create",
      "write",
      "implement",
      "add",
      "build",
      "make",
    ];
    const codeKeywords = [
      "function",
      "class",
      "component",
      "module",
      "api",
      "endpoint",
    ];
    return (
      keywords.some((k) => task.toLowerCase().includes(k)) &&
      codeKeywords.some((k) => task.toLowerCase().includes(k))
    );
  }

  private isTestGenerationTask(task: string): boolean {
    return /test|spec|vitest|jest/i.test(task);
  }

  private isFixTask(task: string): boolean {
    return /fix|repair|debug|error|bug|issue/i.test(task);
  }

  private isPythonTask(task: string, context?: any): boolean {
    return !!(
      context?.code ||
      task.includes("print(") ||
      task.includes("import ")
    );
  }

  private isGitTask(task: string): boolean {
    return /git|commit|push|branch|merge/i.test(task);
  }

  private formatPromptWithSystem(prompt: string, systemPrompt: string): string {
    return `System Prompt: ${systemPrompt}\n\nUser Prompt: ${prompt}`;
  }

  // ==================== Code Generation ====================

  private async handleCodeGeneration(
    task: string,
    context?: any,
  ): Promise<AgentResponse> {
    logInfo(this.name, "🔨 Code generation mode");

    const systemPrompt = `You are an expert TypeScript/JavaScript developer for the Brunella Agent System.
- Generate clean, production-ready code with proper types
- Follow ESM module syntax (use .js extensions in imports)
- Include JSDoc comments
- Handle errors properly
- Return ONLY the code, no explanations`;

    const prompt = `${task}

Context: ${JSON.stringify(context || {}, null, 2)}

Requirements:
1. ESM imports with .js extensions
2. Proper TypeScript types (no 'any')
3. Error handling with try/catch
4. Use logger.ts instead of console.log

Generate the code:`;

    try {
      const code = await generateResponse(
        this.formatPromptWithSystem(prompt, systemPrompt),
        this.llmProvider,
        "gpt-4o",
      );

      logInfo(this.name, `✅ Code generated (${code.length} chars)`);

      // Auto-save if file path provided
      if (context?.filePath) {
        const filePath = context.filePath as string;
        await this.saveCode(filePath, code);
        logInfo(this.name, `💾 Saved to: ${filePath}`);

        // Auto-test build
        const buildResult = await this.tryBuild();
        if (!buildResult.success) {
          logInfo(this.name, "⚠️ Build failed, attempting auto-fix...");
          return await this.selfHealBuild(
            code,
            buildResult.error || "Unknown error",
            filePath,
          );
        }
      }

      return {
        status: "success",
        data: { code, provider: this.llmProvider },
        message: "Code generated successfully",
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Code generation failed: ${error}`);
      return { status: "error", error };
    }
  }

  // ==================== Test Generation ====================

  private async handleTestGeneration(
    task: string,
    context?: any,
  ): Promise<AgentResponse> {
    logInfo(this.name, "🧪 Test generation mode");

    const systemPrompt = `You are an expert test engineer using Vitest.
- Generate comprehensive test suites
- Include edge cases and error scenarios
- Use describe/it/expect syntax
- Mock external dependencies
- Return ONLY the test code`;

    const prompt = `${task}

${context?.sourceCode ? `Source code to test:\n\`\`\`typescript\n${context.sourceCode}\n\`\`\`` : ""}

Generate Vitest test suite:`;

    try {
      const testCode = await generateResponse(
        this.formatPromptWithSystem(prompt, systemPrompt),
        this.llmProvider,
        "gpt-4o",
      );

      if (context?.testFilePath) {
        await this.saveCode(context.testFilePath, testCode);
        logInfo(this.name, `💾 Test saved to: ${context.testFilePath}`);

        // Run tests
        const testResult = await this.runTests(context.testFilePath);
        return {
          status: testResult.success ? "success" : "error",
          data: { testCode, testResult },
          message: testResult.success
            ? "Tests generated and passing"
            : "Tests generated but failing",
        };
      }

      return {
        status: "success",
        data: { testCode },
        message: "Test code generated",
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { status: "error", error };
    }
  }

  // ==================== Error Fixing ====================

  private async handleErrorFix(
    task: string,
    context?: any,
  ): Promise<AgentResponse> {
    logInfo(this.name, "🔧 Error fix mode");

    if (!context?.error && !context?.filePath) {
      return {
        status: "error",
        error: "Fix task requires 'error' or 'filePath' in context",
      };
    }

    const errorMessage = context.error || "Unknown error";
    const filePath = context.filePath;

    try {
      let sourceCode = "";
      if (filePath) {
        sourceCode = await fs.readFile(filePath, "utf-8");
      }

      const systemPrompt = `You are an expert debugger.
- Analyze the error and provide a fix
- Return ONLY the fixed code, no explanations
- Maintain the original structure and style`;

      const prompt = `Fix this error:

Error: ${errorMessage}

${sourceCode ? `Current code:\n\`\`\`typescript\n${sourceCode}\n\`\`\`` : ""}

${task}

Provide the fixed code:`;

      const fixedCode = await generateResponse(
        this.formatPromptWithSystem(prompt, systemPrompt),
        this.llmProvider,
        "gpt-4o",
      );

      if (filePath) {
        await this.saveCode(filePath, fixedCode);
        const buildResult = await this.tryBuild();

        return {
          status: buildResult.success ? "success" : "error",
          data: { fixedCode, buildSuccess: buildResult.success },
          message: buildResult.success
            ? "Fix applied and build successful"
            : "Fix applied but build still fails",
        };
      }

      return {
        status: "success",
        data: { fixedCode },
        message: "Fix generated",
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { status: "error", error };
    }
  }

  // ==================== Python Execution ====================

  private async handlePythonExecution(
    task: string,
    context?: any,
  ): Promise<AgentResponse> {
    logInfo(this.name, "🐍 Python execution mode");

    const code = context?.code || task;

    try {
      const result = await globalPythonShell.run(code);
      return {
        status: "success",
        data: { output: result },
        message: "Python code executed successfully",
      };
    } catch (e: any) {
      logError(this.name, `Python execution failed: ${e.message}`);
      return { status: "error", error: e.message };
    }
  }

  // ==================== Git Operations ====================

  private async handleGitOperation(
    task: string,
    context?: any,
  ): Promise<AgentResponse> {
    logInfo(this.name, "📦 Git operation mode");

    try {
      if (/commit/i.test(task)) {
        const message = context?.commitMessage || task;
        execSync(`git add -A && git commit -m "${message}"`, {
          encoding: "utf-8",
        });
        return {
          status: "success",
          message: `Committed: ${message}`,
        };
      } else if (/branch/i.test(task)) {
        const branchName = context?.branchName || `feature/${Date.now()}`;
        execSync(`git checkout -b ${branchName}`, { encoding: "utf-8" });
        return {
          status: "success",
          message: `Branch created: ${branchName}`,
        };
      } else {
        return {
          status: "error",
          error: "Unsupported git operation. Use 'commit' or 'branch'.",
        };
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { status: "error", error };
    }
  }

  // ==================== Generic Task ====================

  private async handleGenericTask(
    task: string,
    context?: any,
  ): Promise<AgentResponse> {
    logInfo(this.name, "🤖 Generic task mode - delegating to LLM");

    const systemPrompt = `You are the DeveloperAgent for the Brunella Agent System.
Analyze the task and provide a helpful response.
If code is needed, generate it. If explanation is needed, explain.`;

    try {
      const response = await generateResponse(
        this.formatPromptWithSystem(task, systemPrompt),
        this.llmProvider,
        "gpt-4o",
      );

      return {
        status: "success",
        data: { response },
        message: "Task processed",
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { status: "error", error };
    }
  }

  // ==================== Utilities ====================

  private async saveCode(filePath: string, code: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, code, "utf-8");
  }

  private async tryBuild(): Promise<{ success: boolean; error?: string }> {
    try {
      execSync("npm run build", {
        encoding: "utf-8",
        timeout: this.buildTimeout,
        stdio: "pipe",
      });
      return { success: true };
    } catch (e: any) {
      return {
        success: false,
        error: e.stdout || e.stderr || e.message,
      };
    }
  }

  private async runTests(
    testFile: string | undefined,
  ): Promise<{ success: boolean; output?: string }> {
    try {
      const cmd = testFile ? `npx vitest run ${testFile}` : "npm test";

      const output = execSync(cmd, {
        encoding: "utf-8",
        timeout: this.buildTimeout,
        stdio: "pipe",
      });

      return { success: true, output };
    } catch (e: any) {
      return {
        success: false,
        output: e.stdout || e.stderr || e.message,
      };
    }
  }

  // ==================== Self-Healing ====================

  private async selfHealBuild(
    originalCode: string,
    buildError: string,
    filePath: string,
  ): Promise<AgentResponse> {
    logInfo(this.name, "🔄 Self-healing build errors...");

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      logInfo(this.name, `Attempt ${attempt}/${this.maxRetries}`);

      const systemPrompt = `You are a TypeScript expert debugger.
Fix the build error. Return ONLY the corrected code.`;

      const prompt = `This code has a build error:

\`\`\`typescript
${originalCode}
\`\`\`

Build error:
${buildError}

Fix the code:`;

      try {
        const fixedCode = await generateResponse(
          this.formatPromptWithSystem(prompt, systemPrompt),
          this.llmProvider,
          "gpt-4o",
        );

        await this.saveCode(filePath, fixedCode);
        const buildResult = await this.tryBuild();

        if (buildResult.success) {
          logInfo(this.name, `✅ Build fixed on attempt ${attempt}`);
          return {
            status: "success",
            data: { code: fixedCode, fixAttempts: attempt },
            message: `Build auto-fixed after ${attempt} attempt(s)`,
          };
        }

        buildError = buildResult.error || "Unknown build error";
        originalCode = fixedCode;
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        logError(this.name, `Attempt ${attempt} failed: ${error}`);
      }
    }

    logError(
      this.name,
      `❌ Self-healing failed after ${this.maxRetries} attempts`,
    );
    return {
      status: "error",
      error: `Could not fix build after ${this.maxRetries} attempts. Last error: ${buildError}`,
      data: { lastCode: originalCode },
    };
  }
}

export default DeveloperAgent;
