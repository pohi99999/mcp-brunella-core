import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectProjectStats, syncDocStats } from '../scripts/sync_doc_stats.ts';

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bas-doc-sync-'));
}

function writeFile(rootDir: string, relativePath: string, content: string): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function seedProjectStructure(rootDir: string): void {
  writeFile(rootDir, path.join('src', 'agents', 'registry.json'), JSON.stringify({ agents: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }));
  writeFile(rootDir, path.join('src', 'server', 'routes', 'index.ts'), 'router.use("/alpha", alphaRouter);\nrouter.use("/beta", betaRouter);\n');
  writeFile(rootDir, path.join('src', 'server', 'routes', 'alpha.ts'), 'export const alphaRouter = {};\n');
  writeFile(rootDir, path.join('src', 'server', 'routes', 'beta.ts'), 'export const betaRouter = {};\n');
  writeFile(rootDir, path.join('src', 'tools', 'alpha.ts'), 'export const alphaDefinition = {};\n');
  writeFile(rootDir, path.join('src', 'tools', 'beta.ts'), 'export const betaDefinition = {};\n');
  writeFile(rootDir, path.join('src', 'dashboard', 'lib', 'navigation.tsx'), '{ id: "panel-one", label: "One" }\n{ id: "panel-two", label: "Two" }\n');
  writeFile(rootDir, path.join('src', 'cli.ts'), 'program.command("root");\n');
  writeFile(rootDir, path.join('src', 'cli', 'extra.ts'), 'program.command("extra");\n');
}

const tempRoots: string[] = [];

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('sync_doc_stats', () => {
  it('collects project stats from the workspace structure', () => {
    const rootDir = createTempRoot();
    tempRoots.push(rootDir);
    seedProjectStructure(rootDir);

    const stats = collectProjectStats(rootDir);

    expect(stats.agentCount).toBe(3);
    expect(stats.routeModuleCount).toBe(3);
    expect(stats.activeRouteMountCount).toBe(2);
    expect(stats.toolFileCount).toBe(2);
    expect(stats.mcpToolDefinitionCount).toBe(2);
    expect(stats.cliCommandCount).toBe(2);
    expect(stats.dashboardPanelCount).toBe(2);
  });

  it('updates docs and propagates bootstrap copies from the source file', () => {
    const rootDir = createTempRoot();
    tempRoots.push(rootDir);
    seedProjectStructure(rootDir);

    writeFile(rootDir, 'README.md', [
      '# README',
      '`src/agents/registry.json` (0 agent)',
      '### 3. Rendszer Validáció & Teszt Protokoll (Munka ELŐTT - KÖTELEZŐ!)',
    ].join('\n'));

    writeFile(rootDir, path.join('.ai', 'BOOTSTRAP.md'), [
      '└─ 0 AI Agents (IAgent interface)',
      '- `src/agents/` - 0 AI ügynök',
      '- `src/server/` - Backend API + MCP registry (~0 route fájl)',
      '## 📂 HOL VANNAK A FONTOS DOLGOK?',
    ].join('\n'));

    writeFile(rootDir, path.join('docs', 'PROJEKT_DIAGRAM.md'), [
      '[0 agents total...]',
      '[0+ tool handlers...]',
      '## 📂 Fájl Struktúra (Kritikus Komponensek)',
    ].join('\n'));

    writeFile(rootDir, 'BOOTSTRAP.md', 'outdated root copy');
    writeFile(rootDir, path.join('.vscode', 'BOOTSTRAP.md'), 'outdated vscode copy');

    const dryRun = syncDocStats(rootDir, true);
    expect(dryRun.results.some((result) => result.changed)).toBe(true);

    const applied = syncDocStats(rootDir, false);
    expect(applied.results.filter((result) => result.changed)).not.toHaveLength(0);

    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
    const bootstrapSource = fs.readFileSync(path.join(rootDir, '.ai', 'BOOTSTRAP.md'), 'utf8');
    const bootstrapCopy = fs.readFileSync(path.join(rootDir, 'BOOTSTRAP.md'), 'utf8');
    const vscodeBootstrapCopy = fs.readFileSync(path.join(rootDir, '.vscode', 'BOOTSTRAP.md'), 'utf8');
    const projectDiagram = fs.readFileSync(path.join(rootDir, 'docs', 'PROJEKT_DIAGRAM.md'), 'utf8');

    expect(readme).toContain('Agent registry entries: **3**');
    expect(bootstrapSource).toContain('└─ 3 AI Agents (IAgent interface)');
    expect(bootstrapSource).toContain('<!-- DOC_STATS_START -->');
    expect(bootstrapCopy).toContain('GENERATED FILE - DO NOT EDIT DIRECTLY');
    expect(bootstrapCopy).toContain('└─ 3 AI Agents (IAgent interface)');
    expect(vscodeBootstrapCopy).toBe(bootstrapCopy);
    expect(projectDiagram).toContain('[3 agents total...]');

    const afterSyncDryRun = syncDocStats(rootDir, true);
    expect(afterSyncDryRun.results.every((result) => !result.changed)).toBe(true);
  });
});