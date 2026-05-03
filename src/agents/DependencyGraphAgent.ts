/**
 * DependencyGraphAgent.ts - Dependency Graph Analyzer
 *
 * Part of Brunella 2.1 upgrade (MEDIUM priority task 2.1).
 * Analyzes code dependencies, detects circular references, and generates
 * dependency graphs for the codebase.
 *
 * @module agents/DependencyGraphAgent
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, logDebug, setAgentStatus } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';
import { config } from '../config/index.js';
import fs from 'fs/promises';
import path from 'path';

const SOURCE = 'DependencyGraph';

// ============================================================================
// Types
// ============================================================================

export interface DependencyNode {
    filePath: string;
    relativePath: string;
    imports: string[];
    importedBy: string[];
    depth?: number;
}

export interface CircularDependency {
    cycle: string[];
    severity: 'warning' | 'error';
}

export interface DependencyHotspot {
    filePath: string;
    incomingCount: number;
    outgoingCount: number;
    totalConnections: number;
    type: 'hub' | 'sink' | 'source' | 'isolated';
}

export interface DependencyAnalysis {
    timestamp: Date;
    rootDir: string;
    totalFiles: number;
    totalDependencies: number;
    circularDependencies: CircularDependency[];
    hotspots: DependencyHotspot[];
    orphanedModules: string[];
    entryPoints: string[];
    maxDepth: number;
    graph: Map<string, DependencyNode>;
}

export interface AnalysisOptions {
    rootDir?: string;
    includeNodeModules?: boolean;
    fileExtensions?: string[];
    excludePatterns?: string[];
    maxDepth?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const DEFAULT_EXCLUDE = [
    'node_modules',
    'build',
    'dist',
    '.git',
    'coverage',
    '__pycache__',
    '.venv'
];

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Extract imports from a TypeScript/JavaScript file
 */
async function extractImports(filePath: string): Promise<string[]> {
    const imports: string[] = [];

    try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Match ES6 imports: import { x } from './path'
        const es6Imports = content.matchAll(/import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g);
        for (const match of es6Imports) {
            imports.push(match[1]);
        }

        // Match dynamic imports: import('./path')
        const dynamicImports = content.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
        for (const match of dynamicImports) {
            imports.push(match[1]);
        }

        // Match require: require('./path')
        const requireImports = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
        for (const match of requireImports) {
            imports.push(match[1]);
        }
    } catch (error: unknown) {
        const err = ensureError(error);
        logDebug(SOURCE, `File unreadable, returning empty imports for ${filePath}: ${err.message}`);
    }

    return imports;
}

/**
 * Resolve import path to actual file path
 */
function resolveImportPath(
    importPath: string,
    fromFile: string,
    extensions: string[]
): string | null {
    // Skip node_modules and external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        return null;
    }

    const baseDir = path.dirname(fromFile);
    const resolved = path.resolve(baseDir, importPath);

    // Try exact path first
    const exactPath = resolved;

    // Try with extensions
    for (const ext of extensions) {
        const withExt = resolved + ext;
        const indexPath = path.join(resolved, `index${ext}`);

        // Return the most likely candidate
        if (importPath.endsWith(ext)) {
            return exactPath;
        }

        // Common pattern: import from './foo' resolves to './foo.ts' or './foo/index.ts'
        return withExt; // Assume the extension variant exists
    }

    return exactPath;
}

/**
 * Scan directory for source files
 */
async function scanSourceFiles(
    dir: string,
    options: AnalysisOptions,
    depth: number = 0
): Promise<string[]> {
    const files: string[] = [];
    const extensions = options.fileExtensions || DEFAULT_EXTENSIONS;
    const exclude = options.excludePatterns || DEFAULT_EXCLUDE;

    if (options.maxDepth !== undefined && depth > options.maxDepth) {
        return files;
    }

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            // Check exclusions
            if (exclude.some(p => entry.name === p || fullPath.includes(p))) {
                continue;
            }

            if (entry.isDirectory()) {
                const subFiles = await scanSourceFiles(fullPath, options, depth + 1);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    } catch (error: unknown) {
        const err = ensureError(error);
        logDebug(SOURCE, `Directory unreadable during scan of ${dir}: ${err.message}`);
    }

    return files;
}

/**
 * Build dependency graph from source files
 */
async function buildDependencyGraph(
    files: string[],
    options: AnalysisOptions
): Promise<Map<string, DependencyNode>> {
    const graph = new Map<string, DependencyNode>();
    const rootDir = options.rootDir || config.workspaceRoot;
    const extensions = options.fileExtensions || DEFAULT_EXTENSIONS;

    // Initialize nodes
    for (const file of files) {
        graph.set(file, {
            filePath: file,
            relativePath: path.relative(rootDir, file),
            imports: [],
            importedBy: []
        });
    }

    // Extract imports and build edges
    for (const file of files) {
        const imports = await extractImports(file);
        const node = graph.get(file)!;

        for (const importPath of imports) {
            const resolved = resolveImportPath(importPath, file, extensions);

            if (resolved) {
                // Normalize path for comparison
                const normalizedResolved = path.normalize(resolved);

                // Find matching file in graph
                for (const [graphFile] of graph) {
                    const normalizedGraphFile = path.normalize(graphFile);
                    const graphFileWithoutExt = normalizedGraphFile.replace(/\.(ts|tsx|js|jsx)$/, '');
                    const resolvedWithoutExt = normalizedResolved.replace(/\.(ts|tsx|js|jsx)$/, '');

                    if (normalizedGraphFile === normalizedResolved ||
                        graphFileWithoutExt === resolvedWithoutExt ||
                        graphFileWithoutExt === path.join(resolvedWithoutExt, 'index')) {

                        node.imports.push(graphFile);
                        graph.get(graphFile)!.importedBy.push(file);
                        break;
                    }
                }
            }
        }
    }

    return graph;
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(graph: Map<string, DependencyNode>): CircularDependency[] {
    const circles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const foundCycles = new Set<string>(); // To avoid duplicates

    function dfs(file: string, path: string[]): void {
        if (recursionStack.has(file)) {
            // Found a cycle
            const cycleStart = path.indexOf(file);
            const cycle = path.slice(cycleStart);
            cycle.push(file);

            // Create a canonical representation to avoid duplicates
            const sorted = [...cycle].sort().join('->');
            if (!foundCycles.has(sorted)) {
                foundCycles.add(sorted);
                circles.push({
                    cycle: cycle.map(f => graph.get(f)?.relativePath || f),
                    severity: cycle.length <= 3 ? 'error' : 'warning'
                });
            }
            return;
        }

        if (visited.has(file)) {
            return;
        }

        visited.add(file);
        recursionStack.add(file);
        path.push(file);

        const node = graph.get(file);
        if (node) {
            for (const imp of node.imports) {
                dfs(imp, [...path]);
            }
        }

        recursionStack.delete(file);
    }

    for (const [file] of graph) {
        if (!visited.has(file)) {
            dfs(file, []);
        }
    }

    return circles;
}

/**
 * Identify dependency hotspots
 */
function identifyHotspots(graph: Map<string, DependencyNode>): DependencyHotspot[] {
    const hotspots: DependencyHotspot[] = [];

    for (const [file, node] of graph) {
        const incoming = node.importedBy.length;
        const outgoing = node.imports.length;
        const total = incoming + outgoing;

        let type: DependencyHotspot['type'];
        if (incoming === 0 && outgoing === 0) {
            type = 'isolated';
        } else if (incoming > outgoing * 2 && incoming > 3) {
            type = 'hub'; // Many things depend on this
        } else if (outgoing > incoming * 2 && outgoing > 3) {
            type = 'source'; // This depends on many things
        } else if (incoming > 0 && outgoing === 0) {
            type = 'sink'; // Leaf node
        } else {
            continue; // Normal file, skip
        }

        hotspots.push({
            filePath: node.relativePath,
            incomingCount: incoming,
            outgoingCount: outgoing,
            totalConnections: total,
            type
        });
    }

    // Sort by total connections
    hotspots.sort((a, b) => b.totalConnections - a.totalConnections);

    return hotspots;
}

/**
 * Find entry points (files not imported by anything)
 */
function findEntryPoints(graph: Map<string, DependencyNode>): string[] {
    const entryPoints: string[] = [];

    for (const [_, node] of graph) {
        if (node.importedBy.length === 0 && node.imports.length > 0) {
            entryPoints.push(node.relativePath);
        }
    }

    return entryPoints;
}

/**
 * Find orphaned modules (not importing or imported)
 */
function findOrphanedModules(graph: Map<string, DependencyNode>): string[] {
    const orphans: string[] = [];

    for (const [_, node] of graph) {
        if (node.importedBy.length === 0 && node.imports.length === 0) {
            // Skip test files and type definitions
            if (!node.relativePath.includes('.test.') &&
                !node.relativePath.includes('.spec.') &&
                !node.relativePath.endsWith('.d.ts')) {
                orphans.push(node.relativePath);
            }
        }
    }

    return orphans;
}

/**
 * Calculate max dependency depth from entry points
 */
function calculateMaxDepth(graph: Map<string, DependencyNode>, entryPoints: string[]): number {
    let maxDepth = 0;
    const visited = new Set<string>();

    function dfs(relativePath: string, depth: number): void {
        // Find full path from relative
        let node: DependencyNode | undefined;
        for (const [_, n] of graph) {
            if (n.relativePath === relativePath) {
                node = n;
                break;
            }
        }

        if (!node || visited.has(node.filePath)) {
            return;
        }

        visited.add(node.filePath);
        maxDepth = Math.max(maxDepth, depth);
        node.depth = depth;

        for (const imp of node.imports) {
            const impNode = graph.get(imp);
            if (impNode) {
                dfs(impNode.relativePath, depth + 1);
            }
        }
    }

    for (const entry of entryPoints) {
        dfs(entry, 0);
    }

    return maxDepth;
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate Mermaid diagram from dependency graph
 */
export function generateMermaidDiagram(
    graph: Map<string, DependencyNode>,
    options: { maxNodes?: number; focusFile?: string } = {}
): string {
    const maxNodes = options.maxNodes || 30;
    const lines: string[] = ['```mermaid', 'graph TD'];

    // Convert file paths to safe node IDs
    const nodeIds = new Map<string, string>();
    let nodeCounter = 0;

    function getNodeId(filePath: string): string {
        if (!nodeIds.has(filePath)) {
            nodeIds.set(filePath, `N${nodeCounter++}`);
        }
        return nodeIds.get(filePath)!;
    }

    // Collect edges
    const edges: Array<{ from: string; to: string }> = [];

    for (const [file, node] of graph) {
        for (const imp of node.imports) {
            edges.push({ from: file, to: imp });
        }
    }

    // Limit nodes if needed
    let nodesToShow: string[];
    if (options.focusFile) {
        // Show only nodes connected to focus file
        const connected = new Set<string>();
        for (const [file, node] of graph) {
            if (node.relativePath === options.focusFile ||
                node.imports.some(i => graph.get(i)?.relativePath === options.focusFile) ||
                node.importedBy.some(i => graph.get(i)?.relativePath === options.focusFile)) {
                connected.add(file);
            }
        }
        nodesToShow = [...connected];
    } else {
        // Show most connected nodes
        const sortedNodes = [...graph.entries()]
            .sort((a, b) =>
                (b[1].imports.length + b[1].importedBy.length) -
                (a[1].imports.length + a[1].importedBy.length)
            )
            .slice(0, maxNodes)
            .map(([file]) => file);
        nodesToShow = sortedNodes;
    }

    const nodeSet = new Set(nodesToShow);

    // Add node declarations
    for (const file of nodesToShow) {
        const node = graph.get(file)!;
        const shortName = path.basename(node.relativePath, path.extname(node.relativePath));
        lines.push(`    ${getNodeId(file)}["${shortName}"]`);
    }

    // Add edges
    for (const edge of edges) {
        if (nodeSet.has(edge.from) && nodeSet.has(edge.to)) {
            lines.push(`    ${getNodeId(edge.from)} --> ${getNodeId(edge.to)}`);
        }
    }

    lines.push('```');
    return lines.join('\n');
}

/**
 * Generate markdown report from analysis
 */
export function generateDependencyReport(analysis: DependencyAnalysis): string {
    const lines: string[] = [
        '# Dependency Analysis Report',
        '',
        `**Generated:** ${analysis.timestamp.toISOString()}`,
        `**Root:** ${analysis.rootDir}`,
        '',
        '## Summary',
        '',
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Total Files | ${analysis.totalFiles} |`,
        `| Total Dependencies | ${analysis.totalDependencies} |`,
        `| Circular Dependencies | ${analysis.circularDependencies.length} |`,
        `| Max Depth | ${analysis.maxDepth} |`,
        `| Entry Points | ${analysis.entryPoints.length} |`,
        `| Orphaned Modules | ${analysis.orphanedModules.length} |`,
        ''
    ];

    // Circular dependencies
    if (analysis.circularDependencies.length > 0) {
        lines.push('## ⚠️ Circular Dependencies', '');

        for (const circle of analysis.circularDependencies) {
            const icon = circle.severity === 'error' ? '🔴' : '🟡';
            lines.push(`${icon} **${circle.severity.toUpperCase()}:** ${circle.cycle.join(' → ')}`);
        }
        lines.push('');
    }

    // Hotspots
    if (analysis.hotspots.length > 0) {
        lines.push('## 🔥 Dependency Hotspots', '');
        lines.push('| File | Type | In | Out | Total |');
        lines.push('|------|------|---:|----:|------:|');

        for (const hotspot of analysis.hotspots.slice(0, 10)) {
            const typeIcon = {
                hub: '🎯',
                source: '📤',
                sink: '📥',
                isolated: '🏝️'
            }[hotspot.type];
            lines.push(`| ${hotspot.filePath} | ${typeIcon} ${hotspot.type} | ${hotspot.incomingCount} | ${hotspot.outgoingCount} | ${hotspot.totalConnections} |`);
        }
        lines.push('');
    }

    // Entry points
    if (analysis.entryPoints.length > 0) {
        lines.push('## 🚀 Entry Points', '');
        for (const entry of analysis.entryPoints.slice(0, 10)) {
            lines.push(`- \`${entry}\``);
        }
        lines.push('');
    }

    // Orphaned modules
    if (analysis.orphanedModules.length > 0) {
        lines.push('## 🏝️ Orphaned Modules', '');
        lines.push('*These files are neither importing nor imported by other files:*', '');
        for (const orphan of analysis.orphanedModules) {
            lines.push(`- \`${orphan}\``);
        }
        lines.push('');
    }

    // Mermaid diagram
    lines.push('## 📊 Dependency Graph', '');
    lines.push('*Top 20 most connected modules:*', '');
    lines.push(generateMermaidDiagram(analysis.graph, { maxNodes: 20 }));

    return lines.join('\n');
}

// ============================================================================
// Agent Implementation
// ============================================================================

export class DependencyGraphAgent implements IAgent {
    name = 'DependencyGraph';
    role = 'Dependency Graph Analyzer';
    description = 'Analyzes code dependencies, detects circular references, identifies hotspots, and generates dependency graphs';
    capabilities = [
        'dependency_analysis',
        'circular_detection',
        'hotspot_identification',
        'graph_visualization',
        'impact_analysis'
    ];

    private lastAnalysis: DependencyAnalysis | null = null;

    async execute(task: string, context?: unknown): Promise<AgentResponse> {
        setAgentStatus(this.name, 'working', task.slice(0, 50));
        logInfo(SOURCE, `Executing: ${task}`);

        try {
            const taskLower = task.toLowerCase();

            // Parse commands
            if (taskLower.includes('help') || taskLower.includes('segítség')) {
                return this.showHelp();
            }

            if (taskLower.includes('analyze') || taskLower.includes('elemez') || taskLower.includes('scan')) {
                return await this.runAnalysis(context);
            }

            if (taskLower.includes('circular') || taskLower.includes('körkörös')) {
                return await this.checkCircular();
            }

            if (taskLower.includes('hotspot') || taskLower.includes('kritikus')) {
                return await this.getHotspots();
            }

            if (taskLower.includes('impact') || taskLower.includes('hatás')) {
                // Extract file from task
                const fileMatch = task.match(/(?:impact|hatás)\s+(?:of\s+)?['"]?([^'"]+)['"]?/i);
                if (fileMatch) {
                    return await this.analyzeImpact(fileMatch[1]);
                }
                return {
                    status: 'error',
                    error: 'Specify a file for impact analysis: "impact of src/file.ts"'
                };
            }

            if (taskLower.includes('graph') || taskLower.includes('diagram') || taskLower.includes('gráf')) {
                return await this.generateGraph(context);
            }

            // Default: run full analysis
            return await this.runAnalysis(context);

        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            logError(SOURCE, error);
            return { status: 'error', error };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    private showHelp(): AgentResponse {
        const help = `
# DependencyGraphAgent - Help

## Commands

| Command | Description |
|---------|-------------|
| \`analyze\` | Run full dependency analysis |
| \`circular\` | Check for circular dependencies |
| \`hotspots\` | List dependency hotspots |
| \`impact of <file>\` | Analyze impact of changing a file |
| \`graph\` | Generate dependency graph diagram |

## Examples

- \`dependency analyze src/agents\`
- \`dependency circular\`
- \`dependency impact of src/utils/logger.ts\`
- \`dependency graph\`

## Analysis Output

- **Circular Dependencies:** A → B → C → A cycles
- **Hotspots:** Files with many dependencies (hubs, sinks, sources)
- **Entry Points:** Files not imported by anything
- **Orphaned Modules:** Isolated files (potential dead code)
`;

        return {
            status: 'success',
            data: { help }
        };
    }

    private async runAnalysis(context?: unknown): Promise<AgentResponse> {
        const options: AnalysisOptions = {
            rootDir: config.workspaceRoot,
            fileExtensions: DEFAULT_EXTENSIONS,
            excludePatterns: DEFAULT_EXCLUDE
        };

        // Parse context for options
        if (context && typeof context === 'object') {
            const ctx = context as Record<string, unknown>;
            if (ctx.rootDir) options.rootDir = String(ctx.rootDir);
            if (ctx.path) options.rootDir = path.join(options.rootDir!, String(ctx.path));
        }

        logInfo(SOURCE, `Scanning: ${options.rootDir}`);

        // Scan files
        const files = await scanSourceFiles(options.rootDir!, options);
        logInfo(SOURCE, `Found ${files.length} source files`);

        // Build graph
        const graph = await buildDependencyGraph(files, options);

        // Run analysis
        const circularDependencies = detectCircularDependencies(graph);
        const hotspots = identifyHotspots(graph);
        const entryPoints = findEntryPoints(graph);
        const orphanedModules = findOrphanedModules(graph);
        const maxDepth = calculateMaxDepth(graph, entryPoints);

        // Count total dependencies
        let totalDependencies = 0;
        for (const [_, node] of graph) {
            totalDependencies += node.imports.length;
        }

        this.lastAnalysis = {
            timestamp: new Date(),
            rootDir: options.rootDir!,
            totalFiles: files.length,
            totalDependencies,
            circularDependencies,
            hotspots,
            orphanedModules,
            entryPoints,
            maxDepth,
            graph
        };

        const report = generateDependencyReport(this.lastAnalysis);

        logInfo(SOURCE, `Analysis complete: ${files.length} files, ${circularDependencies.length} circular deps`);

        return {
            status: 'success',
            data: {
                summary: {
                    totalFiles: files.length,
                    totalDependencies,
                    circularDependencies: circularDependencies.length,
                    hotspots: hotspots.length,
                    orphanedModules: orphanedModules.length,
                    entryPoints: entryPoints.length,
                    maxDepth
                },
                report
            }
        };
    }

    private async checkCircular(): Promise<AgentResponse> {
        if (!this.lastAnalysis) {
            await this.runAnalysis();
        }

        const circles = this.lastAnalysis!.circularDependencies;

        if (circles.length === 0) {
            return {
                status: 'success',
                data: {
                    message: '✅ No circular dependencies found!',
                    circularDependencies: []
                }
            };
        }

        return {
            status: 'success',
            data: {
                message: `⚠️ Found ${circles.length} circular dependencies`,
                circularDependencies: circles
            }
        };
    }

    private async getHotspots(): Promise<AgentResponse> {
        if (!this.lastAnalysis) {
            await this.runAnalysis();
        }

        return {
            status: 'success',
            data: {
                hotspots: this.lastAnalysis!.hotspots
            }
        };
    }

    private async analyzeImpact(filePath: string): Promise<AgentResponse> {
        if (!this.lastAnalysis) {
            await this.runAnalysis();
        }

        const graph = this.lastAnalysis!.graph;

        // Find the node
        let targetNode: DependencyNode | undefined;
        for (const [_, node] of graph) {
            if (node.relativePath === filePath || node.relativePath.endsWith(filePath)) {
                targetNode = node;
                break;
            }
        }

        if (!targetNode) {
            return {
                status: 'error',
                error: `File not found in dependency graph: ${filePath}`
            };
        }

        // Calculate impact (files that would be affected by changes)
        const directlyAffected = targetNode.importedBy.map(f => graph.get(f)?.relativePath || f);

        // Calculate transitive impact
        const transitivelyAffected = new Set<string>();
        const queue = [...targetNode.importedBy];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const node = graph.get(current);
            if (node) {
                transitivelyAffected.add(node.relativePath);
                queue.push(...node.importedBy);
            }
        }

        return {
            status: 'success',
            data: {
                file: targetNode.relativePath,
                directDependents: directlyAffected.length,
                transitiveDependents: transitivelyAffected.size,
                directlyAffected,
                transitivelyAffected: [...transitivelyAffected],
                riskLevel: transitivelyAffected.size > 10 ? 'high' :
                    transitivelyAffected.size > 5 ? 'medium' : 'low'
            }
        };
    }

    private async generateGraph(context?: unknown): Promise<AgentResponse> {
        if (!this.lastAnalysis) {
            await this.runAnalysis(context);
        }

        const options: { maxNodes?: number; focusFile?: string } = {};

        if (context && typeof context === 'object') {
            const ctx = context as Record<string, unknown>;
            if (ctx.maxNodes) options.maxNodes = Number(ctx.maxNodes);
            if (ctx.focus) options.focusFile = String(ctx.focus);
        }

        const diagram = generateMermaidDiagram(this.lastAnalysis!.graph, options);

        return {
            status: 'success',
            data: { diagram }
        };
    }
}

// Export singleton instance
export const dependencyGraphAgent = new DependencyGraphAgent();
