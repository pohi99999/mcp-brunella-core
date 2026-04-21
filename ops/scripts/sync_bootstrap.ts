#!/usr/bin/env npx tsx
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SOURCE_RELATIVE_PATH = path.join('.ai', 'BOOTSTRAP.md');
export const TARGET_RELATIVE_PATHS = [
  'BOOTSTRAP.md',
  path.join('.vscode', 'BOOTSTRAP.md'),
] as const;

const GENERATED_BANNER = [
  '<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->',
  '> ⚠️ Ez egy generált BOOTSTRAP másolat. A forrás: `.ai/BOOTSTRAP.md`.',
  '> Futtasd: `npm run sync:bootstrap` vagy szerkeszd a forrást.',
  '',
].join('\n');

export interface BootstrapSyncResult {
  sourcePath: string;
  targetPath: string;
  changed: boolean;
  driftDetected: boolean;
}

export interface BootstrapSyncOptions {
  rootDir?: string;
  check?: boolean;
  stage?: boolean;
}

export function buildGeneratedBootstrapContent(sourceContent: string): string {
  return `${GENERATED_BANNER}${sourceContent.replace(/^\uFEFF/, '')}`;
}

export function syncBootstrapCopies(options: BootstrapSyncOptions = {}): BootstrapSyncResult[] {
  const rootDir = options.rootDir ?? process.cwd();
  const sourcePath = path.resolve(rootDir, SOURCE_RELATIVE_PATH);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Bootstrap source not found: ${sourcePath}`);
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const generatedContent = buildGeneratedBootstrapContent(sourceContent);

  return TARGET_RELATIVE_PATHS.map((relativeTargetPath) => {
    const targetPath = path.resolve(rootDir, relativeTargetPath);
    const currentContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
    const driftDetected = currentContent.length > 0 && currentContent !== generatedContent;
    const changed = currentContent !== generatedContent;

    if (driftDetected) {
      console.warn(`[sync:bootstrap] Drift detected in generated copy: ${path.relative(rootDir, targetPath)}`);
    }

    if (!options.check && changed) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, generatedContent, 'utf8');
      console.log(`[sync:bootstrap] Updated ${path.relative(rootDir, targetPath)}`);

      if (options.stage) {
        try {
          execFileSync('git', ['add', targetPath], { cwd: rootDir, stdio: 'ignore' });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[sync:bootstrap] Failed to stage ${path.relative(rootDir, targetPath)}: ${message}`);
        }
      }
    }

    return {
      sourcePath,
      targetPath,
      changed,
      driftDetected,
    };
  });
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const check = args.has('--check') || args.has('--dry-run');
  const stage = args.has('--stage');

  const results = syncBootstrapCopies({ check, stage });
  const changedCount = results.filter((result) => result.changed).length;

  if (check) {
    if (changedCount > 0) {
      console.log(`[sync:bootstrap] ${changedCount} generated BOOTSTRAP copy/copies out of sync.`);
      process.exitCode = 1;
      return;
    }

    console.log('[sync:bootstrap] BOOTSTRAP copies are in sync.');
    return;
  }

  if (changedCount === 0) {
    console.log('[sync:bootstrap] No changes needed.');
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  void main();
}
