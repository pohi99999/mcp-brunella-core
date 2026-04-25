/**
 * Context/memory management – Gemini-style: discover BRUNELLA.md / GEMINI.md,
 * load from cwd up to project root, optional @path imports.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_NAMES = ['BRUNELLA.md', 'GEMINI.md'];
const MAX_DIRS = 200;

export interface MemoryConfig {
  fileName?: string | string[];
  includeDirectories?: string[];
  discoveryMaxDirs?: number;
}

function findProjectRoot(dir: string): string {
  const resolvedDir = path.resolve(dir);
  const workspaceRoot = path.resolve(process.cwd());
  const relativeToWorkspace = path.relative(workspaceRoot, resolvedDir);
  if (relativeToWorkspace.startsWith('..') || path.isAbsolute(relativeToWorkspace)) {
    return resolvedDir;
  }

  let d = resolvedDir;
  const root = path.parse(d).root;
  while (d !== root) {
    if (
      fs.existsSync(path.join(d, '.git')) &&
      (fs.existsSync(path.join(d, 'package.json')) || fs.existsSync(path.join(d, 'conductor')))
    ) {
      return d;
    }
    d = path.dirname(d);
  }
  return path.resolve(dir);
}

function resolveImports(content: string, baseDir: string, seen: Set<string>): string {
  const re = /@([^\s\]<>]+\.md)/g;
  return content.replace(re, (_, subPath: string) => {
    const resolved = path.resolve(baseDir, subPath.replace(/^@/, ''));
    const norm = path.normalize(resolved);
    if (seen.has(norm)) return '';
    seen.add(norm);
    if (!fs.existsSync(norm)) return `\n[missing: ${subPath}]\n`;
    try {
      const text = fs.readFileSync(norm, 'utf-8');
      return '\n' + resolveImports(text, path.dirname(norm), seen) + '\n';
    } catch {
      return `\n[error: ${subPath}]\n`;
    }
  });
}

/** Discover paths of context files: global (~/.brunella/<name>), project root and ancestors, then subdirs (limited). */
export function discoverMemoryPaths(cwd: string, config: MemoryConfig): string[] {
  const names: string[] = Array.isArray(config.fileName)
    ? config.fileName
    : config.fileName
      ? [config.fileName]
      : DEFAULT_NAMES;
  const out: string[] = [];
  const home = os.homedir();

  const root = findProjectRoot(cwd);
  let dir = cwd;
  const rootPath = path.parse(root).root;
  while (dir !== rootPath) {
    for (const name of names) {
      const p = path.join(dir, name);
      if (fs.existsSync(p) && !out.includes(p)) out.push(p);
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }

  const maxDirs = config.discoveryMaxDirs ?? MAX_DIRS;
  let count = 0;
  function scan(dir: string) {
    if (count >= maxDirs) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
        if (e.isDirectory()) {
          count++;
          if (count < maxDirs) scan(path.join(dir, e.name));
        } else if (e.isFile()) {
          for (const name of names) {
            if (e.name === name) {
              const p = path.join(dir, e.name);
              if (!out.includes(p)) out.push(p);
            }
          }
        }
      }
    } catch {
      /* skip */
    }
  }
  scan(cwd);

  const includeDirs = config.includeDirectories ?? [];
  for (const inc of includeDirs) {
    const expanded = inc.startsWith('~') ? path.join(home, inc.slice(1)) : inc;
    const resolved = path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
    if (!fs.existsSync(resolved)) continue;
    for (const name of names) {
      const p = path.join(resolved, name);
      if (fs.existsSync(p) && !out.includes(p)) out.push(p);
    }
  }

  return out;
}

/** Load and concatenate memory files, resolving @path/to/file.md imports. */
export function loadMemoryContent(paths: string[]): { combined: string; byPath: Array<{ path: string; content: string }> } {
  const byPath: Array<{ path: string; content: string }> = [];
  const seen = new Set<string>();
  for (const p of paths) {
    try {
      let content = fs.readFileSync(p, 'utf-8');
      content = resolveImports(content, path.dirname(p), seen);
      byPath.push({ path: p, content });
    } catch {
      byPath.push({ path: p, content: `[read error: ${p}]` });
    }
  }
  const combined = byPath.map((x) => `--- ${x.path} ---\n${x.content}`).join('\n\n');
  return { combined, byPath };
}

/** One-shot: discover paths and load content. */
export function getMemory(cwd: string, config: MemoryConfig) {
  const paths = discoverMemoryPaths(cwd, config);
  return { paths, ...loadMemoryContent(paths) };
}
