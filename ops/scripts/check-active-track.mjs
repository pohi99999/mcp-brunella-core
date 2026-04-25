import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const repoRoot = process.cwd();
const tracksDir = path.join(repoRoot, 'conductor', 'tracks');

function toFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, '/')}`;
}

function collectActiveTracks() {
  if (!fs.existsSync(tracksDir)) {
    return [];
  }

  return fs.readdirSync(tracksDir)
    .map((entry) => path.join(tracksDir, entry, 'meta.json'))
    .filter((metaPath) => fs.existsSync(metaPath))
    .map((metaPath) => {
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter((meta) => meta && typeof meta === 'object')
    .filter((meta) => {
      const status = typeof meta.status === 'string' ? meta.status.toLowerCase() : '';
      return status === 'active' || status === 'testing' || status === 'in_progress';
    });
}

function collectStagedFiles() {
  try {
    const output = execSync('git --no-pager diff --cached --name-only', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function emitPreCommitHook(stagedFiles, activeTracks) {
  const hookRegistryPath = path.join(repoRoot, 'build', 'packages', 'core-logic', 'hookRegistry.js');
  const builtinHooksPath = path.join(repoRoot, 'build', 'packages', 'core-logic', 'hooks', 'builtinHooks.js');

  if (!fs.existsSync(hookRegistryPath) || !fs.existsSync(builtinHooksPath)) {
    throw new Error('Hook runtime not built; pre-commit hook cannot run safely.');
  }

  const [{ fireHook }, { initializeBuiltinHooks }] = await Promise.all([
    import(toFileUrl(hookRegistryPath)),
    import(toFileUrl(builtinHooksPath)),
  ]);

  initializeBuiltinHooks();
  await fireHook('git:pre:commit', {
    stagedFiles,
    activeTracks: activeTracks.map((track) => ({
      id: track.id ?? track.track_id ?? 'unknown-track',
      name: track.name ?? track.title ?? 'Unknown track',
      status: track.status ?? 'active',
    })),
  }, {
    source: 'pre-commit',
    metadata: { stagedFiles: stagedFiles.length, activeTracks: activeTracks.length },
  });
}

const activeTracks = collectActiveTracks();
const stagedFiles = collectStagedFiles();

if (stagedFiles.length === 0) {
  process.exit(0);
}

if (process.env.BRUNELLA_ALLOW_NO_ACTIVE_TRACK === '1') {
  await emitPreCommitHook(stagedFiles, activeTracks);
  process.exit(0);
}

if (activeTracks.length === 0) {
  console.error('Pre-commit blocked: nincs aktiv conductor track. Hasznalj BRUNELLA_ALLOW_NO_ACTIVE_TRACK=1 override-ot, ha ez szandekos.');
  process.exit(1);
}

await emitPreCommitHook(stagedFiles, activeTracks);
const summary = activeTracks
  .slice(0, 5)
  .map((track) => track.id ?? track.track_id ?? 'unknown-track')
  .join(', ');
console.log(`Active track guard OK: ${activeTracks.length} aktiv track (${summary})`);
