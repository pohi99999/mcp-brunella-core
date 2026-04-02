import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import {
  buildServicePreflightReport,
  getPythonRuntimeCandidates,
  parsePlatformArg,
} from '../scripts/service-preflight.mjs';

describe('service preflight', () => {
  it('parses explicit platform arguments', () => {
    expect(parsePlatformArg(['--platform', 'windows'])).toBe('windows');
    expect(parsePlatformArg(['--platform', 'linux'])).toBe('linux');
  });

  it('builds a passing report when stable prerequisites exist', () => {
    const report = buildServicePreflightReport({
      platform: 'linux',
      repoRoot: '/repo',
      env: {
        BRUNELLA_NODE_MAX_OLD_SPACE_SIZE: '1536',
        BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: '2048',
        BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB: '1792',
      },
      pathExists: (targetPath: string) =>
        [
          '/repo/build/index.js',
          '/repo/build/public/index.html',
          '/repo/myai/server.py',
          '/repo/scripts/supervisors/linux/run-brunella-core.sh',
          '/repo/scripts/supervisors/linux/run-brunella-python.sh',
          '/repo/myai/.venv/bin/python',
        ].includes(targetPath),
      commandExists: vi.fn(() => false),
      ensureWritableDir: vi.fn(),
    });

    expect(report.ok).toBe(true);
    expect(report.checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('fails when the stable build is missing', () => {
    const report = buildServicePreflightReport({
      platform: 'windows',
      repoRoot: 'C:\\repo',
      env: {},
      pathExists: (targetPath: string) =>
        [
          'C:\\repo\\myai\\server.py',
          'C:\\repo\\scripts\\supervisors\\windows\\run-brunella-core.ps1',
          'C:\\repo\\scripts\\supervisors\\windows\\run-brunella-python.ps1',
        ].includes(targetPath),
      commandExists: vi.fn(() => true),
      ensureWritableDir: vi.fn(),
    });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === 'Stable build')?.status).toBe('fail');
  });

  it('exposes the expected python runtime candidates per platform', () => {
    const windowsCandidates = getPythonRuntimeCandidates('windows', 'C:\\repo');
    const linuxCandidates = getPythonRuntimeCandidates('linux', '/repo');

    expect(windowsCandidates.paths[0]).toContain('myai');
    expect(windowsCandidates.commands).toContain('uv');
    expect(linuxCandidates.paths[0]).toBe(path.posix.join('/repo', 'myai', '.venv', 'bin', 'python'));
    expect(linuxCandidates.commands).toContain('python3');
  });
});
