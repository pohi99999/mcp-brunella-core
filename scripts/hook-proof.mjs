import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

function runGit(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function resolveGitDir() {
  try {
    const gitDir = runGit(['rev-parse', '--git-dir']);
    return path.resolve(repoRoot, gitDir);
  } catch {
    return null;
  }
}

const gitDir = resolveGitDir();
const stateDir = gitDir ? path.join(gitDir, 'brunella-hook-proof') : null;
const verifiedFile = stateDir ? path.join(stateDir, 'verified-commits.json') : null;
const pendingFile = stateDir ? path.join(stateDir, 'precommit-pending.json') : null;

function ensureStateDir() {
  if (!stateDir) {
    return false;
  }

  fs.mkdirSync(stateDir, { recursive: true });
  return true;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function readJson(filePath, fallback) {
  if (!filePath || !fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function currentHead() {
  try {
    return runGit(['rev-parse', 'HEAD']);
  } catch {
    return null;
  }
}

function currentHeadTree() {
  try {
    return runGit(['rev-parse', 'HEAD^{tree}']);
  } catch {
    return null;
  }
}

function getProofFile(name) {
  if (!stateDir) {
    return null;
  }
  return path.join(stateDir, `${name}.json`);
}

function recordSimpleProof(name) {
  if (!ensureStateDir()) {
    return;
  }

  const proofPath = getProofFile(name);
  writeJson(proofPath, {
    name,
    timestamp: Date.now(),
    recordedAt: new Date().toISOString(),
    head: currentHead(),
  });
}

function pruneVerifiedCommits(records) {
  let keep = [];
  try {
    keep = runGit(['rev-list', '--max-count=200', 'HEAD'])
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return records;
  }

  const keepSet = new Set(keep);
  return Object.fromEntries(
    Object.entries(records).filter(([commitSha]) => keepSet.has(commitSha)),
  );
}

function markPreCommitSuccess() {
  if (!ensureStateDir()) {
    return;
  }

  const stagedFiles = (() => {
    try {
      return runGit(['diff', '--cached', '--name-only'])
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  })();

  writeJson(pendingFile, {
    createdAt: new Date().toISOString(),
    timestamp: Date.now(),
    tree: runGit(['write-tree']),
    head: currentHead(),
    stagedFiles,
  });
}

function recordCommittedProof() {
  if (!ensureStateDir()) {
    return;
  }

  const pending = readJson(pendingFile, null);
  const commitSha = currentHead();
  const treeSha = currentHeadTree();
  const existing = readJson(verifiedFile, {});

  if (pending && commitSha && treeSha && pending.tree === treeSha) {
    existing[commitSha] = {
      verifiedAt: new Date().toISOString(),
      tree: treeSha,
      source: 'pre-commit',
    };
    writeJson(verifiedFile, pruneVerifiedCommits(existing));
  }

  if (pendingFile && fs.existsSync(pendingFile)) {
    fs.unlinkSync(pendingFile);
  }
}

function listOutgoingCommits() {
  let revisionRange = null;

  try {
    const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
    revisionRange = `${upstream}..HEAD`;
  } catch {
    revisionRange = null;
  }

  const args = revisionRange ? ['rev-list', revisionRange] : ['rev-list', '-n', '1', 'HEAD'];
  const output = runGit(args);
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function validateOutgoingCommits() {
  if (!ensureStateDir()) {
    return;
  }

  const verified = readJson(verifiedFile, {});
  const outgoing = listOutgoingCommits();
  const unverified = outgoing.filter((commitSha) => !verified[commitSha]);

  if (unverified.length > 0) {
    console.error(
      [
        'Push blocked: one or more outgoing commits do not have verified pre-commit proof.',
        'This usually means a commit was created with --no-verify or outside the enforced hook flow.',
        `Unverified commits: ${unverified.join(', ')}`,
      ].join('\n'),
    );
    process.exit(1);
  }
}

const command = process.argv[2];

try {
  switch (command) {
    case 'mark-build':
      recordSimpleProof('build');
      break;
    case 'mark-testfast':
      recordSimpleProof('test-fast');
      break;
    case 'pre-commit':
      markPreCommitSuccess();
      break;
    case 'post-commit':
      recordCommittedProof();
      break;
    case 'pre-push':
      validateOutgoingCommits();
      break;
    default:
      console.error('Usage: node scripts/hook-proof.mjs <mark-build|mark-testfast|pre-commit|post-commit|pre-push>');
      process.exit(1);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`hook-proof failed: ${message}`);
  process.exit(1);
}
