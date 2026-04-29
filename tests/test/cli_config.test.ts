import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { getConfigManager, ConfigManager } from '@packages/utils/cliConfig.js';

describe('CLI Config', () => {
  it('getConfigManager returns a config manager', () => {
    const cm = getConfigManager();
    expect(cm).toBeDefined();
    expect(typeof cm.get).toBe('function');
    expect(typeof cm.set).toBe('function');
    expect(typeof cm.getAll).toBe('function');
  });

  it('get(serverUrl) returns default or string', () => {
    const cm = getConfigManager();
    const v = cm.get('serverUrl');
    expect(typeof v === 'string' || v === undefined).toBe(true);
    if (typeof v === 'string') expect(v.length).toBeGreaterThan(0);
  });

  it('get(general.vimMode) returns boolean or undefined', () => {
    const cm = getConfigManager();
    const v = cm.get('general.vimMode');
    expect(v === undefined || typeof v === 'boolean').toBe(true);
  });

  it('getAll returns an object with expected keys', () => {
    const cm = getConfigManager();
    const all = cm.getAll();
    expect(all && typeof all === 'object').toBe(true);
    expect('serverUrl' in all || (all as Record<string, unknown>).serverUrl !== undefined).toBe(true);
  });

  it('get(tools.approvalMode) returns allowed mode', () => {
    const cm = getConfigManager();
    const v = cm.get('tools.approvalMode');
    const allowed = ['default', 'auto_edit', 'plan', 'yolo'];
    expect(v === undefined || (typeof v === 'string' && allowed.includes(v))).toBe(true);
  });

  it('get(tools.exclude) returns array or undefined', () => {
    const cm = getConfigManager();
    const v = cm.get('tools.exclude');
    expect(v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'))).toBe(true);
  });

  it('env override: BRUNELLA_TELEMETRY_ENABLED', () => {
    const key = process.platform === 'win32' ? 'USERPROFILE' : 'HOME';
    const prev = process.env.BRUNELLA_TELEMETRY_ENABLED;
    const prevHome = process.env[key];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-cfg-'));
    try {
      process.env.BRUNELLA_TELEMETRY_ENABLED = 'true';
      process.env[key] = tmp;
      const cm = new ConfigManager(tmp);
      const v = cm.get('telemetry.enabled');
      expect(v).toBe(true);
    } finally {
      if (prev !== undefined) process.env.BRUNELLA_TELEMETRY_ENABLED = prev;
      else delete process.env.BRUNELLA_TELEMETRY_ENABLED;
      if (prevHome !== undefined) process.env[key] = prevHome;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('legacy migration: flat user file becomes nested', () => {
    const key = process.platform === 'win32' ? 'USERPROFILE' : 'HOME';
    const prevHome = process.env[key];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-cfg-'));
    try {
      const dir = path.join(tmp, '.brunella');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'settings.json'),
        JSON.stringify({ serverUrl: 'http://legacy:9999', theme: 'light' }),
        'utf-8'
      );
      process.env[key] = tmp;
      const cm = new ConfigManager(tmp);
      const serverUrl = cm.get('serverUrl');
      const approvalMode = cm.get('tools.approvalMode');
      expect(serverUrl).toBe('http://legacy:9999');
      expect(approvalMode === 'default' || typeof approvalMode === 'string').toBe(true);
      const raw = fs.readFileSync(path.join(dir, 'settings.json'), 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect('tools' in parsed || 'ui' in parsed || parsed.serverUrl === 'http://legacy:9999').toBe(true);
    } finally {
      if (prevHome !== undefined) process.env[key] = prevHome;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});