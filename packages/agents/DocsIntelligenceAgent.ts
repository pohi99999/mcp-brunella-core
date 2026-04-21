/**
 * DocsIntelligenceAgent.ts - Documentation Intelligence Agent
 *
 * Part of Brunella 2.1 upgrade (MEDIUM priority task 2.3).
 * Compares documentation with actual code to detect inconsistencies:
 * - Outdated API documentation
 * - Missing function/class documentation
 * - Incorrect examples in docs
 * - Stale README sections
 *
 * @module agents/DocsIntelligenceAgent
 */

import { IAgent, AgentResponse } from "./types.js";
import { logInfo, logError, logDebug, setAgentStatus } from "@packages/utils/logger.js";
import { ensureError } from "@packages/utils/ensureError.js";
import { config } from "@packages/utils/index.js";
import fs from "fs/promises";
import path from "path";

const SOURCE = "DocsIntelligence";

// ============================================================================
// Types
// ============================================================================

export interface CodeSymbol {
  name: string;
  type: "function" | "class" | "interface" | "type" | "const" | "export";
  file: string;
  line: number;
  exported: boolean;
  hasJSDoc: boolean;
  signature?: string;
}

export interface DocReference {
  symbol: string;
  docFile: string;
  line: number;
  context: string;
}

export interface DocInconsistency {
  type: InconsistencyType;
  severity: "low" | "medium" | "high";
  symbol?: string;
  codeFile?: string;
  docFile: string;
  message: string;
  suggestion?: string;
}

export type InconsistencyType =
  | "missing_doc" // Exported symbol not documented
  | "stale_reference" // Doc references non-existent symbol
  | "outdated_example" // Code example doesn't match current API
  | "missing_file_doc" // Source file mentioned but doesn't exist
  | "api_mismatch" // API signature in doc doesn't match code
  | "outdated_section"; // Doc section much older than related code

export interface DocAnalysis {
  timestamp: Date;
  codeSymbols: CodeSymbol[];
  docReferences: DocReference[];
  inconsistencies: DocInconsistency[];
  coverage: {
    totalExports: number;
    documentedExports: number;
    coveragePercent: number;
  };
}

export interface AnalysisOptions {
  codeDir?: string;
  docsDir?: string;
  includePrivate?: boolean;
  checkExamples?: boolean;
}

// ============================================================================
// Code Analysis Functions
// ============================================================================

/**
 * Extract exported symbols from TypeScript files
 */
async function extractCodeSymbols(
  dir: string,
  excludePatterns: string[] = ["node_modules", "build", "dist", ".git"],
): Promise<CodeSymbol[]> {
  const symbols: CodeSymbol[] = [];

  async function scanDir(currentDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (
          excludePatterns.some((p) => entry.name === p || fullPath.includes(p))
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (
          entry.isFile() &&
          /\.(ts|tsx)$/.test(entry.name) &&
          !entry.name.endsWith(".d.ts")
        ) {
          const fileSymbols = await extractFileSymbols(fullPath);
          symbols.push(...fileSymbols);
        }
      }
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(SOURCE, `Directory not accessible while extracting code symbols from ${dir}: ${err.message}`);
    }
  }

  await scanDir(dir);
  return symbols;
}

/**
 * Extract symbols from a single TypeScript file
 */
async function extractFileSymbols(filePath: string): Promise<CodeSymbol[]> {
  const symbols: CodeSymbol[] = [];

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Track if we're in a JSDoc comment
    let inJSDoc = false;
    let hasJSDoc = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Track JSDoc comments
      if (line.includes("/**")) {
        inJSDoc = true;
        hasJSDoc = true;
      }
      if (line.includes("*/")) {
        inJSDoc = false;
      }

      // Skip if inside JSDoc
      if (inJSDoc) continue;

      // Export function
      const funcMatch = line.match(/^export\s+(async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        symbols.push({
          name: funcMatch[2],
          type: "function",
          file: filePath,
          line: lineNum,
          exported: true,
          hasJSDoc,
          signature: extractSignature(lines, i),
        });
        hasJSDoc = false;
        continue;
      }

      // Export class
      const classMatch = line.match(/^export\s+class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: "class",
          file: filePath,
          line: lineNum,
          exported: true,
          hasJSDoc,
        });
        hasJSDoc = false;
        continue;
      }

      // Export interface
      const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        symbols.push({
          name: interfaceMatch[1],
          type: "interface",
          file: filePath,
          line: lineNum,
          exported: true,
          hasJSDoc,
        });
        hasJSDoc = false;
        continue;
      }

      // Export type
      const typeMatch = line.match(/^export\s+type\s+(\w+)/);
      if (typeMatch) {
        symbols.push({
          name: typeMatch[1],
          type: "type",
          file: filePath,
          line: lineNum,
          exported: true,
          hasJSDoc,
        });
        hasJSDoc = false;
        continue;
      }

      // Export const
      const constMatch = line.match(/^export\s+const\s+(\w+)/);
      if (constMatch) {
        symbols.push({
          name: constMatch[1],
          type: "const",
          file: filePath,
          line: lineNum,
          exported: true,
          hasJSDoc,
        });
        hasJSDoc = false;
        continue;
      }

      // Named export
      const namedExportMatch = line.match(/^export\s+\{\s*(.+?)\s*\}/);
      if (namedExportMatch) {
        const names = namedExportMatch[1]
          .split(",")
          .map((n) => n.trim().split(/\s+as\s+/)[0]);
        for (const name of names) {
          symbols.push({
            name,
            type: "export",
            file: filePath,
            line: lineNum,
            exported: true,
            hasJSDoc: false,
          });
        }
        continue;
      }

      // Reset hasJSDoc if we see a non-export line after JSDoc
      if (hasJSDoc && line.trim() && !line.trim().startsWith("//")) {
        hasJSDoc = false;
      }
    }
  } catch (error: unknown) {
    const err = ensureError(error);
    logDebug(SOURCE, `File not readable while extracting code symbols from ${filePath}: ${err.message}`);
  }

  return symbols;
}

/**
 * Extract function signature from lines
 */
function extractSignature(lines: string[], startLine: number): string {
  let signature = "";
  let parenDepth = 0;
  let started = false;

  for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
    const line = lines[i];
    signature += line + " ";

    for (const char of line) {
      if (char === "(") {
        parenDepth++;
        started = true;
      } else if (char === ")") {
        parenDepth--;
      }
    }

    if (started && parenDepth === 0) {
      break;
    }
  }

  // Clean up signature
  return signature.replace(/\s+/g, " ").replace(/\{.*$/, "").trim();
}

// ============================================================================
// Documentation Analysis Functions
// ============================================================================

/**
 * Extract symbol references from documentation files
 */
async function extractDocReferences(
  dir: string,
  excludePatterns: string[] = ["node_modules", "build", ".git"],
): Promise<DocReference[]> {
  const references: DocReference[] = [];

  async function scanDir(currentDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (
          excludePatterns.some((p) => entry.name === p || fullPath.includes(p))
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && /\.(md|txt)$/i.test(entry.name)) {
          const fileRefs = await extractFileReferences(fullPath);
          references.push(...fileRefs);
        }
      }
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(SOURCE, `Directory not accessible while extracting doc references from ${dir}: ${err.message}`);
    }
  }

  await scanDir(dir);
  return references;
}

/**
 * Extract references from a single documentation file
 */
async function extractFileReferences(
  filePath: string,
): Promise<DocReference[]> {
  const references: DocReference[] = [];

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Code blocks with function/class names
      const codeBlockMatch = line.match(/`([A-Z][a-zA-Z0-9]+(?:Agent)?)`/g);
      if (codeBlockMatch) {
        for (const match of codeBlockMatch) {
          const symbol = match.replace(/`/g, "");
          references.push({
            symbol,
            docFile: filePath,
            line: lineNum,
            context: line.trim(),
          });
        }
      }

      // Import statements in code examples
      const importMatch = line.match(/import\s+\{\s*([^}]+)\s*\}\s+from/);
      if (importMatch) {
        const symbols = importMatch[1].split(",").map((s) => s.trim());
        for (const symbol of symbols) {
          references.push({
            symbol,
            docFile: filePath,
            line: lineNum,
            context: line.trim(),
          });
        }
      }

      // File path references
      const filePathMatch = line.match(/`(src\/[^`]+\.(ts|js|tsx|jsx))`/g);
      if (filePathMatch) {
        for (const match of filePathMatch) {
          const filRef = match.replace(/`/g, "");
          references.push({
            symbol: filRef,
            docFile: filePath,
            line: lineNum,
            context: line.trim(),
          });
        }
      }
    }
  } catch (error: unknown) {
    const err = ensureError(error);
    logDebug(SOURCE, `File not readable while extracting doc references from ${filePath}: ${err.message}`);
  }

  return references;
}

// ============================================================================
// Inconsistency Detection
// ============================================================================

/**
 * Find inconsistencies between code and documentation
 */
async function findInconsistencies(
  symbols: CodeSymbol[],
  references: DocReference[],
  options: AnalysisOptions,
): Promise<DocInconsistency[]> {
  const inconsistencies: DocInconsistency[] = [];

  // Map of symbol names for quick lookup
  const symbolMap = new Map<string, CodeSymbol>();
  for (const sym of symbols) {
    symbolMap.set(sym.name, sym);
  }

  // Check for stale references (doc mentions non-existent symbol)
  for (const ref of references) {
    // Skip file path references for now
    if (ref.symbol.includes("/")) continue;

    if (!symbolMap.has(ref.symbol)) {
      // Check if it might be a renamed or removed symbol
      const similar = findSimilarSymbol(ref.symbol, symbols);

      inconsistencies.push({
        type: "stale_reference",
        severity: "medium",
        symbol: ref.symbol,
        docFile: ref.docFile,
        message: `Documentation references "${ref.symbol}" which doesn't exist in code`,
        suggestion: similar
          ? `Did you mean "${similar}"? Update the reference.`
          : "Remove or update this reference.",
      });
    }
  }

  // Check for missing documentation (exported symbol not mentioned in docs)
  const documentedSymbols = new Set(references.map((r) => r.symbol));

  for (const sym of symbols) {
    // Only check classes and public-facing exports
    if (!sym.exported) continue;
    if (sym.type !== "class" && sym.type !== "function") continue;

    // Skip internal utilities
    if (sym.name.startsWith("_")) continue;

    if (!documentedSymbols.has(sym.name)) {
      const relativePath = path.relative(config.workspaceRoot, sym.file);

      // Only report for important modules
      if (relativePath.includes("agents/") || relativePath.includes("tools/")) {
        inconsistencies.push({
          type: "missing_doc",
          severity: "low",
          symbol: sym.name,
          codeFile: sym.file,
          docFile: "README.md",
          message: `Exported ${sym.type} "${sym.name}" is not documented`,
          suggestion: `Add documentation for ${sym.name} in README.md or dedicated docs`,
        });
      }
    }
  }

  // Check for file path references to non-existent files
  const fileRefs = references.filter((r) => r.symbol.includes("/"));
  for (const ref of fileRefs) {
    const fullPath = path.join(config.workspaceRoot, ref.symbol);
    try {
      await fs.access(fullPath);
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug(SOURCE, `Missing referenced file doc ${fullPath}: ${err.message}`);
      inconsistencies.push({
        type: "missing_file_doc",
        severity: "high",
        symbol: ref.symbol,
        docFile: ref.docFile,
        message: `Documentation references file "${ref.symbol}" which doesn't exist`,
        suggestion: "Update the file path or remove the reference",
      });
    }
  }

  return inconsistencies;
}

/**
 * Find similar symbol name (for typo detection)
 */
function findSimilarSymbol(name: string, symbols: CodeSymbol[]): string | null {
  const nameLower = name.toLowerCase();

  for (const sym of symbols) {
    const symLower = sym.name.toLowerCase();

    // Check for case-insensitive match
    if (symLower === nameLower) {
      return sym.name;
    }

    // Check for partial match (e.g., "Agent" suffix)
    if (symLower.includes(nameLower) || nameLower.includes(symLower)) {
      return sym.name;
    }

    // Simple Levenshtein-like check for short names
    if (name.length <= 10 && Math.abs(name.length - sym.name.length) <= 2) {
      let diff = 0;
      const maxLen = Math.max(name.length, sym.name.length);
      for (let i = 0; i < maxLen; i++) {
        if (nameLower[i] !== symLower[i]) diff++;
      }
      if (diff <= 2) return sym.name;
    }
  }

  return null;
}

/**
 * Calculate documentation coverage
 */
function calculateCoverage(
  symbols: CodeSymbol[],
  references: DocReference[],
): {
  totalExports: number;
  documentedExports: number;
  coveragePercent: number;
} {
  const exportedSymbols = symbols.filter(
    (s) =>
      s.exported &&
      (s.type === "class" || s.type === "function") &&
      !s.name.startsWith("_"),
  );

  const documentedNames = new Set(references.map((r) => r.symbol));
  const documented = exportedSymbols.filter((s) => documentedNames.has(s.name));

  const total = exportedSymbols.length;
  const docCount = documented.length;

  return {
    totalExports: total,
    documentedExports: docCount,
    coveragePercent: total > 0 ? Math.round((docCount / total) * 100) : 100,
  };
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate markdown report from analysis
 */
function generateDocIntelReport(analysis: DocAnalysis): string {
  const lines: string[] = [
    "# Documentation Intelligence Report",
    "",
    `**Generated:** ${analysis.timestamp.toISOString()}`,
    "",
    "## Coverage Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Exports | ${analysis.coverage.totalExports} |`,
    `| Documented | ${analysis.coverage.documentedExports} |`,
    `| Coverage | ${analysis.coverage.coveragePercent}% |`,
    "",
  ];

  // Coverage bar
  const filledBlocks = Math.round(analysis.coverage.coveragePercent / 10);
  const bar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);
  lines.push(
    `**Coverage:** \`[${bar}]\` ${analysis.coverage.coveragePercent}%`,
    "",
  );

  // Inconsistencies
  if (analysis.inconsistencies.length > 0) {
    lines.push("## ⚠️ Inconsistencies Found", "");

    // Group by type
    const byType = new Map<InconsistencyType, DocInconsistency[]>();
    for (const inc of analysis.inconsistencies) {
      const list = byType.get(inc.type) || [];
      list.push(inc);
      byType.set(inc.type, list);
    }

    const typeLabels: Record<InconsistencyType, string> = {
      missing_doc: "Missing Documentation",
      stale_reference: "Stale References",
      outdated_example: "Outdated Examples",
      missing_file_doc: "Missing Files",
      api_mismatch: "API Mismatches",
      outdated_section: "Outdated Sections",
    };

    for (const [type, items] of byType) {
      lines.push(`### ${typeLabels[type]} (${items.length})`, "");

      for (const inc of items) {
        const severityIcon = {
          high: "🔴",
          medium: "🟡",
          low: "🟢",
        }[inc.severity];

        lines.push(`${severityIcon} **${inc.message}**`);
        if (inc.symbol) {
          lines.push(`  - Symbol: \`${inc.symbol}\``);
        }
        lines.push(
          `  - Doc: \`${path.relative(config.workspaceRoot, inc.docFile)}\``,
        );
        if (inc.suggestion) {
          lines.push(`  - 💡 ${inc.suggestion}`);
        }
        lines.push("");
      }
    }
  } else {
    lines.push("## ✅ No Inconsistencies Found", "");
  }

  // Symbol summary
  if (analysis.codeSymbols.length > 0) {
    lines.push("## Code Symbols Summary", "");

    const byType = new Map<string, number>();
    for (const sym of analysis.codeSymbols) {
      byType.set(sym.type, (byType.get(sym.type) || 0) + 1);
    }

    lines.push("| Type | Count |");
    lines.push("|------|-------|");
    for (const [type, count] of byType) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push("");

    // JSDoc coverage
    const withJSDoc = analysis.codeSymbols.filter((s) => s.hasJSDoc).length;
    const jsDocPercent = Math.round(
      (withJSDoc / analysis.codeSymbols.length) * 100,
    );
    lines.push(
      `**JSDoc Coverage:** ${jsDocPercent}% (${withJSDoc}/${analysis.codeSymbols.length})`,
      "",
    );
  }

  return lines.join("\n");
}

// ============================================================================
// Agent Implementation
// ============================================================================

export class DocsIntelligenceAgent implements IAgent {
  name = "DocsIntelligence";
  role = "Documentation Intelligence Agent";
  description =
    "Compares documentation with actual code to detect inconsistencies, stale references, and missing documentation";
  capabilities = [
    "doc_analysis",
    "inconsistency_detection",
    "coverage_calculation",
    "stale_reference_detection",
    "missing_doc_detection",
  ];

  private lastAnalysis: DocAnalysis | null = null;

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, "working", task.slice(0, 50));
    logInfo(SOURCE, `Executing: ${task}`);

    try {
      const taskLower = task.toLowerCase();

      // Parse commands
      if (taskLower.includes("help") || taskLower.includes("segítség")) {
        return this.showHelp();
      }

      if (
        taskLower.includes("analyze") ||
        taskLower.includes("elemez") ||
        taskLower.includes("scan")
      ) {
        return await this.runAnalysis(context);
      }

      if (taskLower.includes("coverage") || taskLower.includes("lefedettség")) {
        return await this.checkCoverage();
      }

      if (taskLower.includes("stale") || taskLower.includes("elavult")) {
        return await this.findStaleReferences();
      }

      if (taskLower.includes("missing") || taskLower.includes("hiányzó")) {
        return await this.findMissingDocs();
      }

      // Default: run full analysis
      return await this.runAnalysis(context);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(SOURCE, error);
      return { status: "error", error };
    } finally {
      setAgentStatus(this.name, "idle");
    }
  }

  private showHelp(): AgentResponse {
    const help = `
# DocsIntelligenceAgent - Help

## Commands

| Command | Description |
|---------|-------------|
| \`analyze\` | Run full documentation analysis |
| \`coverage\` | Check documentation coverage |
| \`stale\` | Find stale references in docs |
| \`missing\` | Find missing documentation |

## Examples

- \`docs analyze\`
- \`docs coverage\`
- \`docs stale\`
- \`docs missing\`

## What It Checks

- **Stale References:** Doc mentions symbols that don't exist in code
- **Missing Docs:** Exported symbols not mentioned in documentation
- **File References:** Paths in docs that don't exist
- **JSDoc Coverage:** Inline documentation in code
`;

    return {
      status: "success",
      data: { help },
    };
  }

  private async runAnalysis(context?: unknown): Promise<AgentResponse> {
    const options: AnalysisOptions = {
      codeDir: path.join(config.workspaceRoot, "src"),
      docsDir: config.workspaceRoot,
    };

    if (context && typeof context === "object") {
      const ctx = context as Record<string, unknown>;
      if (ctx.codeDir) options.codeDir = String(ctx.codeDir);
      if (ctx.docsDir) options.docsDir = String(ctx.docsDir);
    }

    logInfo(SOURCE, "Extracting code symbols...");
    const codeSymbols = await extractCodeSymbols(options.codeDir!);
    logInfo(SOURCE, `Found ${codeSymbols.length} code symbols`);

    logInfo(SOURCE, "Extracting doc references...");
    const docReferences = await extractDocReferences(options.docsDir!);
    logInfo(SOURCE, `Found ${docReferences.length} doc references`);

    logInfo(SOURCE, "Finding inconsistencies...");
    const inconsistencies = await findInconsistencies(
      codeSymbols,
      docReferences,
      options,
    );

    const coverage = calculateCoverage(codeSymbols, docReferences);

    this.lastAnalysis = {
      timestamp: new Date(),
      codeSymbols,
      docReferences,
      inconsistencies,
      coverage,
    };

    const report = generateDocIntelReport(this.lastAnalysis);

    logInfo(
      SOURCE,
      `Analysis complete: ${inconsistencies.length} inconsistencies, ${coverage.coveragePercent}% coverage`,
    );

    return {
      status: "success",
      data: {
        summary: {
          codeSymbols: codeSymbols.length,
          docReferences: docReferences.length,
          inconsistencies: inconsistencies.length,
          coverage: coverage.coveragePercent,
        },
        report,
      },
    };
  }

  private async checkCoverage(): Promise<AgentResponse> {
    if (!this.lastAnalysis) {
      await this.runAnalysis();
    }

    return {
      status: "success",
      data: {
        coverage: this.lastAnalysis!.coverage,
      },
    };
  }

  private async findStaleReferences(): Promise<AgentResponse> {
    if (!this.lastAnalysis) {
      await this.runAnalysis();
    }

    const stale = this.lastAnalysis!.inconsistencies.filter(
      (i) => i.type === "stale_reference" || i.type === "missing_file_doc",
    );

    return {
      status: "success",
      data: {
        count: stale.length,
        staleReferences: stale,
      },
    };
  }

  private async findMissingDocs(): Promise<AgentResponse> {
    if (!this.lastAnalysis) {
      await this.runAnalysis();
    }

    const missing = this.lastAnalysis!.inconsistencies.filter(
      (i) => i.type === "missing_doc",
    );

    return {
      status: "success",
      data: {
        count: missing.length,
        missingDocs: missing,
      },
    };
  }
}

// Export singleton instance
export const docsIntelligenceAgent = new DocsIntelligenceAgent();

export default DocsIntelligenceAgent;

