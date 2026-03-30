#!/usr/bin/env npx tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGeneratedBootstrapContent,
  SOURCE_RELATIVE_PATH as BOOTSTRAP_SOURCE_RELATIVE_PATH,
  TARGET_RELATIVE_PATHS as BOOTSTRAP_TARGET_RELATIVE_PATHS,
  syncBootstrapCopies,
} from './sync_bootstrap.js';

export interface ProjectStats {
  agentCount: number;
  routeModuleCount: number;
  activeRouteMountCount: number;
  toolFileCount: number;
  mcpToolDefinitionCount: number;
  cliCommandCount: number;
  dashboardPanelCount: number;
}

export interface DocUpdateResult {
  filePath: string;
  changed: boolean;
}

interface PendingDocUpdate {
  relativePath: string;
  absolutePath: string;
  currentContent: string;
  nextContent: string;
  changed: boolean;
}

const README_RELATIVE_PATH = 'README.md';
const PROJECT_DIAGRAM_RELATIVE_PATH = 'PROJEKT_DIAGRAM.md';
const MANAGED_BLOCK_START = '<!-- DOC_STATS_START -->';
const MANAGED_BLOCK_END = '<!-- DOC_STATS_END -->';

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function listTypeScriptFiles(dirPath: string): string[] {
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
    .map((entry) => path.join(dirPath, entry.name));
}

function countOccurrences(input: string, pattern: RegExp): number {
  return [...input.matchAll(pattern)].length;
}

export function collectProjectStats(rootDir: string = process.cwd()): ProjectStats {
  const registryPath = path.resolve(rootDir, 'src', 'agents', 'registry.json');
  const registry = JSON.parse(readText(registryPath)) as { agents?: unknown[] };
  const routesDir = path.resolve(rootDir, 'src', 'server', 'routes');
  const toolsDir = path.resolve(rootDir, 'src', 'tools');
  const navigationPath = path.resolve(rootDir, 'src', 'dashboard', 'lib', 'navigation.tsx');
  const cliRootPath = path.resolve(rootDir, 'src', 'cli.ts');
  const cliDir = path.resolve(rootDir, 'src', 'cli');
  const routesIndexPath = path.resolve(rootDir, 'src', 'server', 'routes', 'index.ts');

  const routeModuleCount = listTypeScriptFiles(routesDir).length;
  const toolFileCount = listTypeScriptFiles(toolsDir).length;
  const mcpToolDefinitionCount = listTypeScriptFiles(toolsDir)
    .map((filePath) => readText(filePath))
    .reduce((sum, fileContent) => sum + countOccurrences(fileContent, /export const\s+[A-Za-z0-9_]+Definition\s*=|server\.registerTool\(/g), 0);

  const cliFiles = [cliRootPath, ...listTypeScriptFiles(cliDir)];
  const cliCommandCount = cliFiles
    .map((filePath) => readText(filePath))
    .reduce((sum, fileContent) => sum + countOccurrences(fileContent, /\.command\(/g), 0);

  const navigationContent = readText(navigationPath);
  const dashboardPanelCount = countOccurrences(navigationContent, /\{\s*id:\s*"[^"]+"/g);
  const activeRouteMountCount = countOccurrences(readText(routesIndexPath), /router\.use\(/g);

  return {
    agentCount: Array.isArray(registry.agents) ? registry.agents.length : 0,
    routeModuleCount,
    activeRouteMountCount,
    toolFileCount,
    mcpToolDefinitionCount,
    cliCommandCount,
    dashboardPanelCount,
  };
}

export function formatManagedStatsBlock(stats: ProjectStats): string {
  return [
    MANAGED_BLOCK_START,
    '## 📊 Auto-generated projekt statisztikák',
    '',
    `- Agent registry entries: **${stats.agentCount}**`,
    `- Route modulok a \`src/server/routes/\` alatt: **${stats.routeModuleCount}**`,
    `- Aktív route mountok a központi routerben: **${stats.activeRouteMountCount}**`,
    `- MCP tool fájlok a \`src/tools/\` alatt: **${stats.toolFileCount}**`,
    `- Detektált MCP tool definíciók / regisztrációk: **${stats.mcpToolDefinitionCount}**`,
    `- CLI parancs deklarációk: **${stats.cliCommandCount}**`,
    `- Dashboard navigációs panelek: **${stats.dashboardPanelCount}**`,
    '',
    '> Ezt a blokkot a `npm run sync:doc-stats` generálja.',
    MANAGED_BLOCK_END,
  ].join('\n');
}

function upsertManagedBlock(content: string, block: string, anchor: string): string {
  const managedBlockPattern = new RegExp(`${MANAGED_BLOCK_START}[\\s\\S]*?${MANAGED_BLOCK_END}`);
  if (managedBlockPattern.test(content)) {
    return content.replace(managedBlockPattern, block);
  }

  if (content.includes(anchor)) {
    return content.replace(anchor, `${block}\n\n${anchor}`);
  }

  return `${content.trimEnd()}\n\n${block}\n`;
}

export function applyStatsToDocument(relativePath: string, content: string, stats: ProjectStats): string {
  if (relativePath === README_RELATIVE_PATH) {
    const updated = content
      .replace(/(`src\/agents\/registry\.json` \()\d+ agent(\))/g, `$1${stats.agentCount} agent$2`);
    return upsertManagedBlock(updated, formatManagedStatsBlock(stats), '### 3. Rendszer Validáció & Teszt Protokoll (Munka ELŐTT - KÖTELEZŐ!)');
  }

  if (relativePath === BOOTSTRAP_SOURCE_RELATIVE_PATH) {
    const updated = content
      .replace(/└─\s+\d+ AI Agents \(IAgent interface\)/g, `└─ ${stats.agentCount} AI Agents (IAgent interface)`)
      .replace(/- `src\/agents\/` - \d+\+? AI ügynök/g, `- \`src/agents/\` - ${stats.agentCount} AI ügynök`)
      .replace(/- `src\/server\/` - Backend API \+ MCP registry \(~?\d+ route fájl\)/g, `- \`src/server/\` - Backend API + MCP registry (${stats.routeModuleCount} route fájl)`);
    return upsertManagedBlock(updated, formatManagedStatsBlock(stats), '## 📂 HOL VANNAK A FONTOS DOLGOK?');
  }

  if (relativePath === PROJECT_DIAGRAM_RELATIVE_PATH) {
    const updated = content
      .replace(/\[\d+ agents total\.\.\.\]/g, `[${stats.agentCount} agents total...]`)
      .replace(/\[\d+\+ tool handlers\.\.\.\]/g, `[${stats.toolFileCount} tool files / ${stats.mcpToolDefinitionCount} MCP definitions...]`);
    return upsertManagedBlock(updated, formatManagedStatsBlock(stats), '## 📂 Fájl Struktúra (Kritikus Komponensek)');
  }

  return content;
}

export function syncDocStats(rootDir: string = process.cwd(), dryRun = false): { stats: ProjectStats; results: DocUpdateResult[] } {
  const stats = collectProjectStats(rootDir);
  const managedFiles = [README_RELATIVE_PATH, BOOTSTRAP_SOURCE_RELATIVE_PATH, PROJECT_DIAGRAM_RELATIVE_PATH];

  const updates: PendingDocUpdate[] = managedFiles.map((relativePath) => {
    const absolutePath = path.resolve(rootDir, relativePath);
    const currentContent = readText(absolutePath);
    const nextContent = applyStatsToDocument(relativePath, currentContent, stats);
    const changed = currentContent !== nextContent;

    if (!dryRun && changed) {
      fs.writeFileSync(absolutePath, nextContent, 'utf8');
      console.log(`[sync:doc-stats] Updated ${relativePath}`);
    }

    return {
      relativePath,
      absolutePath,
      currentContent,
      nextContent,
      changed,
    };
  });

  const bootstrapSourceUpdate = updates.find((update) => update.relativePath === BOOTSTRAP_SOURCE_RELATIVE_PATH);
  const bootstrapSourceContent = bootstrapSourceUpdate?.nextContent
    ?? readText(path.resolve(rootDir, BOOTSTRAP_SOURCE_RELATIVE_PATH));

  const bootstrapCopyResults: DocUpdateResult[] = dryRun
    ? BOOTSTRAP_TARGET_RELATIVE_PATHS.map((relativePath) => {
      const absolutePath = path.resolve(rootDir, relativePath);
      const currentContent = fs.existsSync(absolutePath) ? readText(absolutePath) : '';
      const generatedContent = buildGeneratedBootstrapContent(bootstrapSourceContent);

      return {
        filePath: absolutePath,
        changed: currentContent !== generatedContent,
      };
    })
    : syncBootstrapCopies({ rootDir }).map((result) => ({
      filePath: result.targetPath,
      changed: result.changed,
    }));

  return {
    stats,
    results: [
      ...updates.map((update) => ({
        filePath: update.absolutePath,
        changed: update.changed,
      })),
      ...bootstrapCopyResults,
    ],
  };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const json = args.has('--json');
  const failOnDrift = args.has('--fail-on-drift');

  const { stats, results } = syncDocStats(process.cwd(), dryRun);
  const changedFiles = results.filter((result) => result.changed);

  if (json) {
    console.log(JSON.stringify({ stats, changedFiles: changedFiles.map((result) => path.relative(process.cwd(), result.filePath)) }, null, 2));
  } else {
    console.log('[sync:doc-stats] Current project stats:');
    console.table({
      agents: stats.agentCount,
      routeModules: stats.routeModuleCount,
      activeRouteMounts: stats.activeRouteMountCount,
      toolFiles: stats.toolFileCount,
      toolDefinitions: stats.mcpToolDefinitionCount,
      cliCommands: stats.cliCommandCount,
      dashboardPanels: stats.dashboardPanelCount,
    });

    if (changedFiles.length === 0) {
      console.log(`[sync:doc-stats] ${dryRun ? 'No documentation drift detected.' : 'Documentation already up to date.'}`);
    } else {
      console.log(`[sync:doc-stats] Drift detected in ${changedFiles.length} file(s): ${changedFiles.map((result) => path.relative(process.cwd(), result.filePath)).join(', ')}`);
    }
  }

  if ((dryRun || failOnDrift) && changedFiles.length > 0) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  void main();
}
