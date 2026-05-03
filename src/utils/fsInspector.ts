/**
 * fsInspector.ts - File System Anomaly Detection
 *
 * Part of ProjectConductor 2.0 "Chief-of-Staff" upgrade.
 * Detects file anomalies, outdated documentation, and structural issues.
 *
 * @module utils/fsInspector
 */

import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { logInfo, logError } from './logger.js';

const SOURCE = 'fsInspector';

// ============================================================================
// Types
// ============================================================================

export interface FileInfo {
    path: string;
    name: string;
    size: number;
    mtime: Date;
    isDirectory: boolean;
}

export interface Anomaly {
    type: AnomalyType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    path: string;
    message: string;
    suggestion?: string;
    detectedAt: Date;
}

export type AnomalyType =
    | 'orphaned_file'      // File not referenced anywhere
    | 'duplicate_file'     // Same content, different name
    | 'large_file'         // Unusually large file
    | 'stale_doc'          // Documentation older than code
    | 'empty_dir'          // Empty directory
    | 'temp_file'          // Leftover temp files
    | 'naming_violation'   // Naming convention violation
    | 'missing_index'      // Directory without index file
    | 'circular_ref'       // Circular reference detected
    | 'outdated_track';    // Track older than 30 days without update

export interface ScanOptions {
    rootDir?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxDepth?: number;
    checkDocs?: boolean;
    checkTracks?: boolean;
    checkOrphans?: boolean;
    checkDuplicates?: boolean;
    checkLargeFiles?: boolean;
    largeFileSizeThreshold?: number; // bytes
    staleDocThresholdDays?: number;
}

export interface ScanResult {
    scannedAt: Date;
    rootDir: string;
    totalFiles: number;
    totalDirs: number;
    anomalies: Anomaly[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_EXCLUDE_PATTERNS = [
    'node_modules',
    '.git',
    'build',
    'dist',
    '.venv',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    'coverage',
    '.next',
    '.turbo'
];

const DEFAULT_TEMP_PATTERNS = [
    /\.tmp$/,
    /\.bak$/,
    /\.swp$/,
    /~$/,
    /\.orig$/,
    /\.DS_Store$/,
    /Thumbs\.db$/,
    /\.log\.old$/
];

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
const STALE_DOC_THRESHOLD_DAYS = 30;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Recursively scan directory and collect file info
 */
async function scanDirectory(
    dir: string,
    options: ScanOptions,
    depth: number = 0
): Promise<FileInfo[]> {
    const results: FileInfo[] = [];

    if (options.maxDepth !== undefined && depth > options.maxDepth) {
        return results;
    }

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(options.rootDir || config.workspaceRoot, fullPath);

            // Check exclude patterns
            const shouldExclude = (options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS)
                .some(pattern => relativePath.includes(pattern) || entry.name === pattern);

            if (shouldExclude) continue;

            try {
                const stat = await fs.stat(fullPath);

                results.push({
                    path: fullPath,
                    name: entry.name,
                    size: stat.size,
                    mtime: stat.mtime,
                    isDirectory: entry.isDirectory()
                });

                if (entry.isDirectory()) {
                    const subResults = await scanDirectory(fullPath, options, depth + 1);
                    results.push(...subResults);
                }
            } catch {
                // Skip files we can't stat (permission issues, etc.)
            }
        }
    } catch (error) {
        logError(SOURCE, `Failed to scan directory: ${dir}`);
    }

    return results;
}

/**
 * Detect orphaned files (files not imported/referenced anywhere)
 */
async function detectOrphanedFiles(files: FileInfo[]): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const tsFiles = files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f.name) && !f.isDirectory);

    // Collect all imports
    const importedFiles = new Set<string>();

    for (const file of tsFiles) {
        try {
            const content = await fs.readFile(file.path, 'utf-8');
            const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);

            for (const match of importMatches) {
                const importPath = match[1];
                if (importPath.startsWith('.')) {
                    const resolvedPath = path.resolve(path.dirname(file.path), importPath);
                    importedFiles.add(resolvedPath);
                    importedFiles.add(resolvedPath + '.ts');
                    importedFiles.add(resolvedPath + '.tsx');
                    importedFiles.add(resolvedPath + '.js');
                    importedFiles.add(resolvedPath + '/index.ts');
                    importedFiles.add(resolvedPath + '/index.js');
                }
            }
        } catch {
            // Skip unreadable files
        }
    }

    // Check which files are not imported
    for (const file of tsFiles) {
        if (!file.name.includes('.test.') &&
            !file.name.includes('.spec.') &&
            !file.name.includes('index.') &&
            !file.name.endsWith('.d.ts') &&
            !importedFiles.has(file.path) &&
            !importedFiles.has(file.path.replace(/\.(ts|tsx)$/, ''))) {

            // Additional check: is it an entry point or agent?
            if (!file.path.includes('agents') &&
                !file.path.includes('cli.ts') &&
                !file.path.includes('index.ts')) {
                anomalies.push({
                    type: 'orphaned_file',
                    severity: 'low',
                    path: file.path,
                    message: `File "${file.name}" is not imported by any other file`,
                    suggestion: 'Consider removing if unused, or add to exports',
                    detectedAt: new Date()
                });
            }
        }
    }

    return anomalies;
}

/**
 * Detect large files that may need attention
 */
function detectLargeFiles(files: FileInfo[], threshold: number): Anomaly[] {
    return files
        .filter(f => !f.isDirectory && f.size > threshold)
        .map(f => ({
            type: 'large_file' as AnomalyType,
            severity: f.size > threshold * 10 ? 'high' as const : 'medium' as const,
            path: f.path,
            message: `File size ${(f.size / 1024 / 1024).toFixed(2)}MB exceeds threshold`,
            suggestion: 'Consider compression, splitting, or moving to external storage',
            detectedAt: new Date()
        }));
}

/**
 * Detect temp/backup files that should be cleaned up
 */
function detectTempFiles(files: FileInfo[]): Anomaly[] {
    return files
        .filter(f => !f.isDirectory && DEFAULT_TEMP_PATTERNS.some(p => p.test(f.name)))
        .map(f => ({
            type: 'temp_file' as AnomalyType,
            severity: 'low' as const,
            path: f.path,
            message: `Temporary/backup file found: ${f.name}`,
            suggestion: 'Clean up temp files before commit',
            detectedAt: new Date()
        }));
}

/**
 * Detect empty directories
 */
async function detectEmptyDirs(files: FileInfo[]): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const dirs = files.filter(f => f.isDirectory);

    for (const dir of dirs) {
        try {
            const entries = await fs.readdir(dir.path);
            if (entries.length === 0) {
                anomalies.push({
                    type: 'empty_dir',
                    severity: 'low',
                    path: dir.path,
                    message: `Empty directory: ${dir.name}`,
                    suggestion: 'Remove empty directory or add .gitkeep',
                    detectedAt: new Date()
                });
            }
        } catch {
            // Skip unreadable directories
        }
    }

    return anomalies;
}

/**
 * Detect stale documentation (docs older than related code)
 */
async function detectStaleDocs(
    files: FileInfo[],
    thresholdDays: number
): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const now = new Date();
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    const docFiles = files.filter(f =>
        !f.isDirectory &&
        (/\.md$/i.test(f.name) || /\.txt$/i.test(f.name)) &&
        !f.path.includes('node_modules')
    );

    for (const doc of docFiles) {
        const age = now.getTime() - doc.mtime.getTime();

        if (age > thresholdMs) {
            // Check if there's related code that's newer
            const docDir = path.dirname(doc.path);
            const relatedCode = files.filter(f =>
                !f.isDirectory &&
                f.path.startsWith(docDir) &&
                /\.(ts|tsx|js|jsx|py)$/.test(f.name)
            );

            const newerCode = relatedCode.filter(c => c.mtime > doc.mtime);

            if (newerCode.length > 0) {
                anomalies.push({
                    type: 'stale_doc',
                    severity: age > thresholdMs * 2 ? 'high' : 'medium',
                    path: doc.path,
                    message: `Documentation "${doc.name}" is ${Math.floor(age / 86400000)} days old, but related code was updated`,
                    suggestion: 'Review and update documentation to match current code',
                    detectedAt: new Date()
                });
            }
        }
    }

    return anomalies;
}

/**
 * Detect outdated conductor tracks
 */
async function detectOutdatedTracks(
    tracksDir: string,
    thresholdDays: number = 30
): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const now = new Date();
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    try {
        const trackDirs = await fs.readdir(tracksDir, { withFileTypes: true });

        for (const trackDir of trackDirs) {
            if (!trackDir.isDirectory()) continue;

            const trackPath = path.join(tracksDir, trackDir.name);
            const specPath = path.join(trackPath, 'spec.md');
            const planPath = path.join(trackPath, 'plan.md');

            try {
                // Check spec.md mtime
                const specStat = await fs.stat(specPath);
                const age = now.getTime() - specStat.mtime.getTime();

                if (age > thresholdMs) {
                    // Read spec to check status
                    const specContent = await fs.readFile(specPath, 'utf-8');
                    const isCompleted = /status:\s*(completed|done|closed)/i.test(specContent);

                    if (!isCompleted) {
                        anomalies.push({
                            type: 'outdated_track',
                            severity: age > thresholdMs * 2 ? 'high' : 'medium',
                            path: trackPath,
                            message: `Track "${trackDir.name}" has not been updated for ${Math.floor(age / 86400000)} days`,
                            suggestion: 'Update track status or archive if completed',
                            detectedAt: new Date()
                        });
                    }
                }
            } catch {
                // No spec.md - might be missing
            }
        }
    } catch {
        logError(SOURCE, `Failed to scan tracks directory: ${tracksDir}`);
    }

    return anomalies;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Run full file system anomaly scan
 */
export async function scanForAnomalies(options: ScanOptions = {}): Promise<ScanResult> {
    const rootDir = options.rootDir || config.workspaceRoot;
    logInfo(SOURCE, `Starting anomaly scan in: ${rootDir}`);

    const startTime = Date.now();

    // Scan all files
    const files = await scanDirectory(rootDir, {
        ...options,
        rootDir,
        excludePatterns: options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS
    });

    const totalFiles = files.filter(f => !f.isDirectory).length;
    const totalDirs = files.filter(f => f.isDirectory).length;

    // Collect anomalies
    const anomalies: Anomaly[] = [];

    // Always check temp files
    anomalies.push(...detectTempFiles(files));

    // Conditional checks
    if (options.checkLargeFiles !== false) {
        anomalies.push(...detectLargeFiles(
            files,
            options.largeFileSizeThreshold || LARGE_FILE_THRESHOLD
        ));
    }

    if (options.checkOrphans !== false) {
        anomalies.push(...await detectOrphanedFiles(files));
    }

    if (options.checkDocs !== false) {
        anomalies.push(...await detectStaleDocs(
            files,
            options.staleDocThresholdDays || STALE_DOC_THRESHOLD_DAYS
        ));
    }

    // Check empty directories
    anomalies.push(...await detectEmptyDirs(files));

    // Check conductor tracks
    if (options.checkTracks !== false) {
        const tracksDir = path.join(rootDir, 'conductor', 'tracks');
        anomalies.push(...await detectOutdatedTracks(tracksDir));
    }

    // Count by severity
    const summary = {
        critical: anomalies.filter(a => a.severity === 'critical').length,
        high: anomalies.filter(a => a.severity === 'high').length,
        medium: anomalies.filter(a => a.severity === 'medium').length,
        low: anomalies.filter(a => a.severity === 'low').length
    };

    const duration = Date.now() - startTime;
    logInfo(SOURCE, `Scan completed in ${duration}ms. Found ${anomalies.length} anomalies.`);

    return {
        scannedAt: new Date(),
        rootDir,
        totalFiles,
        totalDirs,
        anomalies,
        summary
    };
}

/**
 * Quick check for critical issues only
 */
export async function quickHealthCheck(): Promise<{
    healthy: boolean;
    criticalIssues: Anomaly[];
}> {
    const result = await scanForAnomalies({
        maxDepth: 3,
        checkOrphans: false,
        checkDocs: false,
        checkDuplicates: false
    });

    const criticalIssues = result.anomalies.filter(a =>
        a.severity === 'critical' || a.severity === 'high'
    );

    return {
        healthy: criticalIssues.length === 0,
        criticalIssues
    };
}

/**
 * Generate markdown report from scan results
 */
export function generateReport(result: ScanResult): string {
    const lines: string[] = [
        '# File System Anomaly Report',
        '',
        `**Scanned:** ${result.scannedAt.toISOString()}`,
        `**Root:** ${result.rootDir}`,
        `**Files:** ${result.totalFiles} | **Directories:** ${result.totalDirs}`,
        '',
        '## Summary',
        '',
        `| Severity | Count |`,
        `|----------|-------|`,
        `| Critical | ${result.summary.critical} |`,
        `| High | ${result.summary.high} |`,
        `| Medium | ${result.summary.medium} |`,
        `| Low | ${result.summary.low} |`,
        '',
    ];

    if (result.anomalies.length === 0) {
        lines.push('No anomalies detected.');
    } else {
        lines.push('## Anomalies', '');

        // Group by type
        const byType = new Map<AnomalyType, Anomaly[]>();
        for (const anomaly of result.anomalies) {
            const list = byType.get(anomaly.type) || [];
            list.push(anomaly);
            byType.set(anomaly.type, list);
        }

        for (const [type, anomalies] of byType) {
            lines.push(`### ${type.replace(/_/g, ' ').toUpperCase()} (${anomalies.length})`, '');

            for (const a of anomalies) {
                const severityIcon = {
                    critical: '🔴',
                    high: '🟠',
                    medium: '🟡',
                    low: '🟢'
                }[a.severity];

                lines.push(`${severityIcon} **${a.message}**`);
                lines.push(`  - Path: \`${path.relative(result.rootDir, a.path)}\``);
                if (a.suggestion) {
                    lines.push(`  - Suggestion: ${a.suggestion}`);
                }
                lines.push('');
            }
        }
    }

    return lines.join('\n');
}
