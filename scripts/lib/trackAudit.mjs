import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const TRACK_DOD_KEYS = [
  'tests_pass',
  'build_clean',
  'code_committed',
  'no_verify_used',
];

export const DEFAULT_TRACK_DOD = Object.freeze({
  tests_pass: false,
  build_clean: false,
  code_committed: false,
  no_verify_used: false,
});

const NON_EVIDENCE_PREFIXES = [
  '.ai/',
  'build/',
  'logs/',
  'node_modules/',
  'playwright-report/',
  'temp/',
  'test-results/',
];

function toPosixPath(value) {
  return String(value).replace(/\\/g, '/');
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function runGit(repoRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function normalizeTrackDod(value) {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_TRACK_DOD };
  }

  return {
    tests_pass: value.tests_pass === true,
    build_clean: value.build_clean === true,
    code_committed: value.code_committed === true,
    no_verify_used: value.no_verify_used === true,
  };
}

export function isClosedTrack(record) {
  const status = String(record.status ?? '').toLowerCase();
  return status === 'completed' || status === 'archived' || record.isArchived === true;
}

export function isTrackMetaPath(relativePath) {
  const normalized = toPosixPath(relativePath);
  return (
    normalized.startsWith('conductor/tracks/') ||
    normalized.startsWith('conductor/archive/')
  ) && normalized.endsWith('/meta.json');
}

export function isRepositoryWorkPath(relativePath) {
  const normalized = toPosixPath(relativePath);
  if (!normalized || normalized.endsWith('/')) {
    return false;
  }

  if (normalized.startsWith('conductor/')) {
    return false;
  }

  return !NON_EVIDENCE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function walkMetaFiles(directory, collector = []) {
  if (!fs.existsSync(directory)) {
    return collector;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkMetaFiles(fullPath, collector);
      continue;
    }

    if (entry.isFile() && entry.name === 'meta.json') {
      collector.push(fullPath);
    }
  }

  return collector;
}

function buildTrackRecord(repoRoot, metaPath, isArchived) {
  const meta = readJson(metaPath);
  const trackDir = path.dirname(metaPath);
  const relativePath = toPosixPath(path.relative(repoRoot, metaPath));
  const relativeDir = toPosixPath(path.relative(repoRoot, trackDir));
  const id = pickString(meta.id, meta.track_id, meta.trackId, path.basename(trackDir)) ?? path.basename(trackDir);
  const status = pickString(meta.status, isArchived ? 'archived' : 'active') ?? (isArchived ? 'archived' : 'active');

  const trackArtifacts = {
    plan: fs.existsSync(path.join(trackDir, 'plan.md')),
    spec: fs.existsSync(path.join(trackDir, 'spec.md')),
    track: fs.existsSync(path.join(trackDir, 'track.md')),
    phases: fs.existsSync(path.join(trackDir, 'phases')),
  };

  return {
    id,
    name: pickString(meta.title, meta.name, id) ?? id,
    status: status.toLowerCase(),
    specStatus: pickString(meta.spec_status, meta.specStatus)?.toLowerCase() ?? null,
    priority: pickString(meta.priority) ?? 'medium',
    progress: Number(meta.progress ?? 0),
    meta,
    metaPath,
    trackDir,
    relativePath,
    relativeDir,
    isArchived,
    dod: normalizeTrackDod(meta.dod),
    hasDod: Boolean(meta.dod && typeof meta.dod === 'object'),
    verificationNotes: pickString(meta.verificationNotes, meta.verification_notes),
    archiveReason: pickString(meta.archiveReason, meta.archive_reason),
    completedAt: pickString(meta.completedAt, meta.completed_at, meta.completed),
    archivedAt: pickString(meta.archivedAt, meta.archived_at),
    updatedAt: pickString(meta.updatedAt, meta.updated_at, meta.updated),
    artifacts: trackArtifacts,
  };
}

function getLatestCommitEvidence(repoRoot, relativePath) {
  const commitSha = runGit(repoRoot, ['log', '-1', '--format=%H', '--', relativePath]);
  if (!commitSha) {
    return {
      commitSha: null,
      files: [],
      hasRepositoryWork: false,
    };
  }

  const fileOutput = runGit(repoRoot, ['show', '--pretty=format:', '--name-only', commitSha]);
  const files = fileOutput
    .split(/\r?\n/)
    .map((line) => toPosixPath(line.trim()))
    .filter(Boolean);

  return {
    commitSha,
    files,
    hasRepositoryWork: files.some((file) => isRepositoryWorkPath(file)),
  };
}

function collectDuplicateMap(records) {
  const duplicateMap = new Map();
  for (const record of records) {
    const current = duplicateMap.get(record.id) ?? { active: [], archived: [] };
    const entry = {
      status: record.status,
      progress: record.progress,
      path: record.relativePath,
    };
    if (record.isArchived) {
      current.archived.push(entry);
    } else {
      current.active.push(entry);
    }
    duplicateMap.set(record.id, current);
  }
  return duplicateMap;
}

function evaluateClosedTrack(repoRoot, record, duplicateMap) {
  const issues = [];
  const warnings = [];

  if (!record.hasDod) {
    issues.push('Missing required dod checklist.');
  }

  if (record.progress !== 100) {
    issues.push(`Closed track progress must be 100 but is ${record.progress}.`);
  }

  if (!record.dod.tests_pass) {
    issues.push('dod.tests_pass must be true for completed or archived tracks.');
  }

  if (!record.dod.build_clean) {
    issues.push('dod.build_clean must be true for completed or archived tracks.');
  }

  if (!record.dod.code_committed) {
    issues.push('dod.code_committed must be true for completed or archived tracks.');
  }

  if (record.dod.no_verify_used) {
    issues.push('dod.no_verify_used must remain false; --no-verify usage is forbidden.');
  }

  if (record.status === 'completed' && !record.verificationNotes) {
    issues.push('Completed track is missing verificationNotes.');
  }

  if (record.isArchived && !record.archiveReason) {
    issues.push('Archived track is missing archiveReason.');
  }

  if (record.status === 'completed' && !record.completedAt) {
    warnings.push('Completed track is missing completedAt timestamp.');
  }

  if (record.isArchived && !record.archivedAt) {
    warnings.push('Archived track is missing archivedAt timestamp.');
  }

  if (!record.artifacts.plan && !record.artifacts.spec && !record.artifacts.track && !record.artifacts.phases) {
    issues.push('Track folder has no plan/spec/track/phases artifact.');
  }

  if (record.specStatus && ['draft', 'review', 'pending_approval', 'rejected'].includes(record.specStatus)) {
    issues.push(`Closed track cannot remain in spec_status=${record.specStatus}.`);
  }

  const duplicate = duplicateMap.get(record.id);
  if (duplicate && duplicate.active.length > 0 && duplicate.archived.length > 0) {
    issues.push('Track exists in both active and archived trees.');
    if (
      duplicate.active.some((entry) => entry.status !== 'archived' || entry.progress !== 100)
    ) {
      issues.push('Active/archive duplicates disagree on lifecycle state or progress.');
    }
  }

  const latestCommit = getLatestCommitEvidence(repoRoot, record.relativePath);
  if (latestCommit.commitSha && !latestCommit.hasRepositoryWork) {
    issues.push('Latest commit touching this track metadata contains no repository work evidence outside track/conductor files.');
  }

  if (!latestCommit.commitSha) {
    warnings.push('No git history found for track metadata.');
  }

  return {
    id: record.id,
    name: record.name,
    status: record.status,
    isArchived: record.isArchived,
    relativePath: record.relativePath,
    trackDir: record.relativeDir,
    dod: record.dod,
    issues,
    warnings,
    latestCommit,
  };
}

export function auditTrackRepository({ repoRoot = process.cwd() } = {}) {
  const activeMetaFiles = walkMetaFiles(path.join(repoRoot, 'conductor', 'tracks'));
  const archivedMetaFiles = walkMetaFiles(path.join(repoRoot, 'conductor', 'archive'));

  const records = [
    ...activeMetaFiles.map((filePath) => buildTrackRecord(repoRoot, filePath, false)),
    ...archivedMetaFiles.map((filePath) => buildTrackRecord(repoRoot, filePath, true)),
  ];

  const duplicateMap = collectDuplicateMap(records);
  const auditedTracks = records
    .filter((record) => isClosedTrack(record))
    .map((record) => evaluateClosedTrack(repoRoot, record, duplicateMap));

  const failingTracks = auditedTracks.filter((track) => track.issues.length > 0);
  const warningTracks = auditedTracks.filter((track) => track.issues.length === 0 && track.warnings.length > 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalClosedTracks: auditedTracks.length,
      failingTracks: failingTracks.length,
      warningTracks: warningTracks.length,
      archivedMetaFiles: archivedMetaFiles.length,
      activeMetaFiles: activeMetaFiles.length,
    },
    tracks: auditedTracks,
  };
}

function getStagedFiles(repoRoot) {
  const output = runGit(repoRoot, ['diff', '--cached', '--name-only']);
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => toPosixPath(line.trim()))
    .filter(Boolean);
}

function getProofPath(repoRoot, proofName) {
  return path.join(repoRoot, '.git', 'brunella-hook-proof', `${proofName}.json`);
}

function readProof(repoRoot, proofName) {
  const proofPath = getProofPath(repoRoot, proofName);
  if (!fs.existsSync(proofPath)) {
    return null;
  }

  try {
    return readJson(proofPath);
  } catch {
    return null;
  }
}

function latestMtimeForFiles(repoRoot, relativePaths) {
  let latest = 0;
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const stat = fs.statSync(absolutePath);
    latest = Math.max(latest, stat.mtimeMs);
  }
  return latest;
}

function isProofFresh(proof, latestFileMtimeMs) {
  if (!proof || typeof proof.timestamp !== 'number') {
    return false;
  }

  return proof.timestamp >= latestFileMtimeMs;
}

export function validateStagedTrackClosures({ repoRoot = process.cwd() } = {}) {
  const stagedFiles = getStagedFiles(repoRoot);
  const stagedMetaFiles = stagedFiles.filter((relativePath) => isTrackMetaPath(relativePath));
  if (stagedMetaFiles.length === 0) {
    return {
      stagedFiles,
      tracks: [],
      issues: [],
    };
  }

  const latestStagedMtimeMs = latestMtimeForFiles(repoRoot, stagedFiles);
  const buildProof = readProof(repoRoot, 'build');
  const testFastProof = readProof(repoRoot, 'test-fast');
  const repositoryWorkStaged = stagedFiles.some((relativePath) => isRepositoryWorkPath(relativePath));
  const issues = [];
  const tracks = [];

  for (const relativeMetaPath of stagedMetaFiles) {
    const absoluteMetaPath = path.join(repoRoot, relativeMetaPath);
    const record = buildTrackRecord(
      repoRoot,
      absoluteMetaPath,
      toPosixPath(relativeMetaPath).startsWith('conductor/archive/'),
    );

    if (!isClosedTrack(record)) {
      continue;
    }

    tracks.push(record.id);

    if (!record.hasDod) {
      issues.push(`${record.id}: missing dod checklist.`);
    }
    if (!record.dod.tests_pass) {
      issues.push(`${record.id}: dod.tests_pass must be true before closure.`);
    }
    if (!record.dod.build_clean) {
      issues.push(`${record.id}: dod.build_clean must be true before closure.`);
    }
    if (!record.dod.code_committed) {
      issues.push(`${record.id}: dod.code_committed must be true before closure.`);
    }
    if (record.dod.no_verify_used) {
      issues.push(`${record.id}: dod.no_verify_used must remain false.`);
    }
    if (record.progress !== 100) {
      issues.push(`${record.id}: closed tracks must declare progress 100.`);
    }
    if (record.status === 'completed' && !record.verificationNotes) {
      issues.push(`${record.id}: completed track is missing verificationNotes.`);
    }
    if (record.isArchived && !record.archiveReason) {
      issues.push(`${record.id}: archived track is missing archiveReason.`);
    }
    if (!repositoryWorkStaged) {
      issues.push(`${record.id}: no implementation/test/documentation changes are staged alongside closure metadata.`);
    }
    if (!isProofFresh(buildProof, latestStagedMtimeMs)) {
      issues.push(`${record.id}: build proof is missing or older than the staged changes. Run npm run build again.`);
    }
    if (!isProofFresh(testFastProof, latestStagedMtimeMs)) {
      issues.push(`${record.id}: test:fast proof is missing or older than the staged changes. Run npm run test:fast again.`);
    }
  }

  return {
    stagedFiles,
    tracks,
    issues,
  };
}
