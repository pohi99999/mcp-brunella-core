import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

interface ComposeServiceDefinition {
  security_opt?: string[];
  cap_drop?: string[];
  tmpfs?: string[];
  volumes?: string[];
}

interface ComposeDocument {
  services?: Record<string, ComposeServiceDefinition>;
  volumes?: Record<string, unknown>;
}

function getComposeParsed(): ComposeDocument {
  const composePath = path.join(process.cwd(), 'docker-compose.prod.yml');
  return load(readFileSync(composePath, 'utf-8')) as ComposeDocument;
}

function getComposeServices(): Record<string, ComposeServiceDefinition> {
  return getComposeParsed().services ?? {};
}

describe('docker-compose.prod hardening', () => {
  it('hardens the brunella-core service with least-privilege runtime settings', () => {
    const services = getComposeServices();
    const brunellaCore = services['brunella-core'];

    expect(brunellaCore).toBeDefined();
    expect(brunellaCore.security_opt).toContain('no-new-privileges:true');
    expect(brunellaCore.cap_drop).toContain('ALL');
    expect(brunellaCore.tmpfs).toContain('/tmp:rw,noexec,nosuid,nodev,size=256m');
  });

  it('keeps the python runtime on the same hardened tmpfs profile', () => {
    const services = getComposeServices();
    const brunellaAi = services['brunella-ai'];

    expect(brunellaAi).toBeDefined();
    expect(brunellaAi.security_opt).toContain('no-new-privileges:true');
    expect(brunellaAi.cap_drop).toContain('ALL');
    expect(brunellaAi.tmpfs).toContain('/tmp:rw,noexec,nosuid,nodev,size=256m');
  });

  it('persists stable runtime evidence (brunella.db, drift-history) across recreates via named volume on /app/data', () => {
    const services = getComposeServices();
    const brunellaCore = services['brunella-core'];

    expect(brunellaCore).toBeDefined();
    // Named volume must cover /app/data so brunella.db and runtime-drift-history.json survive
    // container recreation.  Host bind mounts are explicitly rejected to avoid cross-platform
    // permission hazards with the non-root appuser container.
    const dataMount = (brunellaCore.volumes ?? []).find((v) => v.endsWith(':/app/data'));
    expect(dataMount, 'brunella-core must have a volume mounted at /app/data').toBeTruthy();
    expect(dataMount, '/app/data must use a named volume (no host bind mount)').not.toMatch(/^\.\//);
    expect(dataMount, '/app/data must use a named volume (no absolute host path)').not.toMatch(/^\/[^:]/);
  });

  it('persists Node control-plane logs across recreates via named volume on /app/logs', () => {
    const services = getComposeServices();
    const brunellaCore = services['brunella-core'];

    expect(brunellaCore).toBeDefined();
    const logsMount = (brunellaCore.volumes ?? []).find((v) => v.endsWith(':/app/logs'));
    expect(logsMount, 'brunella-core must have a volume mounted at /app/logs').toBeTruthy();
    expect(logsMount, '/app/logs must use a named volume (no host bind mount)').not.toMatch(/^\.\//);
    expect(logsMount, '/app/logs must use a named volume (no absolute host path)').not.toMatch(/^\/[^:]/);
  });

  it('persists Python runtime logs independently via a separate named volume (UID isolation)', () => {
    const services = getComposeServices();
    const brunellaAi = services['brunella-ai'];

    expect(brunellaAi).toBeDefined();
    const logsMount = (brunellaAi.volumes ?? []).find((v) => v.endsWith(':/app/logs'));
    expect(logsMount, 'brunella-ai must have a volume mounted at /app/logs').toBeTruthy();
    expect(logsMount, '/app/logs must use a named volume (no host bind mount)').not.toMatch(/^\.\//);
    expect(logsMount, '/app/logs must use a named volume (no absolute host path)').not.toMatch(/^\/[^:]/);
    // Verify Python log volume is distinct from the Node log volume (UID 10001 vs appuser).
    const coreServices = getComposeServices();
    const coreLogsMount = (coreServices['brunella-core'].volumes ?? []).find((v) => v.endsWith(':/app/logs'));
    expect(logsMount).not.toEqual(coreLogsMount);
  });

  it('declares all three named volumes in the top-level volumes section', () => {
    const parsed = getComposeParsed();
    const topLevelVolumes = Object.keys(parsed.volumes ?? {});

    const coreDataVol = (getComposeServices()['brunella-core'].volumes ?? [])
      .find((v) => v.endsWith(':/app/data'))
      ?.split(':')[0];
    const coreLogsVol = (getComposeServices()['brunella-core'].volumes ?? [])
      .find((v) => v.endsWith(':/app/logs'))
      ?.split(':')[0];
    const aiLogsVol = (getComposeServices()['brunella-ai'].volumes ?? [])
      .find((v) => v.endsWith(':/app/logs'))
      ?.split(':')[0];

    expect(coreDataVol, 'brunella-core /app/data volume name must be resolved').toBeTruthy();
    expect(coreLogsVol, 'brunella-core /app/logs volume name must be resolved').toBeTruthy();
    expect(aiLogsVol, 'brunella-ai /app/logs volume name must be resolved').toBeTruthy();

    expect(topLevelVolumes).toContain(coreDataVol);
    expect(topLevelVolumes).toContain(coreLogsVol);
    expect(topLevelVolumes).toContain(aiLogsVol);
  });
});
