#!/usr/bin/env npx tsx
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export interface RegistryAgent {
  name: string;
  module: string;
  class: string;
  status?: string;
}

export interface AgentHealthRecord {
  name: string;
  modulePath: string;
  exportName: string | null;
  status: 'ok' | 'fail' | 'skip';
  message: string;
}

export interface AgentHealthSummary {
  total: number;
  ok: number;
  fail: number;
  skip: number;
  records: AgentHealthRecord[];
}

function resolveRegistry(rootDir: string): { registryPath: string; buildMode: boolean } {
  const buildRegistryPath = path.resolve(rootDir, 'build', 'agents', 'registry.json');
  if (fs.existsSync(buildRegistryPath)) {
    return { registryPath: buildRegistryPath, buildMode: true };
  }

  const sourceRegistryPath = path.resolve(rootDir, 'src', 'agents', 'registry.json');
  return { registryPath: sourceRegistryPath, buildMode: false };
}

function resolveModulePath(rootDir: string, modulePath: string, buildMode: boolean): string {
  if (buildMode) {
    return path.resolve(rootDir, 'build', modulePath.replace('./', ''));
  }

  return path.resolve(
    rootDir,
    'src',
    modulePath
      .replace('./', '')
      .replace(/\.js$/u, '.ts'),
  );
}

function pickExport(imported: Record<string, unknown>, className: string): { exportName: string | null; ctor: (new (...args: unknown[]) => unknown) | null } {
  const exact = imported[className];
  if (typeof exact === 'function') {
    return { exportName: className, ctor: exact as new (...args: unknown[]) => unknown };
  }

  if (typeof imported.default === 'function') {
    return { exportName: 'default', ctor: imported.default as new (...args: unknown[]) => unknown };
  }

  const fallback = Object.entries(imported).find(([, value]) => typeof value === 'function');
  if (fallback) {
    return {
      exportName: fallback[0],
      ctor: fallback[1] as new (...args: unknown[]) => unknown,
    };
  }

  return { exportName: null, ctor: null };
}

export async function runAgentHealthCheck(rootDir: string = process.cwd()): Promise<AgentHealthSummary> {
  const { registryPath, buildMode } = resolveRegistry(rootDir);
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { agents?: RegistryAgent[] };
  const agents = Array.isArray(registry.agents)
    ? registry.agents.filter((agent) => agent.status !== 'disabled')
    : [];

  const records: AgentHealthRecord[] = [];

  for (const agent of agents) {
    const resolvedModulePath = resolveModulePath(rootDir, agent.module, buildMode);

    if (!fs.existsSync(resolvedModulePath)) {
      records.push({
        name: agent.name,
        modulePath: resolvedModulePath,
        exportName: null,
        status: 'fail',
        message: 'Module file missing',
      });
      continue;
    }

    try {
      const imported = (await import(pathToFileURL(resolvedModulePath).href)) as Record<string, unknown>;
      const picked = pickExport(imported, agent.class);

      if (!picked.ctor) {
        records.push({
          name: agent.name,
          modulePath: resolvedModulePath,
          exportName: picked.exportName,
          status: 'skip',
          message: 'No constructable export found',
        });
        continue;
      }

      let instance: unknown = null;
      let instantiated = false;
      try {
        instance = new picked.ctor(agent);
        instantiated = true;
      } catch {
        try {
          instance = new picked.ctor();
          instantiated = true;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          records.push({
            name: agent.name,
            modulePath: resolvedModulePath,
            exportName: picked.exportName,
            status: 'skip',
            message: `Constructor requires external dependencies: ${message}`,
          });
        }
      }

      if (!instantiated) {
        continue;
      }

      const hasExecute = Boolean(instance && typeof instance === 'object' && ('execute' in instance || 'executeTask' in instance));
      if (!hasExecute) {
        records.push({
          name: agent.name,
          modulePath: resolvedModulePath,
          exportName: picked.exportName,
          status: 'fail',
          message: 'Instance missing execute/executeTask method',
        });
        continue;
      }

      records.push({
        name: agent.name,
        modulePath: resolvedModulePath,
        exportName: picked.exportName,
        status: 'ok',
        message: 'Import + instantiation OK',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      records.push({
        name: agent.name,
        modulePath: resolvedModulePath,
        exportName: null,
        status: 'fail',
        message,
      });
    }
  }

  return {
    total: records.length,
    ok: records.filter((record) => record.status === 'ok').length,
    fail: records.filter((record) => record.status === 'fail').length,
    skip: records.filter((record) => record.status === 'skip').length,
    records,
  };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const json = args.has('--json');
  const failOnIssues = args.has('--fail-on-issues');
  const summary = await runAgentHealthCheck(process.cwd());

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('Agent Health Matrix');
    console.log('===================');
    console.table(summary.records.map((record) => ({
      agent: record.name,
      status: record.status.toUpperCase(),
      export: record.exportName ?? '—',
      message: record.message,
    })));
    console.log(`OK: ${summary.ok} | FAIL: ${summary.fail} | SKIP: ${summary.skip} | TOTAL: ${summary.total}`);
  }

  if ((failOnIssues && summary.fail > 0) || summary.fail > 0) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  void main();
}
