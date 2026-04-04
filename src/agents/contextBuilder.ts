// FILE: src/agents/contextBuilder.ts
// PURPOSE: Multi-File Context Builder for Developer Agent 3.0 (P5)
// VERSION: 3.0
//
// Gathers relevant project files as context for code generation.
// Strategies:
//   1. Import analysis — parse TS/JS imports to find related files
//   2. Directory siblings — files in the same directory
//   3. Test association — find test file for a source file (and vice versa)
//   4. Type deps — files that export types used by the target

import { logInfo, logDebug } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';
import fs from 'fs/promises';
import path from 'path';

// ==================== Types ====================

export interface ContextFile {
    filePath: string;
    relativePath: string;
    content: string;
    reason: string; // Why this file is relevant
    size: number;
}

export interface ContextResult {
    targetFile: string;
    files: ContextFile[];
    totalSize: number;
    truncated: boolean;
    gatheredAt: number;
}

export interface ContextOptions {
    /** Maximum total chars across all context files (default: 50000) */
    maxTotalSize?: number;
    /** Maximum number of context files (default: 15) */
    maxFiles?: number;
    /** Include sibling files from same directory (default: true) */
    includeSiblings?: boolean;
    /** Include test / source pair (default: true) */
    includeTestPair?: boolean;
    /** Additional file paths to explicitly include */
    extraFiles?: string[];
    /** Project root for resolving relative imports */
    projectRoot?: string;
}

// ==================== Constants ====================

const DEFAULT_MAX_TOTAL_SIZE = 50_000;
const DEFAULT_MAX_FILES = 15;

/** File extensions we consider for context */
const CODE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.css', '.sql',
]);

/** Patterns to skip when scanning directories */
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'build', 'dist', 'coverage', '__pycache__',
    '.next', '.vite', '.cache',
]);

// ==================== Context Builder ====================

export class ContextBuilder {
    private projectRoot: string;

    constructor(projectRoot?: string) {
        this.projectRoot = projectRoot || process.cwd();
    }

    /**
     * Gather context files for a given target file.
     */
    async gatherContext(targetFile: string, options: ContextOptions = {}): Promise<ContextResult> {
        const maxTotalSize = options.maxTotalSize ?? DEFAULT_MAX_TOTAL_SIZE;
        const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
        const root = options.projectRoot ?? this.projectRoot;

        const absoluteTarget = path.isAbsolute(targetFile)
            ? targetFile
            : path.resolve(root, targetFile);

        logInfo('ContextBuilder', `Gathering context for: ${absoluteTarget}`);

        // Collect candidate file paths with reasons
        const candidates: Array<{ filePath: string; reason: string; priority: number }> = [];

        // Strategy 1: Parse imports
        try {
            const imports = await this.parseImports(absoluteTarget, root);
            for (const imp of imports) {
                candidates.push({ filePath: imp, reason: 'imported by target', priority: 1 });
            }
        } catch (error: unknown) {
            const err = ensureError(error);
            logDebug('ContextBuilder', `Failed to parse imports for ${absoluteTarget}: ${err.message}`);
        }

        // Strategy 2: Directory siblings
        if (options.includeSiblings !== false) {
            try {
                const siblings = await this.getSiblingFiles(absoluteTarget);
                for (const sib of siblings) {
                    candidates.push({ filePath: sib, reason: 'sibling file', priority: 3 });
                }
            } catch (error: unknown) {
                const err = ensureError(error);
                logDebug('ContextBuilder', `Skipping sibling lookup for ${absoluteTarget}: ${err.message}`);
            }
        }

        // Strategy 3: Test pair
        if (options.includeTestPair !== false) {
            const testPair = this.findTestPair(absoluteTarget, root);
            if (testPair) {
                candidates.push({ filePath: testPair, reason: 'test pair', priority: 2 });
            }
        }

        // Strategy 4: Extra files
        if (options.extraFiles) {
            for (const extra of options.extraFiles) {
                const absExtra = path.isAbsolute(extra) ? extra : path.resolve(root, extra);
                candidates.push({ filePath: absExtra, reason: 'explicitly included', priority: 0 });
            }
        }

        // Deduplicate and sort by priority (lower = more important)
        const seen = new Set<string>([absoluteTarget]); // Exclude target itself
        const uniqueCandidates = candidates
            .filter(c => {
                const normalized = path.normalize(c.filePath);
                if (seen.has(normalized)) return false;
                seen.add(normalized);
                return true;
            })
            .sort((a, b) => a.priority - b.priority);

        // Read files up to limits
        const contextFiles: ContextFile[] = [];
        let totalSize = 0;
        let truncated = false;

        for (const candidate of uniqueCandidates) {
            if (contextFiles.length >= maxFiles) {
                truncated = true;
                break;
            }

            try {
                const content = await fs.readFile(candidate.filePath, 'utf-8');

                if (totalSize + content.length > maxTotalSize) {
                    truncated = true;
                    // Try to include a truncated version if it's important (priority 0 or 1)
                    if (candidate.priority <= 1 && content.length > 500) {
                        const truncatedContent = content.slice(0, maxTotalSize - totalSize);
                        contextFiles.push({
                            filePath: candidate.filePath,
                            relativePath: path.relative(root, candidate.filePath),
                            content: truncatedContent,
                            reason: candidate.reason + ' (truncated)',
                            size: truncatedContent.length,
                        });
                        totalSize += truncatedContent.length;
                    }
                    break;
                }

                contextFiles.push({
                    filePath: candidate.filePath,
                    relativePath: path.relative(root, candidate.filePath),
                    content,
                    reason: candidate.reason,
                    size: content.length,
                });
                totalSize += content.length;
            } catch (error: unknown) {
                const err = ensureError(error);
                logDebug('ContextBuilder', `Skipping unreadable file ${candidate.filePath}: ${err.message}`);
            }
        }

        logInfo('ContextBuilder', `Context gathered: ${contextFiles.length} files, ${totalSize} chars`);

        return {
            targetFile: absoluteTarget,
            files: contextFiles,
            totalSize,
            truncated,
            gatheredAt: Date.now(),
        };
    }

    /**
     * Build a prompt-friendly context string from gathered files.
     */
    formatForPrompt(context: ContextResult): string {
        if (context.files.length === 0) return '';

        const parts = ['--- PROJECT CONTEXT ---\n'];

        for (const file of context.files) {
            parts.push(`// FILE: ${file.relativePath} (${file.reason})`);
            parts.push('```');
            parts.push(file.content);
            parts.push('```\n');
        }

        if (context.truncated) {
            parts.push('(Context was truncated due to size limits)\n');
        }

        parts.push('--- END CONTEXT ---');
        return parts.join('\n');
    }

    // ==================== Private Helpers ====================

    /**
     * Parse import/require statements from a TypeScript/JavaScript file.
     */
    async parseImports(filePath: string, root: string): Promise<string[]> {
        const content = await fs.readFile(filePath, 'utf-8');
        const dir = path.dirname(filePath);
        const resolved: string[] = [];

        // Match: import ... from '...' or import '...' or require('...')
        const importRegex = /(?:import\s+.*?from\s+['"](.+?)['"]|import\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\))/g;

        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1] || match[2] || match[3];
            if (!importPath) continue;

            // Skip node_modules / external packages
            if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.startsWith('@/')) {
                continue;
            }

            // Resolve @/ alias to src/
            let resolvedImport = importPath;
            if (resolvedImport.startsWith('@/')) {
                resolvedImport = path.join(root, 'src', resolvedImport.slice(2));
            } else {
                resolvedImport = path.resolve(dir, resolvedImport);
            }

            // Strip .js extension and try extensions
            const withoutExt = resolvedImport.replace(/\.js$/, '');
            const candidates = [
                withoutExt + '.ts',
                withoutExt + '.tsx',
                withoutExt + '.js',
                withoutExt + '.jsx',
                withoutExt + '/index.ts',
                withoutExt + '/index.tsx',
                resolvedImport, // As-is
            ];

            for (const candidate of candidates) {
                try {
                    await fs.access(candidate);
                    resolved.push(path.normalize(candidate));
                    break;
                } catch (error: unknown) {
                    const err = ensureError(error);
                    logDebug('ContextBuilder', `Not found, trying next candidate ${candidate}: ${err.message}`);
                }
            }
        }

        return resolved;
    }

    /**
     * Get sibling files (same directory, code extensions only).
     */
    async getSiblingFiles(filePath: string): Promise<string[]> {
        const dir = path.dirname(filePath);
        const fileName = path.basename(filePath);

        const entries = await fs.readdir(dir, { withFileTypes: true });
        const siblings: string[] = [];

        for (const entry of entries) {
            if (!entry.isFile()) continue;
            if (entry.name === fileName) continue;
            const ext = path.extname(entry.name);
            if (CODE_EXTENSIONS.has(ext)) {
                siblings.push(path.join(dir, entry.name));
            }
        }

        return siblings;
    }

    /**
     * Find the corresponding test file for a source file, or vice versa.
     */
    findTestPair(filePath: string, root: string): string | null {
        const fileName = path.basename(filePath);
        const dir = path.dirname(filePath);

        // If this IS a test file, find the source
        if (fileName.includes('.test.') || fileName.includes('.spec.')) {
            const sourceName = fileName
                .replace('.test.', '.')
                .replace('.spec.', '.');
            // Source could be in src/ instead of test/
            const relative = path.relative(root, dir);
            if (relative.startsWith('test')) {
                const srcDir = path.join(root, 'src', relative.slice(5)); // test/ -> src/
                return path.join(srcDir, sourceName);
            }
            return path.join(dir, sourceName);
        }

        // This is a source file, find its test
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        const testName = `${base}.test${ext}`;

        // Test could be in test/ directory
        const relative = path.relative(root, dir);
        if (relative.startsWith('src')) {
            const testDir = path.join(root, 'test');
            return path.join(testDir, testName);
        }

        return path.join(dir, testName);
    }
}

// Singleton
export const contextBuilder = new ContextBuilder();
