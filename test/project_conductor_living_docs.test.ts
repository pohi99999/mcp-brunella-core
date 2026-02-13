import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

vi.mock("../src/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

type CoverageUpdateResult = {
  success: boolean;
  data: {
    coverage: number;
    bootstrappedDocs: number;
    documentedCount: number;
    outputPath: string;
  };
};

type ProjectConductorCtor = new () => {
  updateAgentDocumentationCoverage: () => Promise<CoverageUpdateResult>;
};

describe("ProjectConductor Living Documentation", () => {
  let originalCwd: string;
  let testRoot: string;
  let ProjectConductorAgent: ProjectConductorCtor;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pc-living-docs-"));

    await fs.mkdir(path.join(testRoot, "conductor"), { recursive: true });
    await fs.mkdir(path.join(testRoot, "src", "agents"), { recursive: true });

    await fs.writeFile(
      path.join(testRoot, "src", "agents", "BaseAgent.ts"),
      "export class BaseAgent {}\n",
      "utf-8",
    );

    await fs.writeFile(
      path.join(testRoot, "src", "agents", "AlphaAgent.ts"),
      `
        export class AlphaAgent {
          name = "Alpha";
          role = "Alpha Role";
          description = "Alpha description";
          capabilities = ["research", "synthesis"];
        }
      `,
      "utf-8",
    );

    await fs.writeFile(
      path.join(testRoot, "src", "agents", "BetaAgent.ts"),
      `
        export class BetaAgent {
          name = "Beta";
          role = "Beta Role";
        }
      `,
      "utf-8",
    );

    process.chdir(testRoot);
    vi.resetModules();

    const imported = await import("../src/agents/ProjectConductorAgent.js");
    ProjectConductorAgent =
      imported.ProjectConductorAgent as ProjectConductorCtor;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it("creates missing agent docs and reports 100% coverage", async () => {
    const agent = new ProjectConductorAgent();

    const result = await (
      agent as unknown as {
        updateAgentDocumentationCoverage: () => Promise<CoverageUpdateResult>;
      }
    ).updateAgentDocumentationCoverage();

    expect(result.success).toBe(true);
    expect(result.data.bootstrappedDocs).toBe(2);
    expect(result.data.documentedCount).toBe(2);
    expect(result.data.coverage).toBe(100);

    const alphaDocPath = path.join(testRoot, "docs", "agents", "AlphaAgent.md");
    const betaDocPath = path.join(testRoot, "docs", "agents", "BetaAgent.md");

    const alphaDoc = await fs.readFile(alphaDocPath, "utf-8");
    expect(alphaDoc).toContain("**Agent Name:** `Alpha`");
    expect(alphaDoc).toContain("**Role:** Alpha Role");
    expect(alphaDoc).toContain("- `research`");
    expect(alphaDoc).toContain("- `synthesis`");

    const betaDoc = await fs.readFile(betaDocPath, "utf-8");
    expect(betaDoc).toContain("**Agent Name:** `Beta`");
    expect(betaDoc).toContain("- _No explicit capabilities listed yet._");

    const coverageDoc = await fs.readFile(result.data.outputPath, "utf-8");
    expect(coverageDoc).toContain("- Coverage: **100%**");
    expect(coverageDoc).toContain("| AlphaAgent | ✅ | ./AlphaAgent.md |");
    expect(coverageDoc).toContain("| BetaAgent | ✅ | ./BetaAgent.md |");
  });

  it("does not recreate docs that already exist", async () => {
    const docsDir = path.join(testRoot, "docs", "agents");
    await fs.mkdir(docsDir, { recursive: true });

    const alphaDocPath = path.join(docsDir, "AlphaAgent.md");
    const originalAlphaDoc = "# AlphaAgent\n\nmanual content\n";
    await fs.writeFile(alphaDocPath, originalAlphaDoc, "utf-8");

    const agent = new ProjectConductorAgent();

    const result = await (
      agent as unknown as {
        updateAgentDocumentationCoverage: () => Promise<CoverageUpdateResult>;
      }
    ).updateAgentDocumentationCoverage();

    expect(result.success).toBe(true);
    expect(result.data.bootstrappedDocs).toBe(1);

    const preservedAlpha = await fs.readFile(alphaDocPath, "utf-8");
    expect(preservedAlpha).toBe(originalAlphaDoc);

    const betaDocPath = path.join(docsDir, "BetaAgent.md");
    const betaDoc = await fs.readFile(betaDocPath, "utf-8");
    expect(betaDoc).toContain("# BetaAgent");
  });
});
