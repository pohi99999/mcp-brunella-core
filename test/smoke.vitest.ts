/**
 * Smoke Tesztek — PAIOS + CLI
 *
 * Gyors ellenőrzés: modulok importálhatók, alapértékek helyesek,
 * Express router elérhető, Node.js core modulok működnek.
 *
 * @track paios_e2e_tests_20260321
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

// --- MOCK-OK ---

vi.mock('../src/core/universalOrchestratorService.js', () => ({
  getUniversalOrchestratorService: vi.fn(() => ({ process: vi.fn() })),
}));

vi.mock('../src/server/SocketService.js', () => ({
  socketService: { emit: vi.fn() },
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// ====================================================================
// PAIOS Config — Smoke
// ====================================================================

describe('PAIOS Config — Smoke', () => {
  afterEach(async () => {
    const { clearConfigCache } = await import('../src/config/paiosConfig.js');
    clearConfigCache();
    vi.restoreAllMocks();
  });

  it('loadPaiosConfig() visszaad érvényes objektumot', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const { loadPaiosConfig } = await import('../src/config/paiosConfig.js');
    const config = loadPaiosConfig();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('orchestrator.default_model alapértéke "gemini"', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const { loadPaiosConfig } = await import('../src/config/paiosConfig.js');
    const config = loadPaiosConfig();
    expect(config.orchestrator.default_model).toBe('gemini');
  });

  it('orchestrator.max_tasks_per_request alapértéke 5', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const { loadPaiosConfig } = await import('../src/config/paiosConfig.js');
    const config = loadPaiosConfig();
    expect(config.orchestrator.max_tasks_per_request).toBe(5);
  });

  it('providers mező létezik és objektum', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const { loadPaiosConfig } = await import('../src/config/paiosConfig.js');
    const config = loadPaiosConfig();
    expect(config.providers).toBeDefined();
    expect(typeof config.providers).toBe('object');
  });

  it('clearConfigCache() után újratölthető a konfig', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const { loadPaiosConfig, clearConfigCache } = await import('../src/config/paiosConfig.js');
    const first = loadPaiosConfig();
    clearConfigCache();
    const second = loadPaiosConfig();
    expect(first.orchestrator.default_model).toBe(second.orchestrator.default_model);
  });
});

// ====================================================================
// CLI Config (ConfigManager) — Smoke
// ====================================================================

describe('CLI Config (ConfigManager) — Smoke', () => {
  let tmpDir: string;
  let realSettingsPath: string;
  let realSettingsBackup: string | null;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `brunella-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Backup + törl a valódi ~/.brunella/settings.json-t, hogy ConfigManager
    // ne olvashassa a tesztek között megfertőzött értékeket.
    realSettingsPath = path.join(os.homedir(), '.brunella', 'settings.json');
    realSettingsBackup = null;
    if (fs.existsSync(realSettingsPath)) {
      try {
        realSettingsBackup = fs.readFileSync(realSettingsPath, 'utf-8');
        fs.unlinkSync(realSettingsPath);
      } catch { /* best effort */ }
    }
  });

  afterEach(() => {
    // ConfigManager által a tesztben esetleg létrehozott settings fájl törlése
    if (fs.existsSync(realSettingsPath)) {
      try { fs.unlinkSync(realSettingsPath); } catch { /* best effort */ }
    }
    // Eredeti settings fájl visszaállítása (ha volt)
    if (realSettingsBackup !== null) {
      try {
        const dir = path.dirname(realSettingsPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(realSettingsPath, realSettingsBackup, 'utf-8');
      } catch { /* best effort */ }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ConfigManager példányosítható', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    expect(mgr).toBeDefined();
  });

  it('getAll() visszaad egy objektumot', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    const all = mgr.getAll();
    expect(all).toBeDefined();
    expect(typeof all).toBe('object');
  });

  it('serverUrl alapértéke "http://localhost:3000"', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    expect(mgr.get('serverUrl')).toBe('http://localhost:3000');
  });

  it('theme string típusú', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    expect(typeof mgr.get('theme')).toBe('string');
  });

  it('general.vimMode alapértéke false', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    expect(mgr.get('general.vimMode')).toBe(false);
  });

  it('tools.approvalMode alapértéke "default"', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    expect(mgr.get('tools.approvalMode')).toBe('default');
  });

  it('tools.exclude alapértéke üres tömb', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    expect(mgr.get('tools.exclude')).toEqual([]);
  });

  it('set() + get() roundtrip működik', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    mgr.set('serverUrl', 'http://test-server:9999');
    expect(mgr.get('serverUrl')).toBe('http://test-server:9999');
  });

  it('userSettingsPath .json fájlra mutat', async () => {
    const { ConfigManager } = await import('../src/utils/cliConfig.js');
    const mgr = new ConfigManager(tmpDir);
    expect(mgr.userSettingsPath.endsWith('.json')).toBe(true);
  });
});

// ====================================================================
// PAIOS Express Router — Import Smoke
// ====================================================================

describe('PAIOS Express Router — Import Smoke', () => {
  it('a paiosOrchestrator router importálható', async () => {
    const mod = await import('../src/server/routes/paiosOrchestrator.js');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('a router Express Router függvény', async () => {
    const mod = await import('../src/server/routes/paiosOrchestrator.js');
    expect(typeof mod.default).toBe('function');
  });
});

// ====================================================================
// Node.js Core — Modulok Elérhetők
// ====================================================================

describe('Node.js Core — Modulok Elérhetők', () => {
  it('path modul elérhető', () => {
    expect(typeof path.join).toBe('function');
    expect(path.join('/a', 'b')).toBe(path.join('/a', 'b'));
  });

  it('os modul elérhető', () => {
    expect(typeof os.tmpdir()).toBe('string');
    expect(os.tmpdir().length).toBeGreaterThan(0);
  });

  it('fs modul elérhető', () => {
    expect(typeof fs.existsSync).toBe('function');
    expect(fs.existsSync(os.tmpdir())).toBe(true);
  });
});
