/**
 * Context/memory management – Gemini-style: discover BRUNELLA.md / GEMINI.md,
 * load from cwd up to project root, optional @path imports.
 *
 * Note: This module requires a Node.js environment with file system access.
 * It uses dynamic imports for 'fs', 'path', and 'os' to remain compatible with
 * build environments (like Cloudflare Workers) that do not include these modules.
 */

// Define types for the modules we need
type FS = typeof import('fs');
type Path = typeof import('path');
type OS = typeof import('os');

let fs: FS | null = null;
let path: Path | null = null;
let os: OS | null = null;

const DEFAULT_NAMES = ['BRUNELLA.md', 'GEMINI.md'];
const MAX_DIRS = 200;

export interface MemoryConfig {
  fileName?: string | string[];
  includeDirectories?: string[];
  discoveryMaxDirs?: number;
}

async function ensureModules() {
  if (fs && path && os) return;
  try {
    const fsMod = await import('fs');
    const pathMod = await import('path');
    const osMod = await import('os');

    // In Node.js environment, these should be available.
    // We cast to any to avoid TS errors with 'default' property checks if types are strict
    fs = (fsMod as any).default || fsMod;
    path = (pathMod as any).default || pathMod;
    os = (osMod as any).default || osMod;
  } catch (e) {
    throw new Error('This function requires a Node.js environment with fs, path, and os modules.');
  }
}

async function exists(p: string): Promise<boolean> {
  await ensureModules();
  if (!fs) throw new Error('fs module not loaded');
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findProjectRoot(dir: string): Promise<string> {
  await ensureModules();
  if (!path || !fs) throw new Error('Modules not loaded');

  let d = path.resolve(dir);
  const root = path.parse(d).root;
  while (d !== root) {
    if (await exists(path.join(d, '.git'))) return d;
    d = path.dirname(d);
  }
  return path.resolve(dir);
}

async function resolveImports(content: string, baseDir: string, seen: Set<string>): Promise<string> {
  await ensureModules();
  if (!path || !fs) throw new Error('Modules not loaded');

  const re = /@([^\s\]<>]+\.md)/g;
  const matches = Array.from(content.matchAll(re));

  if (matches.length === 0) return content;

  let result = '';
  let lastIndex = 0;

  for (const match of matches) {
    const fullMatch = match[0];
    const subPath = match[1];

    result += content.slice(lastIndex, match.index!);

    const resolved = path.resolve(baseDir, subPath.replace(/^@/, ''));
    const norm = path.normalize(resolved);

    let replacement = '';
    if (seen.has(norm)) {
      replacement = '';
    } else {
      seen.add(norm);
      if (!(await exists(norm))) {
        replacement = `\n[missing: ${subPath}]\n`;
      } else {
        try {
          const text = await fs.promises.readFile(norm, 'utf-8');
          // Recursive call
          replacement = '\n' + await resolveImports(text, path.dirname(norm), seen) + '\n';
        } catch {
          replacement = `\n[error: ${subPath}]\n`;
        }
      }
    }

    result += replacement;
    lastIndex = match.index! + fullMatch.length;
  }

  result += content.slice(lastIndex);
  return result;
}

/** Discover paths of context files: global (~/.brunella/<name>), project root and ancestors, then subdirs (limited). */
export async function discoverMemoryPaths(cwd: string, config: MemoryConfig): Promise<string[]> {
  await ensureModules();
  if (!path || !os || !fs) throw new Error('Modules not loaded');

  const names: string[] = Array.isArray(config.fileName)
    ? config.fileName
    : config.fileName
      ? [config.fileName]
      : DEFAULT_NAMES;
  const out: string[] = [];
  const home = os.homedir();

  for (const name of names) {
    const globalPath = path.join(home, '.brunella', name);
    if (await exists(globalPath)) out.push(globalPath);
  }

  const root = await findProjectRoot(cwd);
  let dir = cwd;
  const rootPath = path.parse(root).root;
  while (dir !== rootPath) {
    for (const name of names) {
      const p = path.join(dir, name);
      if ((await exists(p)) && !out.includes(p)) out.push(p);
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }

  const maxDirs = config.discoveryMaxDirs ?? MAX_DIRS;
  let count = 0;
  async function scan(dir: string) {
    if (count >= maxDirs) return;
    try {
      // Must use the local variable `fs` which is typed as module default
      const entries = await fs!.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
        if (e.isDirectory()) {
          count++;
          if (count < maxDirs) await scan(path!.join(dir, e.name));
        } else if (e.isFile()) {
          for (const name of names) {
            if (e.name === name) {
              const p = path!.join(dir, e.name);
              if (!out.includes(p)) out.push(p);
            }
          }
        }
      }
    } catch {
      /* skip */
    }
  }
  await scan(cwd);

  const includeDirs = config.includeDirectories ?? [];
  for (const inc of includeDirs) {
    const expanded = inc.startsWith('~') ? path.join(home, inc.slice(1)) : inc;
    const resolved = path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
    if (!(await exists(resolved))) continue;
    for (const name of names) {
      const p = path.join(resolved, name);
      if ((await exists(p)) && !out.includes(p)) out.push(p);
    }
  }

  return out;
}

/** Load and concatenate memory files, resolving @path/to/file.md imports. */
export async function loadMemoryContent(paths: string[]): Promise<{ combined: string; byPath: Array<{ path: string; content: string }> }> {
  await ensureModules();
  if (!fs || !path) throw new Error('Modules not loaded');

  const byPath: Array<{ path: string; content: string }> = [];
  const seen = new Set<string>();
  for (const p of paths) {
    try {
      let content = await fs.promises.readFile(p, 'utf-8');
      content = await resolveImports(content, path.dirname(p), seen);
      byPath.push({ path: p, content });
    } catch {
      byPath.push({ path: p, content: `[read error: ${p}]` });
    }
  }
  const combined = byPath.map((x) => `--- ${x.path} ---\n${x.content}`).join('\n\n');
  return { combined, byPath };
}

/** One-shot: discover paths and load content. */
export async function getMemory(cwd: string, config: MemoryConfig) {
  const paths = await discoverMemoryPaths(cwd, config);
  const content = await loadMemoryContent(paths);
  return { paths, ...content };
}
