import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function toPosixRelativePath(targetPath: string) {
  return path.relative(process.cwd(), targetPath).replace(/\\/g, '/');
}

describe('linux runtime threshold loader', () => {
  it('exports validated contract values without executing shell content', () => {
    const tempRoot = path.join(process.cwd(), 'temp');
    mkdirSync(tempRoot, { recursive: true });
    const tempDir = mkdtempSync(path.join(tempRoot, 'brunella-linux-contract-'));
    const contractFile = path.join(tempDir, 'runtime-threshold-contract.env');
    const markerFile = path.join(tempDir, 'marker.txt');
    const markerPosix = `./${toPosixRelativePath(markerFile)}`;
    const contractPosix = `./${toPosixRelativePath(contractFile)}`;

    try {
      writeFileSync(
        contractFile,
        [
          '# comment',
          'BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=1792',
          'BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=2304',
          'BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=2048',
          `BRUNELLA_PYTHON_MEMORY_LIMIT_MB=$(touch "${markerPosix}")`,
          `MALICIOUS=$(touch "${markerPosix}")`,
        ].join('\n'),
        'utf-8',
      );

      const result = spawnSync(
        'bash',
        [
          '-lc',
          `set -euo pipefail; source "./scripts/supervisors/linux/load-runtime-threshold-env.sh"; load_runtime_threshold_env "${contractPosix}"; env | grep '^BRUNELLA_' | sort`,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf-8',
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=1792');
      expect(result.stdout).toContain('BRUNELLA_PYTHON_MEMORY_LIMIT_MB=1024');
      expect(result.stdout).toContain('BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=2304');
      expect(result.stdout).toContain('BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=2048');
      expect(existsSync(markerFile)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails closed on invalid contract envelopes', () => {
    const tempRoot = path.join(process.cwd(), 'temp');
    mkdirSync(tempRoot, { recursive: true });
    const tempDir = mkdtempSync(path.join(tempRoot, 'brunella-linux-contract-'));
    const contractFile = path.join(tempDir, 'runtime-threshold-contract.env');
    const contractPosix = `./${toPosixRelativePath(contractFile)}`;

    try {
      writeFileSync(
        contractFile,
        [
          'BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=1792',
          'BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=1792',
          'BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=2048',
        ].join('\n'),
        'utf-8',
      );

      const result = spawnSync(
        'bash',
        [
          '-lc',
          `set -euo pipefail; source "./scripts/supervisors/linux/load-runtime-threshold-env.sh"; load_runtime_threshold_env "${contractPosix}"`,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf-8',
        },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/runtime memory limit must be greater than the node heap budget/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
